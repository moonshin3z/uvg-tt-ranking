-- =============================================================================
-- El ciclo completo de un torneo, el mismo que dispara la pantalla del
-- coordinador: crear, abrir inscripción, inscribir, armar, jugar, cerrar
-- grupos y cerrar el torneo.
--
-- Las funciones sueltas ya estaban probadas, pero el ciclo entero no, y es
-- justo donde aparecen los errores de orden: cerrar grupos antes de que se
-- jueguen, armar dos veces, cerrar con partidos abiertos.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.como(p_carnet text) returns void language plpgsql as $$
declare v uuid;
begin
  select id into v from public.usuario where carnet = p_carnet;
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
end; $$;

-- El `raise` del final va FUERA del bloque que atrapa, si no se atrapa a sí
-- mismo y la prueba pasa siempre.
create or replace function pg_temp.exige_error(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

do $$
declare
  v_sem uuid; v_t uuid; v_orden uuid[]; v_n int;
  v_grupos int; v_llave int; v_camp uuid; p record;
begin
  select id into v_sem from public.semestre limit 1;
  perform pg_temp.como('20001');

  -- 1. Crear y abrir inscripción
  v_t := (public.crear_torneo(v_sem, 'Prueba de ciclo', 'grupos_y_llave',
                              current_date, 2::smallint, 11::smallint, 24::smallint)).id;

  -- Sin inscritos no se puede armar.
  perform pg_temp.exige_error(
    format('select public.armar_torneo(%L, %L, array[]::uuid[], 2::smallint)', v_t, 'semilla'),
    'armar un torneo sin inscritos');

  perform public.abrir_inscripcion_torneo(v_t);

  -- 2. Inscribir a los ocho jugadores de la semilla
  for p in select id from public.usuario where activo and carnet <> '20001' order by carnet limit 8 loop
    perform public.inscribir_en_torneo(v_t, p.id);
  end loop;

  select array_agg(usuario_id order by usuario_id), count(*)
    into v_orden, v_n
    from public.torneo_inscripcion where torneo_id = v_t;
  if v_n <> 8 then raise exception 'AGUJERO: quedaron % inscritos y debían ser 8', v_n; end if;

  -- Un orden con alguien que no está inscrito tiene que rebotar.
  perform pg_temp.exige_error(
    format('select public.armar_torneo(%L, %L, array[%L]::uuid[] || %L::uuid[], 2::smallint)',
           v_t, 'x', (select id from public.usuario where carnet = '20001'), v_orden),
    'armar con un jugador que no está inscrito');

  -- 3. Armar en dos grupos de cuatro
  perform public.armar_torneo(v_t, 'semilla-de-prueba', v_orden, 2::smallint);

  select count(*) into v_grupos from public.partido where torneo_id = v_t and tipo = 'grupo';
  -- Dos grupos de cuatro: 6 partidos cada uno.
  if v_grupos <> 12 then
    raise exception 'AGUJERO: salieron % partidos de grupo y debían ser 12', v_grupos;
  end if;

  -- 4. Cerrar grupos con partidos sin jugar tiene que fallar
  perform pg_temp.exige_error(format('select public.cerrar_grupos(%L)', v_t),
    'cerrar los grupos con partidos sin jugar');

  -- 5. Jugar todos los de grupo: gana siempre el jugador_a
  reset role;
  for p in select id, jugador_a from public.partido where torneo_id = v_t and tipo = 'grupo' loop
    update public.partido
       set estado = 'confirmado', ganador = p.jugador_a, sets_a = 2, sets_b = 0,
           confirmado_en = now()
     where id = p.id;
  end loop;
  perform pg_temp.como('20001');

  -- 6. Ahora sí, cerrar grupos arma la llave
  perform public.cerrar_grupos(v_t);
  select count(*) into v_llave from public.partido where torneo_id = v_t and tipo = 'llave';
  if v_llave < 1 then raise exception 'AGUJERO: cerrar los grupos no armó ningún partido de llave'; end if;

  -- 7. Cerrar el torneo con la llave abierta tiene que fallar
  perform pg_temp.exige_error(format('select public.cerrar_torneo(%L)', v_t),
    'cerrar el torneo con partidos de llave abiertos');

  raise notice 'ok · el ciclo del torneo respeta su orden (% de grupo, % de llave)', v_grupos, v_llave;
end $$;

rollback;
