-- =============================================================================
-- Pruebas de borrar y cancelar rankings y torneos, contra la base local.
--
--   npx supabase db reset
--   psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--        -v ON_ERROR_STOP=1 -f supabase/pruebas/bajas.sql
--
-- Esta es la única operación del sistema que no tiene vuelta atrás, así que lo
-- que se prueba acá no es tanto que borre: es que NO borre cuando no debe.
-- Todo corre dentro de una transacción que se revierte.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.como(p_carnet text) returns void language plpgsql as $$
declare v uuid;
begin
  select id into v from public.usuario where carnet = p_carnet;
  if v is null then raise exception 'No existe el usuario de prueba %', p_carnet; end if;
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
end; $$;

-- Exige que falle Y que el mensaje diga por qué. Sin lo segundo la prueba pasa
-- con cualquier error, incluido uno del armado de la prueba misma: así fue como
-- divisiones.sql estuvo un rato dando verde contra una base sin el arreglo.
create or replace function pg_temp.exige_error(p_sql text, p_texto text, p_que text)
returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if p_texto <> '' and position(lower(p_texto) in lower(v_msg)) = 0 then
      raise exception 'MAL: falló por otra razón (%), se esperaba algo sobre "%" · %', v_msg, p_texto, p_que;
    end if;
    return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

-- Un semestre nuevo cada vez: `ranking` es único por (semestre, numero) y el
-- numero solo puede ser 1 o 2, así que sin esto las pruebas chocan entre sí.
create or replace function pg_temp.semestre_nuevo() returns uuid
language plpgsql as $$
declare v_id uuid; v_n int;
begin
  select coalesce(count(*), 0) + 1 into v_n from public.semestre;
  insert into public.semestre (nombre, inicio, fin)
  values ('prueba-' || v_n, current_date + v_n * 400, current_date + v_n * 400 + 120)
  returning id into v_id;
  return v_id;
end; $$;

-- Un ranking en borrador, recién nacido, sin nadie adentro.
create or replace function pg_temp.ranking_nuevo(p_nombre text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.ranking (semestre_id, numero, nombre, fecha_limite, estado)
  values (pg_temp.semestre_nuevo(), 1, p_nombre, current_date + 30, 'borrador') returning id into v_id;
  insert into public.division (ranking_id, tipo) values (v_id, 'mayor'), (v_id, 'menor');
  return v_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Quién puede
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid;
begin
  v_r := pg_temp.ranking_nuevo('Para el jugador');
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(
    format('select public.eliminar_ranking(%L)', v_r), 'coordinador',
    'un jugador borró un ranking');
  perform pg_temp.exige_error(
    format('select public.cancelar_ranking(%L, %L)', v_r, 'porque sí'), 'coordinador',
    'un jugador canceló un ranking');
  reset role;
  if not exists (select 1 from public.ranking where id = v_r) then
    raise exception 'AGUJERO: el ranking desapareció';
  end if;
  delete from public.ranking where id = v_r;
  raise notice 'ok · un jugador no borra ni cancela rankings';
end $$;

-- ---------------------------------------------------------------------------
-- El caso que da nombre a todo esto: un ranking creado por equivocación
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid; v_n int;
begin
  v_r := pg_temp.ranking_nuevo('Me equivoqué');
  perform pg_temp.como('20001');
  perform public.eliminar_ranking(v_r, 'lo creé con el semestre equivocado');
  reset role;

  if exists (select 1 from public.ranking where id = v_r) then
    raise exception 'AGUJERO: no lo borró';
  end if;
  if exists (select 1 from public.division where ranking_id = v_r) then
    raise exception 'AGUJERO: quedaron divisiones huérfanas';
  end if;

  -- Lo importante: la bitácora NO se fue con él. Si `baja.objeto_id` fuera una
  -- FK con cascade, acá habría cero filas y nadie sabría nunca qué pasó.
  select count(*) into v_n from public.baja
   where objeto_id = v_r and accion = 'borrado' and tipo = 'ranking';
  if v_n <> 1 then
    raise exception 'AGUJERO: la bitácora del borrado se borró con el ranking (% filas)', v_n;
  end if;
  if not exists (select 1 from public.baja where objeto_id = v_r
                   and motivo = 'lo creé con el semestre equivocado'
                   and hecho_por = (select id from public.usuario where carnet = '20001')) then
    raise exception 'AGUJERO: la bitácora no guardó motivo ni autor';
  end if;
  raise notice 'ok · un ranking en borrador se borra, y el borrado queda anotado';
end $$;

-- ---------------------------------------------------------------------------
-- Lo que NO se borra
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid; v_d uuid; v_a uuid; v_b uuid;
begin
  v_r := pg_temp.ranking_nuevo('Con un partido jugado');
  select id into v_d from public.division where ranking_id = v_r and tipo = 'mayor';
  select id into v_a from public.usuario where carnet = '20002';
  select id into v_b from public.usuario where carnet = '20003';
  if v_a > v_b then select v_a, v_b into v_b, v_a; end if;
  insert into public.inscripcion (division_id, usuario_id, origen)
       values (v_d, v_a, 'manual'), (v_d, v_b, 'manual');
  insert into public.partido (division_id, jugador_a, jugador_b, estado, ganador, sets_a, sets_b)
       values (v_d, v_a, v_b, 'confirmado', v_a, 3, 1);
  update public.ranking set estado = 'abierto' where id = v_r;

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(
    format('select public.eliminar_ranking(%L)', v_r), 'resultado',
    'borró un ranking donde ya se jugó');
  reset role;

  if not exists (select 1 from public.ranking where id = v_r) then
    raise exception 'AGUJERO: lo borró igual';
  end if;
  if exists (select 1 from public.baja where objeto_id = v_r) then
    raise exception 'AGUJERO: anotó una baja que no ocurrió';
  end if;
  delete from public.ranking where id = v_r;
  raise notice 'ok · un ranking con un partido jugado no se borra';
end $$;

do $$
declare v_r uuid; v_d uuid; v_p uuid; v_a uuid; v_b uuid;
begin
  -- Partido todavía 'pendiente', pero con un marcador en vivo con puntos: hay
  -- dos personas jugando ahorita. Mirar solo partido.estado no lo ve.
  v_r := pg_temp.ranking_nuevo('Con marcador en vivo');
  select id into v_d from public.division where ranking_id = v_r and tipo = 'mayor';
  select id into v_a from public.usuario where carnet = '20002';
  select id into v_b from public.usuario where carnet = '20003';
  if v_a > v_b then select v_a, v_b into v_b, v_a; end if;
  insert into public.partido (division_id, jugador_a, jugador_b)
       values (v_d, v_a, v_b) returning id into v_p;
  insert into public.marcador (codigo, partido_id, nombre_a, nombre_b, dueno, puntos_a, puntos_b)
       values ('PRUEBA1', v_p, 'A', 'B', v_a, 7, 5);
  update public.ranking set estado = 'abierto' where id = v_r;

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(
    format('select public.eliminar_ranking(%L)', v_r), 'marcador',
    'borró un ranking con un marcador en vivo con puntos');
  reset role;
  delete from public.ranking where id = v_r;
  raise notice 'ok · un marcador con puntos anotados frena el borrado aunque el partido siga pendiente';
end $$;

do $$
declare v_r uuid;
begin
  select id into v_r from public.ranking where estado = 'cerrado' limit 1;
  perform pg_temp.como('20001');
  perform pg_temp.exige_error(
    format('select public.eliminar_ranking(%L)', v_r), 'cancelalo',
    'borró un ranking cerrado');
  perform pg_temp.exige_error(
    format('select public.cancelar_ranking(%L, %L)', v_r, 'ya no'), 'cerrado',
    'canceló un ranking cerrado');
  reset role;
  raise notice 'ok · un ranking cerrado no se borra ni se cancela';
end $$;

-- ---------------------------------------------------------------------------
-- Cancelar
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid; v_sem uuid;
begin
  v_r := pg_temp.ranking_nuevo('Se canceló');
  update public.ranking set estado = 'abierto' where id = v_r;
  perform pg_temp.como('20001');

  perform pg_temp.exige_error(
    format('select public.cancelar_ranking(%L, %L)', v_r, '   '), 'por qué',
    'canceló sin motivo');

  perform public.cancelar_ranking(v_r, 'se armó con las divisiones al revés');
  reset role;

  if (select estado::text from public.ranking where id = v_r) <> 'cancelado' then
    raise exception 'AGUJERO: no quedó cancelado';
  end if;
  if not exists (select 1 from public.baja where objeto_id = v_r and accion = 'cancelado') then
    raise exception 'AGUJERO: la cancelación no quedó anotada';
  end if;

  -- Y el punto de cancelar: deja el camino libre para el que lo reemplaza.
  v_sem := pg_temp.semestre_nuevo();
  perform pg_temp.como('20001');
  perform public.crear_ranking(v_sem, 1::smallint, 'El bueno', (current_date + 30)::date);
  reset role;
  raise notice 'ok · cancelar saca el ranking del camino y deja crear el que lo reemplaza';
end $$;

-- ---------------------------------------------------------------------------
-- El guarda que la migración 27 se había llevado por delante
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid; v_sem uuid;
begin
  v_r := pg_temp.ranking_nuevo('En curso');
  update public.ranking set estado = 'abierto' where id = v_r;
  v_sem := pg_temp.semestre_nuevo();

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(
    format('select public.crear_ranking(%L, 1::smallint, %L, %L::date)', v_sem, 'El segundo', current_date + 30),
    'en curso',
    'creó un segundo ranking con uno abierto');
  reset role;
  delete from public.ranking where id = v_r;
  raise notice 'ok · no se crean dos rankings en curso a la vez';
end $$;

-- ---------------------------------------------------------------------------
-- El historial del jugador no muestra lo cancelado
-- ---------------------------------------------------------------------------
do $$
declare v_r uuid; v_d uuid; v_j uuid; v_antes int; v_despues int;
begin
  select id into v_j from public.usuario where carnet = '20002';
  select count(*) into v_antes from public.historial_jugador(v_j);

  v_r := pg_temp.ranking_nuevo('Cancelado con gente adentro');
  select id into v_d from public.division where ranking_id = v_r and tipo = 'mayor';
  insert into public.inscripcion (division_id, usuario_id, origen) values (v_d, v_j, 'manual');
  update public.ranking set estado = 'abierto' where id = v_r;

  perform pg_temp.como('20001');
  perform public.cancelar_ranking(v_r, 'se canceló el semestre');
  reset role;

  select count(*) into v_despues from public.historial_jugador(v_j);
  if v_despues <> v_antes then
    raise exception 'AGUJERO: un ranking cancelado aparece en el historial (% vs %)', v_despues, v_antes;
  end if;
  delete from public.ranking where id = v_r;
  raise notice 'ok · un ranking cancelado no aparece en el historial del jugador';
end $$;

-- ---------------------------------------------------------------------------
-- Torneos
-- ---------------------------------------------------------------------------
do $$
declare v_t uuid; v_n int;
begin
  insert into public.torneo (semestre_id, nombre, formato, fecha, estado)
       values ((select id from public.semestre order by inicio limit 1),
               'Torneo de prueba', 'llave', current_date + 7, 'inscripcion')
    returning id into v_t;
  insert into public.torneo_inscripcion (torneo_id, usuario_id)
       select v_t, id from public.usuario where carnet in ('20002', '20003');

  perform pg_temp.como('20002');
  perform pg_temp.exige_error(
    format('select public.eliminar_torneo(%L)', v_t), 'coordinador',
    'un jugador borró un torneo');
  reset role;

  perform pg_temp.como('20001');
  perform public.eliminar_torneo(v_t, 'lo creé dos veces');
  reset role;

  if exists (select 1 from public.torneo where id = v_t) then
    raise exception 'AGUJERO: no lo borró';
  end if;
  if exists (select 1 from public.torneo_inscripcion where torneo_id = v_t) then
    raise exception 'AGUJERO: quedaron inscripciones huérfanas';
  end if;
  select count(*) into v_n from public.baja where objeto_id = v_t and accion = 'borrado';
  if v_n <> 1 then raise exception 'AGUJERO: el borrado del torneo no quedó anotado'; end if;
  raise notice 'ok · un torneo en inscripción se borra con todo lo que cuelga, y queda anotado';
end $$;

do $$
declare v_t uuid;
begin
  -- El del seed: está en juego y con la fase de grupos jugada.
  select id into v_t from public.torneo where nombre = 'Copa UVG';
  perform pg_temp.como('20001');
  perform pg_temp.exige_error(
    format('select public.eliminar_torneo(%L)', v_t), 'resultado',
    'borró un torneo donde ya se jugó');
  perform public.cancelar_torneo(v_t, 'se suspendió por la huelga');
  reset role;

  if (select estado::text from public.torneo where id = v_t) <> 'cancelado' then
    raise exception 'AGUJERO: no quedó cancelado';
  end if;
  raise notice 'ok · un torneo con partidos jugados no se borra, pero sí se cancela';
end $$;

rollback;
