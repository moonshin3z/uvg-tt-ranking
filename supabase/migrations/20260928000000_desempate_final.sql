-- =============================================================================
-- Cómo termina un desempate que no termina.
--
-- El reglamento del club dice: partido adicional entre los empatados cuando
-- el empate afecta premio, ascenso o descenso. Con dos jugadores eso siempre
-- resuelve. Con tres o más el desempate es un todos contra todos entre ellos,
-- y puede volver a salir cíclico (A le gana a B, B a C, C a A): los tres
-- quedan otra vez con lo mismo. No era un caso raro, y el ranking se quedaba
-- en `en_desempates` sin forma de cerrarse.
--
-- Decisión de Iván (17/09/2026), en dos escalones:
--   1. Si tras el desempate siguen iguales, decide la diferencia de sets en
--      esos partidos de desempate. Es el criterio de la ITTF y casi siempre
--      rompe el empate sin volver a la mesa.
--   2. Si ni eso alcanza, lo decide el coordinador a mano, y queda anotado
--      quién lo decidió, cuándo y por qué.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dónde queda la decisión a mano.
-- -----------------------------------------------------------------------------
create table if not exists public.desempate_manual (
  id           uuid primary key default gen_random_uuid(),
  division_id  uuid not null references public.division (id) on delete cascade,
  usuario_id   uuid not null references public.usuario (id) on delete cascade,
  orden        smallint not null,
  motivo       text not null,
  decidido_por uuid references public.usuario (id),
  decidido_en  timestamptz not null default now(),
  constraint desempate_manual_unico unique (division_id, usuario_id),
  constraint desempate_manual_motivo check (length(btrim(motivo)) >= 10)
);

comment on table public.desempate_manual is
  'Último recurso: el coordinador ordena a mano un empate que ni los partidos de desempate ni la diferencia de sets rompieron. El motivo es obligatorio porque esto decide premios y descensos.';

alter table public.desempate_manual enable row level security;
drop policy if exists desempate_manual_lectura on public.desempate_manual;
create policy desempate_manual_lectura on public.desempate_manual for select using (true);
drop policy if exists desempate_manual_coordinador on public.desempate_manual;
create policy desempate_manual_coordinador on public.desempate_manual for all
  using (public.es_coordinador()) with check (public.es_coordinador());

grant select on public.desempate_manual to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. El orden de la división, con los dos escalones nuevos.
--
-- Criterios, en orden:
--   puntos · desempates ganados · diferencia de sets EN los desempates ·
--   enfrentamiento directo (solo entre dos) · diferencia de sets total ·
--   decisión del coordinador · nombre.
--
-- El nombre sigue al final, pero ya no decide nada que importe: si llega ahí
-- con un empate en puesto relevante, `empates_relevantes` lo marca y el
-- ranking no se puede cerrar.
-- -----------------------------------------------------------------------------
drop function if exists public.orden_division(uuid);
create function public.orden_division(p_division_id uuid)
returns table (
  usuario_id uuid, nombre text, pts int, pg_desempate int,
  dif_sets_desempate int, dif_sets int, gano_directo int, orden_manual int, posicion int
)
language sql
stable
security definer
set search_path = public
as $fn$
  with desempates as (
    select p.jugador_a, p.jugador_b, p.sets_a, p.sets_b
      from public.partido p
     where p.division_id = p_division_id
       and p.tipo = 'desempate'
       and p.estado in ('confirmado', 'resuelto')
  ),
  sets_desempate as (
    select d.jugador_a as usuario_id,
           coalesce(d.sets_a, 0) - coalesce(d.sets_b, 0) as dif from desempates d
    union all
    select d.jugador_b, coalesce(d.sets_b, 0) - coalesce(d.sets_a, 0) from desempates d
  ),
  base as (
    select t.usuario_id, t.nombre, t.pts, t.pg_desempate, t.dif_sets,
           coalesce((select sum(sd.dif)::int from sets_desempate sd
                      where sd.usuario_id = t.usuario_id), 0) as dif_sets_desempate,
           coalesce((select dm.orden::int from public.desempate_manual dm
                      where dm.division_id = p_division_id and dm.usuario_id = t.usuario_id), 0) as orden_manual
      from public.tabla_posiciones t
     where t.division_id = p_division_id
  ),
  conteo as (
    select b.*, count(*) over (partition by b.pts, b.pg_desempate, b.dif_sets_desempate) as empatados
      from base b
  ),
  directo as (
    select c.*,
      case when c.empatados = 2 and exists (
        select 1 from public.partido p
         where p.division_id = p_division_id
           and p.estado in ('confirmado', 'resuelto')
           and p.ganador = c.usuario_id
           and (case when p.jugador_a = c.usuario_id then p.jugador_b else p.jugador_a end) in (
             select o.usuario_id from conteo o
              where o.pts = c.pts and o.pg_desempate = c.pg_desempate
                and o.dif_sets_desempate = c.dif_sets_desempate and o.usuario_id <> c.usuario_id
           )
      ) then 1 else 0 end as gano_directo
    from conteo c
  )
  select d.usuario_id, d.nombre, d.pts, d.pg_desempate, d.dif_sets_desempate,
         d.dif_sets, d.gano_directo, d.orden_manual,
         row_number() over (
           order by d.pts desc, d.pg_desempate desc, d.dif_sets_desempate desc,
                    d.gano_directo desc, d.dif_sets desc,
                    -- 0 es "sin decisión a mano" y tiene que ir al final, no al
                    -- principio, por eso el nullif.
                    nullif(d.orden_manual, 0) asc nulls last,
                    d.nombre
         )::int
  from directo d;
$fn$;

revoke execute on function public.orden_division(uuid) from public;
grant execute on function public.orden_division(uuid) to anon, authenticated;

create or replace function public.posiciones_division(p_division_id uuid)
returns table (usuario_id uuid, nombre text, pts int, pg_desempate int, posicion int)
language sql
stable
security definer
set search_path = public
as $fn$
  select o.usuario_id, o.nombre, o.pts, o.pg_desempate, o.posicion
  from public.orden_division(p_division_id) o;
$fn$;

-- -----------------------------------------------------------------------------
-- 3. Los empates que bloquean el cierre, y qué hacer con cada uno.
--
-- Antes devolvía cualquier empate en puntos y desempates, y la única salida
-- ofrecida era jugar más partidos. Ahora distingue dos situaciones:
--
--   accion = 'jugar'    · todavía no se jugaron desempates entre ellos.
--                         Es lo que manda el reglamento del club.
--   accion = 'decidir'  · ya se jugaron y ni el resultado, ni la diferencia de
--                         sets de esos partidos, ni el enfrentamiento directo,
--                         ni la diferencia de sets total los separan. Acá le
--                         toca al coordinador.
--
-- Un empate que algún criterio ya rompió deja de aparecer: el cierre no se
-- bloquea por algo que la tabla ya resolvió.
-- -----------------------------------------------------------------------------
drop function if exists public.empates_relevantes(uuid);
create function public.empates_relevantes(p_ranking_id uuid)
returns table (
  division_id uuid,
  division public.division_tipo,
  pts int,
  min_pos int,
  max_pos int,
  motivo text,
  accion text,
  usuarios uuid[],
  nombres text[]
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r public.ranking%rowtype;
  d record;
  n int;
  corte_descenso int;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;

  for d in select dv.id, dv.tipo from public.division dv where dv.ranking_id = p_ranking_id loop
    select count(*) into n from public.inscripcion i where i.division_id = d.id;
    corte_descenso := n - r.n_descienden;

    return query
    with pos as (select * from public.orden_division(d.id)),
    grupos as (
      -- Siguen empatados solo si coinciden en TODO lo que ordena la tabla.
      -- Si algún criterio los separó, el empate está resuelto.
      select p.pts as gpts, min(p.posicion) as mn, max(p.posicion) as mx,
             array_agg(p.usuario_id order by p.nombre) as us,
             array_agg(p.nombre order by p.nombre) as nb,
             bool_or(p.pg_desempate > 0) as jugaron_desempate
      from pos p
      group by p.pts, p.pg_desempate, p.dif_sets_desempate, p.gano_directo, p.dif_sets, p.orden_manual
      having count(*) > 1
    )
    select d.id, d.tipo, g.gpts, g.mn, g.mx,
      case
        when g.mn <= r.n_premiados then 'premio'
        when d.tipo = 'menor' then 'ascenso'
        else 'descenso'
      end,
      case
        when exists (
          select 1 from public.partido p
           where p.division_id = d.id and p.tipo = 'desempate'
             and p.estado in ('confirmado', 'resuelto')
             and p.jugador_a = any(g.us) and p.jugador_b = any(g.us)
        ) then 'decidir' else 'jugar'
      end,
      g.us, g.nb
    from grupos g
    where g.mn <= r.n_premiados
       or (d.tipo = 'menor' and g.mn <= r.n_ascienden and g.mx > r.n_ascienden)
       or (d.tipo = 'mayor' and g.mn <= corte_descenso and g.mx > corte_descenso);
  end loop;
end;
$fn$;

revoke execute on function public.empates_relevantes(uuid) from public, anon;
grant execute on function public.empates_relevantes(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. La decisión a mano.
--
-- Solo se puede usar cuando ya se jugaron los desempates y siguen empatados:
-- es el último recurso, no un atajo para saltarse los partidos. El motivo es
-- obligatorio y de al menos diez caracteres porque esto reparte premios y
-- descensos, y dentro de un semestre alguien va a preguntar por qué.
-- -----------------------------------------------------------------------------
create or replace function public.decidir_empate(
  p_division_id uuid, p_orden uuid[], p_motivo text
)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_yo uuid := auth.uid();
  v_ranking_id uuid;
  v_grupo record;
  v_encontrado boolean := false;
  i int;
begin
  perform public.exigir_coordinador();
  if array_length(p_orden, 1) is null or array_length(p_orden, 1) < 2 then
    raise exception 'Hay que pasar al menos dos jugadores, en el orden que quedan';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'Escribí por qué se decidió así; esto reparte premios y descensos';
  end if;

  select ranking_id into v_ranking_id from public.division where id = p_division_id;
  if v_ranking_id is null then raise exception 'División no existe'; end if;
  if (select estado from public.ranking where id = v_ranking_id) = 'cerrado' then
    raise exception 'El ranking ya está cerrado';
  end if;

  -- Tiene que ser exactamente un empate que el sistema reporta como 'decidir'.
  for v_grupo in select * from public.empates_relevantes(v_ranking_id) loop
    if v_grupo.division_id = p_division_id
       and v_grupo.accion = 'decidir'
       and v_grupo.usuarios @> p_orden and p_orden @> v_grupo.usuarios then
      v_encontrado := true;
    end if;
  end loop;
  if not v_encontrado then
    raise exception 'Ese grupo no es un empate pendiente de decidir. Primero hay que jugar los desempates, y solo si siguen iguales se decide a mano';
  end if;

  for i in 1 .. array_length(p_orden, 1) loop
    insert into public.desempate_manual (division_id, usuario_id, orden, motivo, decidido_por)
    values (p_division_id, p_orden[i], i, btrim(p_motivo), v_yo)
    on conflict (division_id, usuario_id) do update
      set orden = excluded.orden, motivo = excluded.motivo,
          decidido_por = excluded.decidido_por, decidido_en = now();
  end loop;

  return array_length(p_orden, 1);
end;
$fn$;

revoke execute on function public.decidir_empate(uuid, uuid[], text) from public, anon;
grant execute on function public.decidir_empate(uuid, uuid[], text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Generar desempates solo para los que todavía tienen que jugar.
-- -----------------------------------------------------------------------------
create or replace function public.generar_desempates(p_ranking_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.ranking%rowtype;
  g record;
  v_ronda int;
  v_creados int := 0;
  v_pendientes int;
  v_nuevas int;
  i int; k int;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado not in ('fase_regular_cerrada', 'en_desempates') then
    raise exception 'Primero cerrá la fase regular (estado: %)', r.estado;
  end if;

  select count(*) into v_pendientes
  from public.partido p join public.division d on d.id = p.division_id
  where d.ranking_id = p_ranking_id and p.tipo = 'desempate'
    and p.estado in ('pendiente', 'jugado', 'disputado');
  if v_pendientes > 0 then
    raise exception 'Todavía hay % desempates sin definir', v_pendientes;
  end if;

  for g in select * from public.empates_relevantes(p_ranking_id) where accion = 'jugar' loop
    select coalesce(max(p.ronda), 0) + 1 into v_ronda
    from public.partido p where p.division_id = g.division_id and p.tipo = 'desempate';

    for i in 1 .. array_length(g.usuarios, 1) loop
      for k in i + 1 .. array_length(g.usuarios, 1) loop
        insert into public.partido (division_id, jugador_a, jugador_b, tipo, ronda)
        values (g.division_id, least(g.usuarios[i], g.usuarios[k]),
                greatest(g.usuarios[i], g.usuarios[k]), 'desempate', v_ronda)
        on conflict do nothing;
        -- Cuenta las que realmente entraron, no los intentos: antes sumaba
        -- siempre y el número que veía el coordinador era mentira.
        get diagnostics v_nuevas = row_count;
        v_creados := v_creados + v_nuevas;
      end loop;
    end loop;
  end loop;

  if v_creados = 0 then
    raise exception 'No hay empates que romper jugando. Si quedan empates, son de los que decide el coordinador';
  end if;
  update public.ranking set estado = 'en_desempates' where id = p_ranking_id;
  return v_creados;
end;
$fn$;

revoke execute on function public.generar_desempates(uuid) from public, anon;
grant execute on function public.generar_desempates(uuid) to authenticated;
