-- =============================================================================
-- Orden de la tabla, clasificación de grupos y deshacer un retiro.
--
-- Decisiones del club, tomadas por Iván el 17/09/2026:
--   · Criterio de orden: puntos, después desempates ganados, después
--     enfrentamiento directo, después diferencia de sets. La diferencia de
--     puntos NO se usa: el detalle por set es opcional y no siempre está.
--   · Un empate que afecta premio, ascenso o descenso se rompe con un partido
--     aparte, como dice el reglamento del club. El enfrentamiento directo
--     ordena la tabla, no decide esos puestos.
--   · Al corregir un resultado de una llave, los partidos posteriores
--     desaparecen. Antes de borrarlos queda constancia en la bitácora del
--     partido corregido, para saber qué se fue.
--   · Un retiro se puede deshacer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reglas de juego configurables al crear el ranking.
--
-- El club juega al mejor de 3 a 11 puntos, pero todavía no está confirmado y
-- puede haber rankings a un set. Por eso son parámetros y no constantes.
-- -----------------------------------------------------------------------------
alter table public.ranking alter column sets_para_ganar set default 2;

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
  insert into public.ranking (
    semestre_id, numero, nombre, fecha_limite, pts_victoria, pts_derrota,
    n_ascienden, n_descienden, n_premiados, horas_autoconfirmacion,
    sets_para_ganar, puntos_por_set
  ) values (
    p_semestre_id, p_numero, btrim(p_nombre), p_fecha_limite, p_pts_victoria, p_pts_derrota,
    p_n_ascienden, p_n_descienden, p_n_premiados, p_horas_autoconfirmacion,
    coalesce(p_sets_para_ganar, 2), coalesce(p_puntos_por_set, 11)
  ) returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.crear_ranking(uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer, smallint, smallint) from public, anon;
grant execute on function public.crear_ranking(uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer, smallint, smallint) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. La tabla expone sets a favor y en contra.
--
-- Hacían falta para el criterio de diferencia de sets. Se agregan al final de
-- la vista, que es lo único que se puede hacer sin recrearla.
-- -----------------------------------------------------------------------------
create or replace view public.tabla_posiciones as
with regulares as (
  select p.division_id, p.jugador_a, p.jugador_b, p.ganador, p.sets_a, p.sets_b
  from public.partido p
  where p.tipo = 'regular' and p.estado in ('confirmado', 'resuelto')
),
desempates as (
  select p.division_id, p.ganador
  from public.partido p
  where p.tipo = 'desempate' and p.estado in ('confirmado', 'resuelto')
),
por_jugador as (
  select r.division_id, r.jugador_a as usuario_id, (r.ganador = r.jugador_a)::int as gano,
         coalesce(r.sets_a, 0) as sets_f, coalesce(r.sets_b, 0) as sets_c
  from regulares r
  union all
  select r.division_id, r.jugador_b, (r.ganador = r.jugador_b)::int,
         coalesce(r.sets_b, 0), coalesce(r.sets_a, 0)
  from regulares r
)
select
  i.division_id,
  d.ranking_id,
  d.tipo as division,
  i.usuario_id,
  u.carnet,
  u.nombre,
  count(pj.usuario_id)::int as pj,
  coalesce(sum(pj.gano), 0)::int as pg,
  (count(pj.usuario_id) - coalesce(sum(pj.gano), 0))::int as pp,
  (coalesce(sum(pj.gano), 0) * r.pts_victoria
     + (count(pj.usuario_id) - coalesce(sum(pj.gano), 0)) * r.pts_derrota)::int as pts,
  (select count(*) from desempates de
    where de.division_id = i.division_id and de.ganador = i.usuario_id)::int as pg_desempate,
  coalesce(sum(pj.sets_f), 0)::int as sets_f,
  coalesce(sum(pj.sets_c), 0)::int as sets_c,
  (coalesce(sum(pj.sets_f), 0) - coalesce(sum(pj.sets_c), 0))::int as dif_sets
from public.inscripcion i
join public.division d on d.id = i.division_id
join public.ranking r on r.id = d.ranking_id
join public.usuario u on u.id = i.usuario_id
left join por_jugador pj on pj.division_id = i.division_id and pj.usuario_id = i.usuario_id
group by i.division_id, d.ranking_id, d.tipo, i.usuario_id, u.carnet, u.nombre, r.pts_victoria, r.pts_derrota;

-- -----------------------------------------------------------------------------
-- 3. El orden de una división, en un solo lugar.
--
-- Antes la base ordenaba por puntos, desempates y nombre, y la portada además
-- aplicaba enfrentamiento directo. Eran dos órdenes distintos para la misma
-- tabla. Este es el único.
--
-- El enfrentamiento directo solo decide cuando el empate es de exactamente
-- dos: con tres o más no hay un ganador entre todos, y ahí el reglamento manda
-- jugar partidos aparte.
-- -----------------------------------------------------------------------------
create or replace function public.orden_division(p_division_id uuid)
returns table (
  usuario_id uuid, nombre text, pts int, pg_desempate int,
  dif_sets int, gano_directo int, posicion int
)
language sql
stable
security definer
set search_path = public
as $fn$
  with base as (
    select t.usuario_id, t.nombre, t.pts, t.pg_desempate, t.dif_sets
    from public.tabla_posiciones t
    where t.division_id = p_division_id
  ),
  conteo as (
    select b.*, count(*) over (partition by b.pts, b.pg_desempate) as empatados
    from base b
  ),
  directo as (
    select c.*,
      case when c.empatados = 2 and exists (
        select 1
          from public.partido p
         where p.division_id = p_division_id
           and p.estado in ('confirmado', 'resuelto')
           and p.ganador = c.usuario_id
           and (case when p.jugador_a = c.usuario_id then p.jugador_b else p.jugador_a end) in (
             select o.usuario_id from conteo o
              where o.pts = c.pts and o.pg_desempate = c.pg_desempate and o.usuario_id <> c.usuario_id
           )
      ) then 1 else 0 end as gano_directo
    from conteo c
  )
  select d.usuario_id, d.nombre, d.pts, d.pg_desempate, d.dif_sets, d.gano_directo,
         row_number() over (
           order by d.pts desc, d.pg_desempate desc, d.gano_directo desc, d.dif_sets desc, d.nombre
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
-- 4. Clasificación de grupos de un torneo.
--
-- Antes decía en el comentario que desempataba por diferencia de puntos, y en
-- realidad desempataba por orden alfabético: con los mismos partidos ganados y
-- la misma diferencia de sets, clasificaba quien tuviera el nombre antes en el
-- abecedario, y nadie se enteraba.
--
-- Ahora: partidos ganados, enfrentamiento directo (si el empate es de dos),
-- diferencia de sets, y recién al final el nombre. `empatado_sin_resolver`
-- avisa cuando el nombre fue lo único que decidió, para que el coordinador lo
-- sepa en vez de descubrirlo cuando alguien reclame.
-- -----------------------------------------------------------------------------
drop function if exists public.posiciones_grupo(uuid);
create function public.posiciones_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid, nombre text, pj int, pg int, pp int,
  sets_f int, sets_c int, dif_sets int, posicion int, empatado_sin_resolver boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  with jugados as (
    select p.jugador_a, p.jugador_b, p.ganador, p.sets_a, p.sets_b
    from public.partido p
    where p.grupo_id = p_grupo_id and p.estado in ('confirmado', 'resuelto')
  ),
  lado as (
    select j.jugador_a as usuario_id, (j.ganador = j.jugador_a)::int as gano,
           coalesce(j.sets_a, 0) as sf, coalesce(j.sets_b, 0) as sc from jugados j
    union all
    select j.jugador_b, (j.ganador = j.jugador_b)::int,
           coalesce(j.sets_b, 0), coalesce(j.sets_a, 0) from jugados j
  ),
  base as (
    select ti.usuario_id, u.nombre,
      coalesce(count(l.usuario_id), 0)::int as pj,
      coalesce(sum(l.gano), 0)::int as pg,
      (coalesce(count(l.usuario_id), 0) - coalesce(sum(l.gano), 0))::int as pp,
      coalesce(sum(l.sf), 0)::int as sets_f,
      coalesce(sum(l.sc), 0)::int as sets_c
    from public.torneo_inscripcion ti
    join public.usuario u on u.id = ti.usuario_id
    left join lado l on l.usuario_id = ti.usuario_id
    where ti.grupo_id = p_grupo_id
    group by ti.usuario_id, u.nombre
  ),
  conteo as (
    select b.*, (b.sets_f - b.sets_c) as dif_sets,
           count(*) over (partition by b.pg) as empatados
    from base b
  ),
  directo as (
    select c.*,
      case when c.empatados = 2 and exists (
        select 1 from public.partido p
         where p.grupo_id = p_grupo_id
           and p.estado in ('confirmado', 'resuelto')
           and p.ganador = c.usuario_id
           and (case when p.jugador_a = c.usuario_id then p.jugador_b else p.jugador_a end) in (
             select o.usuario_id from conteo o where o.pg = c.pg and o.usuario_id <> c.usuario_id
           )
      ) then 1 else 0 end as gano_directo
    from conteo c
  )
  select d.usuario_id, d.nombre, d.pj, d.pg, d.pp, d.sets_f, d.sets_c, d.dif_sets,
         row_number() over (
           order by d.pg desc, d.gano_directo desc, d.dif_sets desc, d.nombre
         )::int,
         -- Quedó alguien con los mismos partidos ganados y la misma diferencia
         -- de sets, y el enfrentamiento directo no lo resolvió.
         count(*) over (partition by d.pg, d.gano_directo, d.dif_sets) > 1
  from directo d;
$fn$;

revoke execute on function public.posiciones_grupo(uuid) from public;
grant execute on function public.posiciones_grupo(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Cerrar la fase de grupos.
--
-- Tres cosas que estaban mal:
--   · un partido anulado contaba como jugado, pero la clasificación lo excluye:
--     ese jugador competía con menos partidos que sus rivales;
--   · si un grupo tenía menos jugadores que los que clasifican, se llevaba los
--     que hubiera y seguía sin decir nada;
--   · si dos quedaban empatados sin criterio que los separara, clasificaba el
--     del nombre alfabéticamente anterior, en silencio.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_grupos(p_torneo_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t public.torneo%rowtype;
  g record;
  v_falta int;
  v_orden uuid[] := '{}';
  v_u uuid;
  v_chico record;
  v_empate record;
  pos int;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado <> 'en_juego' then raise exception 'El torneo "%" no está en juego', t.nombre; end if;
  if t.formato <> 'grupos_y_llave' then raise exception 'El torneo "%" no tiene fase de grupos', t.nombre; end if;
  if exists (select 1 from public.torneo_llave where torneo_id = p_torneo_id) then
    raise exception 'La llave de "%" ya está armada', t.nombre;
  end if;

  select count(*) into v_falta from public.partido
   where torneo_id = p_torneo_id and grupo_id is not null
     and estado not in ('confirmado', 'resuelto');
  if v_falta > 0 then
    raise exception 'Faltan % partidos de grupo por definir', v_falta;
  end if;

  select tg.id, count(ti.usuario_id) as n into v_chico
    from public.torneo_grupo tg
    left join public.torneo_inscripcion ti on ti.grupo_id = tg.id
   where tg.torneo_id = p_torneo_id
   group by tg.id having count(ti.usuario_id) < t.clasifican_por_grupo
   limit 1;
  if v_chico.id is not null then
    raise exception 'Un grupo tiene % jugadores y clasifican %: ajustá los grupos o cuántos clasifican',
      v_chico.n, t.clasifican_por_grupo;
  end if;

  for g in select id from public.torneo_grupo where torneo_id = p_torneo_id order by nombre loop
    select * into v_empate from public.posiciones_grupo(g.id)
     where empatado_sin_resolver and posicion <= t.clasifican_por_grupo + 1 limit 1;
    if v_empate.usuario_id is not null then
      raise exception 'En un grupo hay un empate que ni el enfrentamiento directo ni los sets rompen, y decide quién clasifica. Hay que jugar un partido de desempate antes de cerrar';
    end if;
  end loop;

  for pos in 1 .. t.clasifican_por_grupo loop
    for g in select id from public.torneo_grupo where torneo_id = p_torneo_id order by nombre loop
      select usuario_id into v_u from public.posiciones_grupo(g.id) where posicion = pos;
      if v_u is null then
        raise exception 'No pude sacar al clasificado % de un grupo', pos;
      end if;
      v_orden := v_orden || v_u;
    end loop;
  end loop;

  if array_length(v_orden, 1) < 2 then raise exception 'Hacen falta al menos 2 clasificados'; end if;
  perform public.construir_llave(p_torneo_id, v_orden);
  return array_length(v_orden, 1);
end;
$fn$;

revoke execute on function public.cerrar_grupos(uuid) from public, anon;
grant execute on function public.cerrar_grupos(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Corregir una llave deja constancia de lo que se borró.
--
-- Los partidos posteriores a una corrección desaparecen, que es lo que se
-- decidió: si el resultado estaba mal, lo que se jugó después no vale. Pero
-- `partido_evento` cae en cascada con el partido, así que se iba también la
-- bitácora. Ahora, antes de borrar, se anota en la bitácora del partido que se
-- corrigió qué partidos se llevó por delante.
-- -----------------------------------------------------------------------------
-- `limpiar_desde` borra el partido. Antes de hacerlo, anota en la bitácora del
-- partido que se está corrigiendo qué partidos se lleva por delante y con qué
-- resultado, porque `partido_evento` cae en cascada y esa historia se pierde.
create or replace function public.limpiar_desde(p_torneo_id uuid, p_ronda int, p_posicion int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_r    int  := p_ronda + 1;
  v_pos  int  := ceil(p_posicion / 2.0)::int;
  v_lado text := case when p_posicion % 2 = 1 then 'a' else 'b' end;
  l      public.torneo_llave%rowtype;
  v_origen uuid;
  pa     public.partido%rowtype;
begin
  select * into l from public.torneo_llave
   where torneo_id = p_torneo_id and ronda = v_r and posicion = v_pos for update;
  if l.id is null then return; end if;   -- era la final, no hay nada arriba

  -- Lo que este padre haya mandado más arriba tampoco vale ya
  if l.ganador is not null then
    perform public.limpiar_desde(p_torneo_id, v_r, v_pos);
  end if;

  if l.partido_id is not null then
    select partido_id into v_origen from public.torneo_llave
     where torneo_id = p_torneo_id and ronda = p_ronda and posicion = p_posicion;
    select * into pa from public.partido where id = l.partido_id;

    -- La constancia va en el partido que se corrigió, que es el que sobrevive.
    if v_origen is not null and pa.id is not null then
      insert into public.partido_evento (partido_id, actor, accion, antes, despues)
      values (v_origen, auth.uid(), 'anulo',
              public.partido_a_json(pa),
              jsonb_build_object(
                'nota', 'Se borró este partido de la ronda ' || v_r || ' porque cambió el resultado del que lo alimentaba',
                'ronda', v_r, 'posicion', v_pos));
    end if;

    delete from public.partido where id = l.partido_id;
  end if;

  if v_lado = 'a' then
    update public.torneo_llave set jugador_a = null, partido_id = null, ganador = null
     where id = l.id;
  else
    update public.torneo_llave set jugador_b = null, partido_id = null, ganador = null
     where id = l.id;
  end if;
end;
$fn$;

revoke execute on function public.limpiar_desde(uuid, int, int) from public, anon, authenticated;

-- 7. Un retiro se puede deshacer.
--
-- Antes era una puerta de una sola dirección: borraba la inscripción, anulaba
-- todos los partidos del jugador y borraba el detalle de sets. Un retiro por
-- error destruía los resultados de todos sus rivales sin ninguna vuelta atrás.
--
-- Primero: el retiro deja de borrar el detalle de sets, para que deshacerlo
-- devuelva el partido entero y no una versión mutilada.
-- -----------------------------------------------------------------------------
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.retirar_del_ranking(uuid, uuid, text)'::regprocedure) into v_def;
  v_def := replace(v_def,
    '    delete from public.set_partido where partido_id = p.id;',
    '    -- El detalle de sets se conserva: sin él, deshacer el retiro devolvería'
    || E'\n    -- un partido sin su marcador por set.');
  if v_def like '%delete from public.set_partido where partido_id = p.id;%' then
    raise exception 'No encontré el borrado de sets dentro de retirar_del_ranking; revisá a mano';
  end if;
  execute v_def;
end $$;

create or replace function public.deshacer_retiro(p_ranking_id uuid, p_usuario_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.ranking%rowtype;
  v_retiro public.retiro%rowtype;
  v_division_id uuid;
  v_yo uuid := auth.uid();
  e record;
  v_repuestos int := 0;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado = 'cerrado' then raise exception 'El ranking ya está cerrado'; end if;

  select * into v_retiro from public.retiro
   where ranking_id = p_ranking_id and usuario_id = p_usuario_id;
  if v_retiro.id is null then raise exception 'Ese jugador no está retirado de este ranking'; end if;

  select id into v_division_id from public.division
   where ranking_id = p_ranking_id and tipo = v_retiro.division;
  if v_division_id is null then raise exception 'La división del retiro ya no existe'; end if;

  insert into public.inscripcion (division_id, usuario_id, origen)
  values (v_division_id, p_usuario_id, 'manual')
  on conflict do nothing;

  -- Cada partido vuelve a como estaba justo antes de anularse, que es lo que
  -- guardó la bitácora al retirarlo.
  for e in
    select distinct on (ev.partido_id) ev.partido_id, ev.antes
      from public.partido_evento ev
      join public.partido p on p.id = ev.partido_id
      join public.division d on d.id = p.division_id
     where d.ranking_id = p_ranking_id
       and p_usuario_id in (p.jugador_a, p.jugador_b)
       and p.estado = 'anulado'
       and ev.accion = 'anulo'
       and ev.antes is not null
     order by ev.partido_id, ev.creado_en desc
  loop
    update public.partido set
      estado = (e.antes->>'estado')::public.partido_estado,
      ganador = nullif(e.antes->>'ganador', '')::uuid,
      sets_a = nullif(e.antes->>'sets_a', '')::smallint,
      sets_b = nullif(e.antes->>'sets_b', '')::smallint,
      resolucion = null,
      confirmado_por = nullif(e.antes->>'confirmado_por', '')::uuid,
      confirmado_en = nullif(e.antes->>'confirmado_en', '')::timestamptz
    where id = e.partido_id;

    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    values (e.partido_id, v_yo, 'resolvio',
            jsonb_build_object('estado', 'anulado', 'motivo', 'retiro del jugador'),
            (select public.partido_a_json(p.*) from public.partido p where p.id = e.partido_id));
    v_repuestos := v_repuestos + 1;
  end loop;

  delete from public.retiro where id = v_retiro.id;
  return v_repuestos;
end;
$fn$;

revoke execute on function public.deshacer_retiro(uuid, uuid) from public, anon;
grant execute on function public.deshacer_retiro(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Rearmar las divisiones limpia los retiros.
--
-- `armar_divisiones` borraba partidos, inscripciones y sorteo, pero no los
-- retiros, así que quedaban apuntando a una composición que ya no existía.
-- -----------------------------------------------------------------------------
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.armar_divisiones(uuid, jsonb, text)'::regprocedure) into v_def;
  v_def := replace(v_def,
    'delete from public.sorteo where ranking_id = p_ranking_id;',
    'delete from public.sorteo where ranking_id = p_ranking_id;'
    || E'\n  -- Los retiros son de la composición anterior; rearmar los deja sin sentido.'
    || E'\n  delete from public.retiro where ranking_id = p_ranking_id;');
  if v_def not like '%delete from public.retiro%' then
    raise exception 'No encontré el borrado del sorteo dentro de armar_divisiones; revisá a mano';
  end if;
  execute v_def;
end $$;
