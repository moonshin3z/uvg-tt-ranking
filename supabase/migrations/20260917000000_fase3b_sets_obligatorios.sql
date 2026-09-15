-- =============================================================================
-- Fase 3b: el resultado se registra por SETS.
--
-- Cambio de regla: al registrar un partido es obligatorio decir cuántos sets
-- ganó cada uno (3-1, 3-2, ...). El ganador se DERIVA de ahí, ya no se elige.
-- Los puntos de cada set (11-7, 9-11, ...) siguen siendo opcionales.
--
-- También se separa "anular" de "resolver" para que cada función tenga
-- argumentos no nulos (los tipos generados por Supabase no admiten null).
-- =============================================================================

-- La firma cambia (antes: p_ganador uuid), así que hay que soltar la anterior.
drop function if exists public.registrar_resultado(uuid, uuid, jsonb);

-- -----------------------------------------------------------------------------
-- Registrar (o corregir) un resultado por sets.
-- p_sets_a / p_sets_b: sets ganados por jugador_a y jugador_b (orden canónico).
-- p_puntos: opcional, [[pa, pb], ...] con los puntos de cada set, en el mismo
--           orden canónico. Si viene, debe cuadrar con p_sets_a / p_sets_b.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_resultado(
  p_partido_id uuid,
  p_sets_a smallint,
  p_sets_b smallint,
  p_puntos jsonb default null
)
returns public.partido
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  r public.ranking%rowtype;
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

  r := public.ranking_de_partido(p_partido_id);
  if r.estado not in ('abierto', 'en_desempates') then raise exception 'El ranking no está en juego'; end if;
  if p.tipo = 'desempate' and r.estado <> 'en_desempates' then
    raise exception 'Los desempates se juegan al cerrar la fase regular';
  end if;

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
$$;

-- -----------------------------------------------------------------------------
-- Resolver (coordinador): fija el ganador. Si invierte el resultado, los sets
-- se invierten también y se borra el detalle de puntos (ya no describe nada).
-- -----------------------------------------------------------------------------
create or replace function public.resolver_partido(p_partido_id uuid, p_ganador uuid, p_nota text)
returns public.partido
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  r public.ranking%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
  v_invierte boolean;
begin
  perform public.exigir_coordinador();
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  r := public.ranking_de_partido(p_partido_id);
  if r.estado = 'cerrado' then raise exception 'El ranking ya está cerrado'; end if;
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
$$;

-- -----------------------------------------------------------------------------
-- Anular (coordinador): el partido no cuenta para la tabla.
-- -----------------------------------------------------------------------------
create or replace function public.anular_partido(p_partido_id uuid, p_nota text)
returns public.partido
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  r public.ranking%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
begin
  perform public.exigir_coordinador();
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  r := public.ranking_de_partido(p_partido_id);
  if r.estado = 'cerrado' then raise exception 'El ranking ya está cerrado'; end if;

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
$$;

-- -----------------------------------------------------------------------------
-- Integridad: un partido con resultado siempre trae sets.
-- -----------------------------------------------------------------------------
alter table public.partido drop constraint if exists partido_con_resultado_trae_sets;
alter table public.partido add constraint partido_con_resultado_trae_sets check (
  estado in ('pendiente', 'anulado') or (sets_a is not null and sets_b is not null)
);

revoke execute on function public.registrar_resultado(uuid, smallint, smallint, jsonb) from public, anon;
revoke execute on function public.anular_partido(uuid, text) from public, anon;
