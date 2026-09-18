-- Borrar y cancelar rankings y torneos. Ver la migración anterior para el
-- porqué de las dos salidas.
--
-- Tres cosas que no son obvias y que están hechas a propósito:
--
-- 1. El registro de la baja va en una tabla sin FK al objeto dado de baja. Si
--    `baja.objeto_id` fuera una llave foránea con cascade, borrar el ranking
--    borraría el registro de que se borró, y nadie sabría nunca qué pasó. Es
--    una tabla de bitácora, no una relación.
--
-- 2. "Sin resultados" no es solo mirar `partido.estado`. Un marcador en vivo
--    con puntos anotados también es gente jugando, aunque el partido siga
--    'pendiente' porque todavía no terminó. Los dos cuentan.
--
-- 3. Se restaura el guarda de «ya hay un ranking en curso» que la migración 27
--    perdió al reescribir `crear_ranking` de cero (el mismo accidente que se
--    llevó el insert de las divisiones). Hoy se pueden crear dos rankings
--    abiertos a la vez sin que nada se queje, que es justo la manera de
--    terminar con un ranking de más que hay que borrar.

-- -----------------------------------------------------------------------------
-- Bitácora de bajas
-- -----------------------------------------------------------------------------
create table if not exists public.baja (
  id          uuid primary key default gen_random_uuid(),
  accion      text not null check (accion in ('borrado', 'cancelado')),
  tipo        text not null check (tipo in ('ranking', 'torneo')),
  -- Sin `references` a propósito: ver la nota 1 arriba.
  objeto_id   uuid not null,
  nombre      text not null,
  estado      text not null,
  contenido   jsonb not null default '{}'::jsonb,
  motivo      text,
  hecho_por   uuid references public.usuario (id) on delete set null,
  hecho_en    timestamptz not null default now()
);

create index if not exists baja_hecho_en_idx on public.baja (hecho_en desc);

alter table public.baja enable row level security;

-- Solo lectura, y solo el coordinador. Las filas las escriben las funciones de
-- abajo, que son security definer y por eso no pasan por RLS.
drop policy if exists baja_coordinador on public.baja;
create policy baja_coordinador on public.baja
  for select using (public.es_coordinador());

grant select on public.baja to authenticated;

-- -----------------------------------------------------------------------------
-- Qué hay adentro: lo mismo que decide si se puede borrar y lo que se le
-- enseña al coordinador antes de que confirme.
-- -----------------------------------------------------------------------------
create or replace function public.contenido_del_ranking(p_ranking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'inscritos', (
      select count(*) from public.inscripcion i
        join public.division d on d.id = i.division_id
       where d.ranking_id = p_ranking_id),
    'partidos', (
      select count(*) from public.partido p
        join public.division d on d.id = p.division_id
       where d.ranking_id = p_ranking_id),
    'jugados', (
      select count(*) from public.partido p
        join public.division d on d.id = p.division_id
       where d.ranking_id = p_ranking_id and p.estado <> 'pendiente'),
    'marcadores', (
      select count(*) from public.marcador m
        join public.partido p on p.id = m.partido_id
        join public.division d on d.id = p.division_id
       where d.ranking_id = p_ranking_id
         and (m.puntos_a > 0 or m.puntos_b > 0 or m.sets_a > 0 or m.sets_b > 0)),
    'retiros', (
      select count(*) from public.retiro where ranking_id = p_ranking_id),
    'hereda', (
      select count(*) from public.ranking where anterior_id = p_ranking_id)
  );
$$;

create or replace function public.contenido_del_torneo(p_torneo_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'inscritos', (
      select count(*) from public.torneo_inscripcion where torneo_id = p_torneo_id),
    'partidos', (
      select count(*) from public.partido where torneo_id = p_torneo_id),
    'jugados', (
      select count(*) from public.partido
       where torneo_id = p_torneo_id and estado <> 'pendiente'),
    'marcadores', (
      select count(*) from public.marcador m
        join public.partido p on p.id = m.partido_id
       where p.torneo_id = p_torneo_id
         and (m.puntos_a > 0 or m.puntos_b > 0 or m.sets_a > 0 or m.sets_b > 0)),
    'llaves', (
      select count(*) from public.torneo_llave where torneo_id = p_torneo_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Borrar
-- -----------------------------------------------------------------------------
create or replace function public.eliminar_ranking(p_ranking_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v jsonb;
begin
  perform public.exigir_coordinador();

  select * into r from public.ranking where id = p_ranking_id for update;
  if r.id is null then raise exception 'Ese ranking no existe'; end if;

  if r.estado not in ('borrador', 'abierto') then
    raise exception 'Este ranking está %, y a esa altura ya no se borra: cancelalo', r.estado::text;
  end if;

  v := public.contenido_del_ranking(p_ranking_id);

  if (v->>'jugados')::int > 0 then
    raise exception 'No se puede borrar: ya hay % partido(s) con resultado registrado. Cancelalo', v->>'jugados';
  end if;
  if (v->>'marcadores')::int > 0 then
    raise exception 'No se puede borrar: hay % marcador(es) con puntos anotados. Cancelalo', v->>'marcadores';
  end if;
  if (v->>'retiros')::int > 0 then
    raise exception 'No se puede borrar: hay % retiro(s) registrados. Cancelalo', v->>'retiros';
  end if;
  if (v->>'hereda')::int > 0 then
    raise exception 'No se puede borrar: otro ranking hereda de este';
  end if;

  insert into public.baja (accion, tipo, objeto_id, nombre, estado, contenido, motivo, hecho_por)
  values ('borrado', 'ranking', r.id, r.nombre, r.estado::text, v,
          nullif(btrim(coalesce(p_motivo, '')), ''), auth.uid());

  delete from public.ranking where id = p_ranking_id;
  return v;
end;
$$;

create or replace function public.eliminar_torneo(p_torneo_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.torneo%rowtype;
  v jsonb;
begin
  perform public.exigir_coordinador();

  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Ese torneo no existe'; end if;

  if t.estado not in ('borrador', 'inscripcion', 'en_juego') then
    raise exception 'Este torneo está %, y a esa altura ya no se borra: cancelalo', t.estado::text;
  end if;

  v := public.contenido_del_torneo(p_torneo_id);

  if (v->>'jugados')::int > 0 then
    raise exception 'No se puede borrar: ya hay % partido(s) con resultado registrado. Cancelalo', v->>'jugados';
  end if;
  if (v->>'marcadores')::int > 0 then
    raise exception 'No se puede borrar: hay % marcador(es) con puntos anotados. Cancelalo', v->>'marcadores';
  end if;

  insert into public.baja (accion, tipo, objeto_id, nombre, estado, contenido, motivo, hecho_por)
  values ('borrado', 'torneo', t.id, t.nombre, t.estado::text, v,
          nullif(btrim(coalesce(p_motivo, '')), ''), auth.uid());

  delete from public.torneo where id = p_torneo_id;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cancelar
--
-- El motivo es obligatorio. Un ranking que desaparece de la portada sin que
-- nadie sepa por qué genera más preguntas de las que ahorra.
-- -----------------------------------------------------------------------------
create or replace function public.cancelar_ranking(p_ranking_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
begin
  perform public.exigir_coordinador();

  if btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'Escribí por qué lo cancelás: queda en el registro';
  end if;

  select * into r from public.ranking where id = p_ranking_id for update;
  if r.id is null then raise exception 'Ese ranking no existe'; end if;
  if r.estado::text = 'cancelado' then raise exception 'Ese ranking ya está cancelado'; end if;
  if r.estado = 'cerrado' then
    raise exception 'Un ranking cerrado no se cancela: ya terminó y es la historia de la que hereda el siguiente';
  end if;

  insert into public.baja (accion, tipo, objeto_id, nombre, estado, contenido, motivo, hecho_por)
  values ('cancelado', 'ranking', r.id, r.nombre, r.estado::text,
          public.contenido_del_ranking(p_ranking_id), btrim(p_motivo), auth.uid());

  update public.ranking set estado = 'cancelado' where id = p_ranking_id;
end;
$$;

create or replace function public.cancelar_torneo(p_torneo_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.torneo%rowtype;
begin
  perform public.exigir_coordinador();

  if btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'Escribí por qué lo cancelás: queda en el registro';
  end if;

  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Ese torneo no existe'; end if;
  if t.estado::text = 'cancelado' then raise exception 'Ese torneo ya está cancelado'; end if;
  if t.estado = 'cerrado' then
    raise exception 'Un torneo cerrado no se cancela: ya tiene campeón';
  end if;

  insert into public.baja (accion, tipo, objeto_id, nombre, estado, contenido, motivo, hecho_por)
  values ('cancelado', 'torneo', t.id, t.nombre, t.estado::text,
          public.contenido_del_torneo(p_torneo_id), btrim(p_motivo), auth.uid());

  update public.torneo set estado = 'cancelado' where id = p_torneo_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lo que hay que ajustar porque ahora existe un estado más
-- -----------------------------------------------------------------------------

-- El historial del perfil escondía los borradores; un cancelado tampoco es algo
-- que le haya pasado al jugador.
create or replace function public.historial_jugador(p_usuario_id uuid)
returns table (
  ranking_id uuid,
  ranking_nombre text,
  ranking_estado public.ranking_estado,
  division public.division_tipo,
  posicion int,
  jugadores_division int,
  pj int,
  pg int,
  pp int,
  pts int,
  n_premiados smallint,
  n_ascienden smallint,
  n_descienden smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.nombre,
    r.estado,
    d.tipo,
    pos.posicion::int,
    (select count(*) from public.inscripcion i2 where i2.division_id = d.id)::int,
    coalesce(t.pj, 0),
    coalesce(t.pg, 0),
    coalesce(t.pp, 0),
    coalesce(t.pts, 0),
    r.n_premiados,
    r.n_ascienden,
    r.n_descienden
  from public.inscripcion i
  join public.division d on d.id = i.division_id
  join public.ranking r on r.id = d.ranking_id
  join lateral public.posiciones_division(d.id) pos on pos.usuario_id = i.usuario_id
  left join public.tabla_posiciones t on t.division_id = d.id and t.usuario_id = i.usuario_id
  where i.usuario_id = p_usuario_id
    and r.estado::text not in ('borrador', 'cancelado')
  order by r.creado_en desc;
$$;

-- Y el guarda que se perdió en la migración 27. Un ranking cancelado no está
-- en curso, así que no bloquea la creación del que lo reemplaza.
create or replace function public.crear_ranking(
  p_semestre_id uuid,
  p_numero smallint,
  p_nombre text,
  p_fecha_limite date,
  p_pts_victoria smallint default 1,
  p_pts_derrota smallint default 0,
  p_n_ascienden smallint default 3,
  p_n_descienden smallint default 3,
  p_n_premiados smallint default 3,
  p_horas_autoconfirmacion integer default 72,
  p_sets_para_ganar smallint default 2,
  p_puntos_por_set smallint default 11
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare v_id uuid;
begin
  perform public.exigir_coordinador();

  if coalesce(p_sets_para_ganar, 0) < 1 then
    raise exception 'Hay que ganar al menos un set';
  end if;

  if exists (select 1 from public.ranking where estado::text not in ('cerrado', 'cancelado')) then
    raise exception 'Ya hay un ranking en curso; cerralo, cancelalo o borralo antes de crear otro';
  end if;

  insert into public.ranking (
    semestre_id, numero, nombre, fecha_limite, pts_victoria, pts_derrota,
    n_ascienden, n_descienden, n_premiados, horas_autoconfirmacion,
    sets_para_ganar, puntos_por_set
  ) values (
    p_semestre_id, p_numero, btrim(p_nombre), p_fecha_limite, p_pts_victoria, p_pts_derrota,
    p_n_ascienden, p_n_descienden, p_n_premiados, p_horas_autoconfirmacion,
    coalesce(p_sets_para_ganar, 2), coalesce(p_puntos_por_set, 11)
  ) returning id into v_id;

  insert into public.division (ranking_id, tipo) values (v_id, 'mayor'), (v_id, 'menor');

  return v_id;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
grant execute on function public.contenido_del_ranking(uuid) to authenticated;
grant execute on function public.contenido_del_torneo(uuid) to authenticated;
grant execute on function public.eliminar_ranking(uuid, text) to authenticated;
grant execute on function public.eliminar_torneo(uuid, text) to authenticated;
grant execute on function public.cancelar_ranking(uuid, text) to authenticated;
grant execute on function public.cancelar_torneo(uuid, text) to authenticated;

revoke execute on function public.contenido_del_ranking(uuid) from public, anon;
revoke execute on function public.contenido_del_torneo(uuid) from public, anon;
revoke execute on function public.eliminar_ranking(uuid, text) from public, anon;
revoke execute on function public.eliminar_torneo(uuid, text) from public, anon;
revoke execute on function public.cancelar_ranking(uuid, text) from public, anon;
revoke execute on function public.cancelar_torneo(uuid, text) from public, anon;
