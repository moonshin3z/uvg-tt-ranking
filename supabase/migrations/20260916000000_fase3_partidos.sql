-- =============================================================================
-- Fase 3: registro, confirmación y disputa de resultados.
-- Modelo de confianza (modo C): un resultado suma solo cuando está CONFIRMADO
-- por el rival, por el sistema tras el plazo, o RESUELTO por el coordinador.
-- Toda transición pasa por estas funciones y queda en partido_evento.
-- =============================================================================

alter table public.partido add column if not exists disputa_motivo text;

-- -----------------------------------------------------------------------------
-- Helpers internos
-- -----------------------------------------------------------------------------
create or replace function public.partido_a_json(p public.partido)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'estado', p.estado, 'ganador', p.ganador, 'sets_a', p.sets_a, 'sets_b', p.sets_b,
    'registrado_por', p.registrado_por, 'confirmado_por', p.confirmado_por, 'resolucion', p.resolucion
  );
$$;

create or replace function public.ranking_de_partido(p_partido_id uuid)
returns public.ranking
language sql
stable
security definer
set search_path = public
as $$
  select r.* from public.ranking r
  join public.division d on d.ranking_id = r.id
  join public.partido p on p.division_id = d.id
  where p.id = p_partido_id;
$$;

-- -----------------------------------------------------------------------------
-- Registrar (o corregir) un resultado.
-- p_sets: opcional, [[pa, pb], [pa, pb], ...] con puntos de cada set.
-- Jugador: solo en partidos donde juega; corrige solo su propio registro en JUGADO.
-- Coordinador: en cualquier partido; nace CONFIRMADO (confirmado_por = él).
-- -----------------------------------------------------------------------------
create or replace function public.registrar_resultado(
  p_partido_id uuid,
  p_ganador uuid,
  p_sets jsonb default null
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
  v_sets_a smallint := null;
  v_sets_b smallint := null;
  v_antes jsonb;
  v_accion public.evento_accion;
  s jsonb;
  i int := 0;
begin
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  r := public.ranking_de_partido(p_partido_id);
  if r.estado not in ('abierto', 'en_desempates') then raise exception 'El ranking no está en juego'; end if;
  if p.tipo = 'desempate' and r.estado <> 'en_desempates' then raise exception 'Los desempates se juegan al cerrar la fase regular'; end if;
  if p_ganador not in (p.jugador_a, p.jugador_b) then raise exception 'El ganador debe ser uno de los dos jugadores'; end if;

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
      raise exception 'Usá "resolver" para cambiar un partido % ', p.estado;
    end if;
    v_accion := case when p.estado = 'pendiente' then 'registro' else 'edito' end;
  end if;

  -- Sets opcionales
  if p_sets is not null and jsonb_typeof(p_sets) = 'array' and jsonb_array_length(p_sets) > 0 then
    if jsonb_array_length(p_sets) > 7 then raise exception 'Máximo 7 sets'; end if;
    v_sets_a := 0; v_sets_b := 0;
    delete from public.set_partido where partido_id = p.id;
    for s in select * from jsonb_array_elements(p_sets) loop
      i := i + 1;
      if (s->>0)::int = (s->>1)::int then raise exception 'El set % no puede quedar empatado', i; end if;
      insert into public.set_partido (partido_id, numero, puntos_a, puntos_b)
      values (p.id, i, (s->>0)::smallint, (s->>1)::smallint);
      if (s->>0)::int > (s->>1)::int then v_sets_a := v_sets_a + 1; else v_sets_b := v_sets_b + 1; end if;
    end loop;
    if (v_sets_a > v_sets_b and p_ganador <> p.jugador_a) or (v_sets_b > v_sets_a and p_ganador <> p.jugador_b) then
      raise exception 'Los sets no coinciden con el ganador elegido';
    end if;
  else
    delete from public.set_partido where partido_id = p.id;
  end if;

  v_antes := public.partido_a_json(p);

  update public.partido set
    ganador = p_ganador,
    sets_a = v_sets_a,
    sets_b = v_sets_b,
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
-- Confirmar: solo el OTRO jugador, solo en JUGADO.
-- -----------------------------------------------------------------------------
create or replace function public.confirmar_resultado(p_partido_id uuid)
returns public.partido
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
begin
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
  if p.estado <> 'jugado' then raise exception 'Solo se confirma un resultado registrado (estado: %)', p.estado; end if;
  if p.registrado_por = v_yo then raise exception 'No podés confirmar tu propio registro'; end if;

  v_antes := public.partido_a_json(p);
  update public.partido set estado = 'confirmado', confirmado_por = v_yo, confirmado_en = now()
  where id = p.id returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'confirmo', v_antes, public.partido_a_json(p));
  return p;
end;
$$;

-- -----------------------------------------------------------------------------
-- Disputar: cualquiera de los dos, en JUGADO o CONFIRMADO (incluso tras la
-- autoconfirmación). No puede disputar quien registró (él corrige/edita).
-- -----------------------------------------------------------------------------
create or replace function public.disputar_resultado(p_partido_id uuid, p_motivo text)
returns public.partido
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_antes jsonb;
begin
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Explicá brevemente el motivo'; end if;
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
  if p.estado not in ('jugado', 'confirmado') then raise exception 'No se puede disputar (estado: %)', p.estado; end if;
  if p.estado = 'jugado' and p.registrado_por = v_yo then raise exception 'Vos lo registraste; corregilo en vez de disputarlo'; end if;

  v_antes := public.partido_a_json(p);
  update public.partido set estado = 'disputado', disputa_motivo = left(trim(p_motivo), 500)
  where id = p.id returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'disputo', v_antes, public.partido_a_json(p) || jsonb_build_object('motivo', p.disputa_motivo));
  return p;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resolver (coordinador): fija ganador o anula. Cualquier estado salvo cerrado.
-- p_ganador null => anular.
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
begin
  perform public.exigir_coordinador();
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  r := public.ranking_de_partido(p_partido_id);
  if r.estado = 'cerrado' then raise exception 'El ranking ya está cerrado'; end if;
  if p_ganador is not null and p_ganador not in (p.jugador_a, p.jugador_b) then
    raise exception 'El ganador debe ser uno de los dos jugadores';
  end if;

  v_antes := public.partido_a_json(p);
  if p_ganador is null then
    update public.partido set estado = 'anulado', ganador = null, sets_a = null, sets_b = null,
      resolucion = left(coalesce(p_nota, ''), 500), confirmado_por = v_yo, confirmado_en = now()
    where id = p.id returning * into p;
    delete from public.set_partido where partido_id = p.id;
  else
    update public.partido set estado = 'resuelto', ganador = p_ganador,
      -- si invierte el ganador, los sets registrados ya no describen el resultado
      sets_a = case when p.ganador = p_ganador then p.sets_a else null end,
      sets_b = case when p.ganador = p_ganador then p.sets_b else null end,
      resolucion = left(coalesce(p_nota, ''), 500), confirmado_por = v_yo, confirmado_en = now()
    where id = p.id returning * into p;
    if p.sets_a is null then delete from public.set_partido where partido_id = p.id; end if;
  end if;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, (case when p_ganador is null then 'anulo' else 'resolvio' end)::public.evento_accion, v_antes, public.partido_a_json(p));
  return p;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autoconfirmación: partidos en JUGADO cuyo plazo venció. Idempotente.
-- La llama pg_cron cada hora (si está disponible) y también la app al cargar.
-- -----------------------------------------------------------------------------
create or replace function public.autoconfirmar_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with vencidos as (
    select p.id
    from public.partido p
    join public.division d on d.id = p.division_id
    join public.ranking r on r.id = d.ranking_id
    where p.estado = 'jugado'
      and r.estado in ('abierto', 'en_desempates')
      and r.horas_autoconfirmacion is not null
      and p.registrado_en + make_interval(hours => r.horas_autoconfirmacion) < now()
    for update of p skip locked
  ),
  actualizados as (
    update public.partido p set estado = 'confirmado', confirmado_por = null, confirmado_en = now()
    from vencidos v where p.id = v.id
    returning p.*
  ),
  eventos as (
    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    select a.id, null, 'autoconfirmo', jsonb_build_object('estado', 'jugado'), public.partido_a_json(a) from actualizados a
    returning 1
  )
  select count(*) into v_n from eventos;
  return coalesce(v_n, 0);
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('autoconfirmar-partidos', '15 * * * *', 'select public.autoconfirmar_vencidos()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible; la app llama autoconfirmar_vencidos() al cargar';
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.registrar_resultado(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.confirmar_resultado(uuid) from public, anon;
revoke execute on function public.disputar_resultado(uuid, text) from public, anon;
revoke execute on function public.resolver_partido(uuid, uuid, text) from public, anon;
revoke execute on function public.autoconfirmar_vencidos() from public, anon;
revoke execute on function public.ranking_de_partido(uuid) from public, anon;

-- set_partido debe ser visible en realtime junto con partido
alter publication supabase_realtime add table public.set_partido;
