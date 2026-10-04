-- =============================================================================
-- El calendario del club: el coordinador fija en qué semana va cada partido.
--
-- Con los 16 integrantes reales (5, 5 y 6) y las 35 filas de la hoja
-- «Calendario ajustado 35» del club. Donde la hoja dice «Joseph B.» va Joshep
-- y donde dice «Diego Q.» va wellington G, como quedó decidido.
--
-- Cada comprobación se corrió contra variantes rotas a propósito de la
-- migración y falla en ellas.
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

create temporary table socios (carnet text, nombre text, division int);
insert into socios values
    ('26230', 'Cristian M.', '1'),
    ('251002', 'Giancarlo R.', '1'),
    ('25238', 'Ivan R.', '1'),
    ('24470', 'Marvin F.', '1'),
    ('261319', 'Arturo S.', '1'),
    ('261550', 'Palma R.', '2'),
    ('24554', 'Marcelo D.', '2'),
    ('24988', 'Ian Q.', '2'),
    ('24258', 'Jose J.', '2'),
    ('21749', 'Andres M.', '2'),
    ('26658', 'Joshep', '3'),
    ('26917', 'wellington G', '3'),
    ('21977', 'Alfred A.', '3'),
    ('26967', 'Christofer A.', '3'),
    ('161231', 'Jhonatan m.', '3'),
    ('25522', 'Mirna', '3');

create temporary table hoja (semana int, a text, b text);
insert into hoja values
    (1, 'Giancarlo R.', 'Arturo S.'),
    (1, 'Ivan R.', 'Marvin F.'),
    (1, 'Marcelo D.', 'Andres M.'),
    (1, 'Ian Q.', 'Jose J.'),
    (2, 'Joshep', 'Mirna'),
    (2, 'wellington G', 'Jhonatan m.'),
    (2, 'Alfred A.', 'Christofer A.'),
    (2, 'Cristian M.', 'Arturo S.'),
    (2, 'Giancarlo R.', 'Ivan R.'),
    (3, 'Palma R.', 'Andres M.'),
    (3, 'Marcelo D.', 'Ian Q.'),
    (3, 'Joshep', 'Jhonatan m.'),
    (3, 'Mirna', 'Christofer A.'),
    (3, 'wellington G', 'Alfred A.'),
    (4, 'Cristian M.', 'Marvin F.'),
    (4, 'Arturo S.', 'Ivan R.'),
    (4, 'Palma R.', 'Jose J.'),
    (4, 'Andres M.', 'Ian Q.'),
    (5, 'Joshep', 'Christofer A.'),
    (5, 'Jhonatan m.', 'Alfred A.'),
    (5, 'Mirna', 'wellington G'),
    (5, 'Cristian M.', 'Ivan R.'),
    (5, 'Marvin F.', 'Giancarlo R.'),
    (6, 'Palma R.', 'Ian Q.'),
    (6, 'Jose J.', 'Marcelo D.'),
    (6, 'Joshep', 'Alfred A.'),
    (6, 'Christofer A.', 'wellington G'),
    (6, 'Jhonatan m.', 'Mirna'),
    (7, 'Cristian M.', 'Giancarlo R.'),
    (7, 'Marvin F.', 'Arturo S.'),
    (7, 'Palma R.', 'Marcelo D.'),
    (7, 'Jose J.', 'Andres M.'),
    (8, 'Joshep', 'wellington G'),
    (8, 'Alfred A.', 'Mirna'),
    (8, 'Christofer A.', 'Jhonatan m.');

-- Se leen también con el rol de la aplicación, al armar lo que se manda.
grant select on socios, hoja to authenticated;

-- Las filas de la hoja como las manda la aplicación: con los ids.
create or replace function pg_temp.filas(p_desde int default 1, p_hasta int default 99) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('jugador_a', ua.id, 'jugador_b', ub.id, 'semana', h.semana))
    from hoja h join public.usuario ua on ua.nombre = h.a join public.usuario ub on ub.nombre = h.b
   where h.semana between p_desde and p_hasta;
$$;

-- Preparación: los 16 socios, el ranking de 3 divisiones con 5, 5 y 6, y su calendario.
do $$
declare v_sem uuid; v_rk uuid; v_asig jsonb; x record;
begin
  for x in select * from socios loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      x.carnet || '@uvgtt.local', 'x', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('carnet', x.carnet, 'nombre', x.nombre),
      now(), now(), '', '', '', ''
    );
  end loop;

  select id into v_sem from public.semestre limit 1;
  delete from public.ranking where semestre_id = v_sem and numero = 2;

  perform pg_temp.como('20001');
  v_rk := public.crear_ranking(v_sem, 2::smallint, 'Club', current_date + 90);
  select jsonb_agg(jsonb_build_object('usuario_id', u.id, 'division', (array['primera','segunda','tercera'])[s.division]))
    into v_asig from socios s join public.usuario u on u.carnet = s.carnet;
  perform public.armar_divisiones(v_rk, v_asig, null);
  if public.generar_calendario(v_rk) <> 35 then raise exception 'La prueba no sirve: 5, 5 y 6 tienen que dar 35 partidos'; end if;
  reset role;
  raise notice 'ok · los 16 del club en 5, 5 y 6 dan 35 partidos';
end $$;

-- -----------------------------------------------------------------------------
-- 1. Cargado en borrador una parte (semanas 1 y 2), al abrir se respeta y el
--    resto se reparte, llenando también la semana en curso.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_n int;
begin
  select id into v_rk from public.ranking where nombre = 'Club';
  perform pg_temp.como('20001');
  v_n := public.fijar_calendario(v_rk, pg_temp.filas(1, 2));
  perform public.abrir_ranking(v_rk, date_trunc('week', public.hoy_guatemala())::date);
  reset role;

  if v_n <> 9 then raise exception 'AGUJERO: fijó % partidos y las semanas 1 y 2 de la hoja tienen 9', v_n; end if;
  if exists (
    select 1 from hoja h join public.usuario ua on ua.nombre = h.a join public.usuario ub on ub.nombre = h.b
      join public.partido p on p.jugador_a = least(ua.id, ub.id) and p.jugador_b = greatest(ua.id, ub.id)
     where h.semana <= 2 and (p.semana is distinct from h.semana or not p.semana_fija)
  ) then
    raise exception 'AGUJERO: al abrir se movió un partido que había fijado el calendario';
  end if;
  if (select count(*) from public.partido p join public.division d on d.id = p.division_id
       where d.ranking_id = v_rk and p.semana = 1) <> 5 then
    raise exception 'AGUJERO: la semana en curso quedó con los 4 fijos y sin llenar hasta 5';
  end if;
  if exists (select 1 from public.partido p join public.division d on d.id = p.division_id
              where d.ranking_id = v_rk and p.semana is null) then
    raise exception 'AGUJERO: quedaron partidos sin semana';
  end if;
  raise notice 'ok · lo cargado en borrador se respeta al abrir y el resto se reparte';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Ya abierto, la hoja entera: cada partido en su semana, 8 semanas de
--    4, 5, 5, 4, 5, 5, 4 y 3.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_n int; v_carga text;
begin
  select id into v_rk from public.ranking where nombre = 'Club';
  perform pg_temp.como('20001');
  v_n := public.fijar_calendario(v_rk, pg_temp.filas());
  reset role;
  if v_n <> 35 then raise exception 'AGUJERO: fijó % de 35', v_n; end if;

  if exists (
    select 1 from hoja h join public.usuario ua on ua.nombre = h.a join public.usuario ub on ub.nombre = h.b
      join public.partido p on p.jugador_a = least(ua.id, ub.id) and p.jugador_b = greatest(ua.id, ub.id)
     where p.semana is distinct from h.semana
  ) then
    raise exception 'AGUJERO: hay partidos en otra semana que la de la hoja';
  end if;

  select string_agg(c::text, ',' order by semana) into v_carga from (
    select p.semana, count(*) c from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = v_rk group by p.semana) x;
  if v_carga <> '4,5,5,4,5,5,4,3' then raise exception 'AGUJERO: la carga por semana quedó en %', v_carga; end if;
  raise notice 'ok · la hoja entera: cada partido en su semana, 4,5,5,4,5,5,4,3';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Lo que la hoja tenga mal se rechaza diciendo qué es, y un jugador no puede.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_cris uuid; v_palma uuid; v_ivan uuid; v_marvin uuid; v_arturo uuid;
begin
  select id into v_rk from public.ranking where nombre = 'Club';
  select id into v_cris from public.usuario where nombre = 'Cristian M.';
  select id into v_palma from public.usuario where nombre = 'Palma R.';
  select id into v_ivan from public.usuario where nombre = 'Ivan R.';
  select id into v_marvin from public.usuario where nombre = 'Marvin F.';
  select id into v_arturo from public.usuario where nombre = 'Arturo S.';

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(format('select public.fijar_calendario(%L, %L)', v_rk,
    jsonb_build_array(jsonb_build_object('jugador_a', v_cris, 'jugador_b', v_palma, 'semana', 1))),
    'no está en el calendario', 'Primera contra Segunda');
  perform pg_temp.exige_error(format('select public.fijar_calendario(%L, %L)', v_rk, jsonb_build_array(
    jsonb_build_object('jugador_a', v_cris, 'jugador_b', v_ivan, 'semana', 1),
    jsonb_build_object('jugador_a', v_cris, 'jugador_b', v_marvin, 'semana', 1))),
    'dos veces en la semana', 'Cristian dos veces en la semana 1');
  perform pg_temp.exige_error(format('select public.fijar_calendario(%L, %L)', v_rk, jsonb_build_array(
    jsonb_build_object('jugador_a', v_cris, 'jugador_b', v_ivan, 'semana', 1),
    jsonb_build_object('jugador_a', v_ivan, 'jugador_b', v_cris, 'semana', 3))),
    'veces en el calendario', 'el mismo partido dos veces');
  perform pg_temp.exige_error(format('select public.fijar_calendario(%L, %L)', v_rk,
    jsonb_build_array(jsonb_build_object('jugador_a', v_cris, 'jugador_b', v_arturo, 'semana', 0))),
    'sin semana', 'semana 0');
  reset role;

  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.fijar_calendario(%L, %L)', v_rk, pg_temp.filas()),
    'coordinador', 'un jugador cargando el calendario');
  reset role;
  raise notice 'ok · lo mal armado se rechaza diciendo qué, y solo el coordinador carga';
end $$;

-- -----------------------------------------------------------------------------
-- 4. Con la hoja cargada, adelantar un partido lo pasa a la semana en curso y
--    los demás siguen donde dice la hoja. Volver a cargar no lo mueve.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_p uuid;
begin
  select id into v_rk from public.ranking where nombre = 'Club';
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.semana = 5 limit 1;
  update public.partido set estado = 'jugado', ganador = jugador_a, sets_a = 2, sets_b = 0,
         registrado_por = jugador_a, registrado_en = now() where id = v_p;
  if (select semana from public.partido where id = v_p) <> 1 then
    raise exception 'AGUJERO: el partido adelantado siguió en la semana 5';
  end if;

  perform pg_temp.como('20001');
  perform public.fijar_calendario(v_rk, pg_temp.filas());
  reset role;
  if (select semana from public.partido where id = v_p) <> 1 then
    raise exception 'AGUJERO: volver a cargar la hoja movió un partido ya jugado';
  end if;
  if exists (
    select 1 from hoja h join public.usuario ua on ua.nombre = h.a join public.usuario ub on ub.nombre = h.b
      join public.partido p on p.jugador_a = least(ua.id, ub.id) and p.jugador_b = greatest(ua.id, ub.id)
     where p.id <> v_p and p.semana is distinct from h.semana
  ) then
    raise exception 'AGUJERO: al adelantar uno se movieron otros de la hoja';
  end if;
  raise notice 'ok · adelantar uno no mueve los demás de la hoja, y recargarla no mueve lo jugado';
end $$;

rollback;
