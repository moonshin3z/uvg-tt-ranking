-- =============================================================================
-- Fase 5 · Que los torneos hablen como torneos
--
-- La migración de cimientos usó un atajo: `ranking_de_partido()` devolvía una
-- fila de ranking equivalente cuando el partido era de torneo, para no tocar
-- funciones ya probadas. Funcionaba, pero los mensajes de error decían
-- "ranking" en pantallas de torneo. Acá se quita el atajo.
--
-- De paso se arregla algo peor que encontró la revisión:
-- `autoconfirmar_vencidos` hacía un join interno con division y ranking, así
-- que los partidos de torneo NUNCA se autoconfirmaban. La regla de las horas
-- quedaba muerta en torneo sin que nada avisara.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- El contenedor real de un partido: o un ranking o un torneo.
-- Devuelve el nombre para poder decirlo en los mensajes.
-- -----------------------------------------------------------------------------
create or replace function public.contenedor_de_partido(p_partido_id uuid)
returns table (clase text, nombre text, estado text, horas_autoconfirmacion smallint)
language sql
stable
security definer
set search_path = public
as $fn$
  select 'ranking'::text, rk.nombre, rk.estado::text, rk.horas_autoconfirmacion::smallint
    from public.partido p
    join public.division d on d.id = p.division_id
    join public.ranking rk on rk.id = d.ranking_id
   where p.id = p_partido_id
  union all
  select 'torneo'::text, t.nombre, t.estado::text, t.horas_autoconfirmacion
    from public.partido p
    join public.torneo t on t.id = p.torneo_id
   where p.id = p_partido_id;
$fn$;

-- -----------------------------------------------------------------------------
-- ¿Se puede jugar / registrar este partido ahora mismo?
-- Cada clase de contenedor tiene sus estados y su vocabulario.
-- -----------------------------------------------------------------------------
create or replace function public.exigir_partido_jugable(p_partido_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  c record;
  v_tipo public.partido_tipo;
begin
  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;

  select tipo into v_tipo from public.partido where id = p_partido_id;

  if c.clase = 'ranking' then
    if c.estado not in ('abierto', 'en_desempates') then
      raise exception 'El ranking no está en juego';
    end if;
    if v_tipo = 'desempate' and c.estado <> 'en_desempates' then
      raise exception 'Los desempates se juegan al cerrar la fase regular';
    end if;
  else
    if c.estado = 'borrador' then
      raise exception 'El torneo "%" todavía no se arma', c.nombre;
    elsif c.estado = 'inscripcion' then
      raise exception 'El torneo "%" todavía está en inscripción', c.nombre;
    elsif c.estado = 'cerrado' then
      raise exception 'El torneo "%" ya terminó', c.nombre;
    end if;
  end if;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- ¿El coordinador todavía puede corregir este partido?
-- -----------------------------------------------------------------------------
create or replace function public.exigir_partido_editable(p_partido_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare c record;
begin
  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;
  if c.estado = 'cerrado' then
    if c.clase = 'ranking' then
      raise exception 'El ranking ya está cerrado';
    else
      raise exception 'El torneo "%" ya terminó', c.nombre;
    end if;
  end if;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- registrar_resultado: mismo cuerpo probado, solo cambia el guarda del contenedor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_resultado(p_partido_id uuid, p_sets_a smallint, p_sets_b smallint, p_puntos jsonb DEFAULT NULL::jsonb)
 RETURNS partido
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_coord boolean := public.es_coordinador();
  v_ganador uuid;
  v_antes jsonb;
  v_accion public.evento_accion;
  v_gana_a smallint := 0;
  v_gana_b smallint := 0;
  s jsonb;
  i int := 0;
begin
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;

  perform public.exigir_partido_jugable(p_partido_id);

  -- Sets obligatorios y coherentes
  if p_sets_a is null or p_sets_b is null then raise exception 'Poné cuántos sets ganó cada uno'; end if;
  if p_sets_a < 0 or p_sets_b < 0 then raise exception 'Los sets no pueden ser negativos'; end if;
  if p_sets_a = p_sets_b then raise exception 'Un partido no puede terminar empatado en sets'; end if;
  if greatest(p_sets_a, p_sets_b) > 4 then raise exception 'Máximo 4 sets ganados (al mejor de 7)'; end if;
  if p_sets_a + p_sets_b > 7 then raise exception 'Máximo 7 sets en total'; end if;

  v_ganador := case when p_sets_a > p_sets_b then p.jugador_a else p.jugador_b end;

  -- Quién puede registrar y en qué estado
  if not v_coord then
    if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
    if p.estado = 'pendiente' then
      v_accion := 'registro';
    elsif p.estado = 'jugado' and p.registrado_por = v_yo then
      v_accion := 'edito';
    else
      raise exception 'Este partido ya no se puede registrar (estado: %)', p.estado;
    end if;
  else
    if p.estado in ('confirmado', 'resuelto', 'anulado') then
      raise exception 'Usá resolver o anular para cambiar un partido %', p.estado;
    end if;
    v_accion := case when p.estado = 'pendiente' then 'registro' else 'edito' end;
  end if;

  -- Puntos por set (opcionales); si vienen, deben cuadrar con los sets
  delete from public.set_partido where partido_id = p.id;
  if p_puntos is not null and jsonb_typeof(p_puntos) = 'array' and jsonb_array_length(p_puntos) > 0 then
    if jsonb_array_length(p_puntos) <> p_sets_a + p_sets_b then
      raise exception 'Pusiste % sets con puntos pero el marcador dice % sets',
        jsonb_array_length(p_puntos), p_sets_a + p_sets_b;
    end if;
    for s in select * from jsonb_array_elements(p_puntos) loop
      i := i + 1;
      if (s->>0)::int = (s->>1)::int then raise exception 'El set % no puede quedar empatado', i; end if;
      insert into public.set_partido (partido_id, numero, puntos_a, puntos_b)
      values (p.id, i, (s->>0)::smallint, (s->>1)::smallint);
      if (s->>0)::int > (s->>1)::int then v_gana_a := v_gana_a + 1; else v_gana_b := v_gana_b + 1; end if;
    end loop;
    if v_gana_a <> p_sets_a or v_gana_b <> p_sets_b then
      raise exception 'Los puntos por set dan %-% y el marcador dice %-%', v_gana_a, v_gana_b, p_sets_a, p_sets_b;
    end if;
  end if;

  v_antes := public.partido_a_json(p);

  update public.partido set
    ganador = v_ganador,
    sets_a = p_sets_a,
    sets_b = p_sets_b,
    registrado_por = v_yo,
    registrado_en = now(),
    estado = case when v_coord then 'confirmado'::public.partido_estado else 'jugado'::public.partido_estado end,
    confirmado_por = case when v_coord then v_yo else null end,
    confirmado_en = case when v_coord then now() else null end,
    disputa_motivo = null
  where id = p.id
  returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, v_accion, v_antes, public.partido_a_json(p));
  if v_coord then
    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    values (p.id, v_yo, 'confirmo', null, public.partido_a_json(p));
  end if;

  return p;
end;
$function$;

-- -----------------------------------------------------------------------------
-- resolver_partido: mismo cuerpo probado, solo cambia el guarda del contenedor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolver_partido(p_partido_id uuid, p_ganador uuid, p_nota text)
 RETURNS partido
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
  v_invierte boolean;
begin
  perform public.exigir_coordinador();
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  perform public.exigir_partido_editable(p_partido_id);
  if p_ganador is null then raise exception 'Elegí un ganador (o usá anular)'; end if;
  if p_ganador not in (p.jugador_a, p.jugador_b) then
    raise exception 'El ganador debe ser uno de los dos jugadores';
  end if;

  v_antes := public.partido_a_json(p);
  v_invierte := p.ganador is not null and p.ganador <> p_ganador;

  update public.partido set
    estado = 'resuelto',
    ganador = p_ganador,
    -- sin resultado previo: 1-0 simbólico; si invierte: se dan vuelta los sets
    sets_a = case
      when p.sets_a is null then (case when p_ganador = p.jugador_a then 1 else 0 end)::smallint
      when v_invierte then p.sets_b
      else p.sets_a end,
    sets_b = case
      when p.sets_b is null then (case when p_ganador = p.jugador_b then 1 else 0 end)::smallint
      when v_invierte then p.sets_a
      else p.sets_b end,
    resolucion = left(coalesce(p_nota, ''), 500),
    confirmado_por = v_yo,
    confirmado_en = now()
  where id = p.id
  returning * into p;

  if v_invierte or v_antes->>'sets_a' is null then
    delete from public.set_partido where partido_id = p.id;
  end if;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'resolvio', v_antes, public.partido_a_json(p));
  return p;
end;
$function$;

-- -----------------------------------------------------------------------------
-- anular_partido: mismo cuerpo probado, solo cambia el guarda del contenedor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anular_partido(p_partido_id uuid, p_nota text)
 RETURNS partido
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
begin
  perform public.exigir_coordinador();
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  perform public.exigir_partido_editable(p_partido_id);

  v_antes := public.partido_a_json(p);
  update public.partido set
    estado = 'anulado', ganador = null, sets_a = null, sets_b = null,
    resolucion = left(coalesce(p_nota, ''), 500), confirmado_por = v_yo, confirmado_en = now()
  where id = p.id
  returning * into p;
  delete from public.set_partido where partido_id = p.id;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'anulo', v_antes, public.partido_a_json(p));
  return p;
end;
$function$;


-- -----------------------------------------------------------------------------
-- `ranking_de_partido` vuelve a ser lo que su nombre dice: el ranking de un
-- partido de ranking, y nada para un partido de torneo. Ya nadie depende de la
-- fila sintética.
-- -----------------------------------------------------------------------------
create or replace function public.ranking_de_partido(p_partido_id uuid)
returns public.ranking
language sql
stable
security definer
set search_path = public
as $fn$
  select r.* from public.ranking r
  join public.division d on d.ranking_id = r.id
  join public.partido p on p.division_id = d.id
  where p.id = p_partido_id;
$fn$;
revoke execute on function public.ranking_de_partido(uuid) from public, anon;

-- -----------------------------------------------------------------------------
-- Autoconfirmación: ahora cubre ranking Y torneo.
--
-- Antes el join interno con division dejaba fuera todo partido de torneo, así
-- que las horas de espera no se cumplían nunca ahí. Se usa el contenedor.
-- -----------------------------------------------------------------------------
create or replace function public.autoconfirmar_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_n integer;
begin
  with vencidos as (
    select p.id
    from public.partido p
    cross join lateral public.contenedor_de_partido(p.id) c
    where p.estado = 'jugado'
      and c.horas_autoconfirmacion is not null
      and (
        (c.clase = 'ranking' and c.estado in ('abierto', 'en_desempates'))
        or (c.clase = 'torneo' and c.estado = 'en_juego')
      )
      and p.registrado_en + make_interval(hours => c.horas_autoconfirmacion) < now()
    for update of p skip locked
  ),
  actualizados as (
    update public.partido p set estado = 'confirmado', confirmado_por = null, confirmado_en = now()
    from vencidos v where p.id = v.id
    returning p.*
  ),
  eventos as (
    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    select a.id, null, 'autoconfirmo', jsonb_build_object('estado', 'jugado'), public.partido_a_json(a)
      from actualizados a
    returning 1
  )
  select count(*) into v_n from eventos;
  return coalesce(v_n, 0);
end;
$fn$;

revoke execute on function public.autoconfirmar_vencidos() from public, anon;
revoke execute on function public.contenedor_de_partido(uuid) from public, anon;
revoke execute on function public.exigir_partido_jugable(uuid) from public, anon;
revoke execute on function public.exigir_partido_editable(uuid) from public, anon;
