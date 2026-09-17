-- =============================================================================
-- Retiro de un jugador del ranking en curso + autoconfirmación programada.
--
-- Regla acordada con el club: si alguien se va a mitad de ranking, no alcanzó
-- a jugar contra todos, así que los puntos que repartió son desiguales. Se
-- anulan TODOS sus partidos (jugados y pendientes) y sale de la tabla. El
-- coordinador lo confirma viendo antes a quién afecta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registro de retiros (la inscripción se borra, esto guarda la historia).
-- -----------------------------------------------------------------------------
create table if not exists public.retiro (
  id            uuid primary key default gen_random_uuid(),
  ranking_id    uuid not null references public.ranking (id) on delete cascade,
  usuario_id    uuid not null references public.usuario (id) on delete restrict,
  division      public.division_tipo not null,
  motivo        text,
  partidos_anulados smallint not null default 0,
  ejecutado_por uuid references public.usuario (id),
  ejecutado_en  timestamptz not null default now(),
  constraint retiro_unico unique (ranking_id, usuario_id)
);

alter table public.retiro enable row level security;
create policy retiro_lectura on public.retiro for select using (true);
create policy retiro_coordinador on public.retiro for all
  using (public.es_coordinador()) with check (public.es_coordinador());

-- -----------------------------------------------------------------------------
-- Qué pasaría si se retira: cuántos partidos se anulan y quién pierde puntos.
-- Solo consulta, no cambia nada. Es lo que se le muestra al coordinador.
-- -----------------------------------------------------------------------------
create or replace function public.impacto_retiro(p_ranking_id uuid, p_usuario_id uuid)
returns table (
  rival_id uuid,
  rival text,
  estado public.partido_estado,
  gano_el_rival boolean,
  puntos_que_pierde int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;

  return query
  select
    u.id,
    u.nombre,
    p.estado,
    (p.ganador is not null and p.ganador <> p_usuario_id),
    case
      when p.estado not in ('confirmado', 'resuelto') then 0
      when p.ganador <> p_usuario_id then r.pts_victoria::int
      else r.pts_derrota::int
    end
  from public.partido p
  join public.division d on d.id = p.division_id
  join public.usuario u
    on u.id = case when p.jugador_a = p_usuario_id then p.jugador_b else p.jugador_a end
  where d.ranking_id = p_ranking_id
    and p_usuario_id in (p.jugador_a, p.jugador_b)
    and p.estado <> 'anulado'
  order by u.nombre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Retirar: anula todos sus partidos del ranking y lo saca de la tabla.
-- -----------------------------------------------------------------------------
create or replace function public.retirar_del_ranking(
  p_ranking_id uuid,
  p_usuario_id uuid,
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v_yo uuid := auth.uid();
  v_division public.division_tipo;
  v_division_id uuid;
  v_anulados int := 0;
  p public.partido%rowtype;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado = 'cerrado' then raise exception 'El ranking ya está cerrado'; end if;

  select d.tipo, d.id into v_division, v_division_id
  from public.inscripcion i join public.division d on d.id = i.division_id
  where d.ranking_id = p_ranking_id and i.usuario_id = p_usuario_id;
  if v_division is null then raise exception 'Ese jugador no está inscrito en este ranking'; end if;

  -- Anular uno por uno para dejar la bitácora completa
  for p in
    select pa.* from public.partido pa
    join public.division d on d.id = pa.division_id
    where d.ranking_id = p_ranking_id
      and p_usuario_id in (pa.jugador_a, pa.jugador_b)
      and pa.estado <> 'anulado'
    for update
  loop
    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    values (p.id, v_yo, 'anulo', public.partido_a_json(p),
            jsonb_build_object('estado', 'anulado', 'motivo', 'retiro del jugador'));

    update public.partido set
      estado = 'anulado', ganador = null, sets_a = null, sets_b = null,
      resolucion = left(coalesce(p_motivo, 'Retiro del jugador'), 500),
      confirmado_por = v_yo, confirmado_en = now()
    where id = p.id;

    delete from public.set_partido where partido_id = p.id;
    v_anulados := v_anulados + 1;
  end loop;

  delete from public.inscripcion
  where division_id = v_division_id and usuario_id = p_usuario_id;

  insert into public.retiro (ranking_id, usuario_id, division, motivo, partidos_anulados, ejecutado_por)
  values (p_ranking_id, p_usuario_id, v_division, nullif(trim(coalesce(p_motivo, '')), ''), v_anulados, v_yo)
  on conflict (ranking_id, usuario_id) do update
    set motivo = excluded.motivo, partidos_anulados = excluded.partidos_anulados,
        ejecutado_por = excluded.ejecutado_por, ejecutado_en = now();

  return v_anulados;
end;
$$;

revoke execute on function public.impacto_retiro(uuid, uuid) from public, anon;
revoke execute on function public.retirar_del_ranking(uuid, uuid, text) from public, anon;

-- -----------------------------------------------------------------------------
-- Autoconfirmación programada: que el plazo de 72 h exista aunque nadie entre.
-- pg_cron hay que habilitarlo en el dashboard de Supabase (Database >
-- Extensions). Si no está, esto no falla: la app igual llama a la función al
-- cargar /partidos y /admin/partidos.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'autoconfirmar-partidos') then
      perform cron.unschedule('autoconfirmar-partidos');
    end if;
    perform cron.schedule('autoconfirmar-partidos', '15 * * * *', 'select public.autoconfirmar_vencidos()');
    raise notice 'autoconfirmación programada cada hora con pg_cron';
  else
    raise notice 'pg_cron no está habilitado; la autoconfirmación depende de que alguien abra la app';
  end if;
exception when others then
  raise notice 'no se pudo programar la autoconfirmación: %', sqlerrm;
end;
$$;
