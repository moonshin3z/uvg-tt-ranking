-- =============================================================================
-- Seed de desarrollo local (solo `supabase db reset`; NUNCA en producción).
-- Crea un coordinador y 8 jugadores con PIN 123456, un semestre con el
-- ranking 1 (queda CERRADO) con dos divisiones y algunos partidos, para poder
-- armar el ranking 2 desde el panel del coordinador.
--
-- Login local:  carnet 20001 / PIN 123456  (coordinador)
--               carnet 20002 / PIN 123456  (jugador, división mayor)
--
-- Estos usuarios entran directo, sin la pantalla de cambiar PIN. En producción
-- eso NO pasa: ahí `usuario.debe_cambiar_pin` arranca en true y el que crea el
-- coordinador tiene que cambiarlo antes de ver nada. Acá se apaga porque si no,
-- toda ruta con sesión rebota a /cambiar-pin y la auditoría de responsive
-- termina midiendo siete veces esa misma pantalla en vez de las de verdad.
-- =============================================================================

create or replace function pg_temp.crear_usuario(p_carnet text, p_nombre text, p_rol text, p_pin text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := p_carnet || '@uvgtt.local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('carnet', p_carnet, 'nombre', p_nombre, 'rol', p_rol),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  return v_id;
end;
$$;

do $$
declare
  coord uuid; j2 uuid; j3 uuid; j4 uuid; j5 uuid; j6 uuid; j7 uuid; j8 uuid; j9 uuid;
  sem uuid; rk uuid; d_mayor uuid; d_menor uuid;
  a uuid; b uuid;
  jugadores_mayor uuid[]; jugadores_menor uuid[];
  i int; k int;
begin
  coord := pg_temp.crear_usuario('20001', 'Coordinador Demo', 'coordinador', '123456');
  j2 := pg_temp.crear_usuario('20002', 'Ana López',        'jugador', '123456');
  j3 := pg_temp.crear_usuario('20003', 'Bruno Pérez',      'jugador', '123456');
  j4 := pg_temp.crear_usuario('20004', 'Carla Méndez',     'jugador', '123456');
  j5 := pg_temp.crear_usuario('20005', 'Diego Ramírez',    'jugador', '123456');
  j6 := pg_temp.crear_usuario('20006', 'Elena Castillo',   'jugador', '123456');
  j7 := pg_temp.crear_usuario('20007', 'Fernando Ruiz',    'jugador', '123456');
  j8 := pg_temp.crear_usuario('20008', 'Gabriela Soto',    'jugador', '123456');
  j9 := pg_temp.crear_usuario('EXT-01', 'Hugo Externo',    'jugador', '123456');

  insert into public.semestre (nombre, inicio, fin)
  values ('2026-2', '2026-07-13', '2026-11-27') returning id into sem;

  insert into public.ranking (semestre_id, numero, nombre, fecha_limite, estado)
  values (sem, 1, 'Ranking 1 · 2026-2', '2026-08-30', 'abierto') returning id into rk;

  insert into public.division (ranking_id, tipo) values (rk, 'mayor') returning id into d_mayor;
  insert into public.division (ranking_id, tipo) values (rk, 'menor') returning id into d_menor;

  jugadores_mayor := array[coord, j2, j3, j4];
  jugadores_menor := array[j5, j6, j7, j8, j9];

  foreach a in array jugadores_mayor loop
    insert into public.inscripcion (division_id, usuario_id, origen) values (d_mayor, a, 'sorteo');
  end loop;
  foreach a in array jugadores_menor loop
    insert into public.inscripcion (division_id, usuario_id, origen) values (d_menor, a, 'sorteo');
  end loop;

  insert into public.sorteo (ranking_id, semilla, ejecutado_por, resultado)
  values (rk, 'seed-demo', coord, jsonb_build_object('mayor', to_jsonb(jugadores_mayor), 'menor', to_jsonb(jugadores_menor)));

  -- Round robin completo (todos contra todos, una vez) en ambas divisiones
  for i in 1 .. array_length(jugadores_mayor, 1) loop
    for k in i + 1 .. array_length(jugadores_mayor, 1) loop
      insert into public.partido (division_id, jugador_a, jugador_b)
      values (d_mayor, least(jugadores_mayor[i], jugadores_mayor[k]), greatest(jugadores_mayor[i], jugadores_mayor[k]));
    end loop;
  end loop;
  for i in 1 .. array_length(jugadores_menor, 1) loop
    for k in i + 1 .. array_length(jugadores_menor, 1) loop
      insert into public.partido (division_id, jugador_a, jugador_b)
      values (d_menor, least(jugadores_menor[i], jugadores_menor[k]), greatest(jugadores_menor[i], jugadores_menor[k]));
    end loop;
  end loop;

  -- Algunos resultados confirmados en mayor para que la tabla no salga vacía
  a := least(j2, j3); b := greatest(j2, j3);
  update public.partido set estado = 'confirmado', ganador = j2, sets_a = case when a = j2 then 2 else 1 end,
    sets_b = case when b = j2 then 2 else 1 end, registrado_por = j2, registrado_en = now(), confirmado_por = j3, confirmado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  a := least(j2, j4); b := greatest(j2, j4);
  update public.partido set estado = 'confirmado', ganador = j2, sets_a = case when a = j2 then 2 else 0 end,
    sets_b = case when b = j2 then 2 else 0 end, registrado_por = j4, registrado_en = now(), confirmado_por = j2, confirmado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  a := least(j3, j4); b := greatest(j3, j4);
  update public.partido set estado = 'jugado', ganador = j3,
    sets_a = case when a = j3 then 2 else 0 end, sets_b = case when b = j3 then 2 else 0 end,
    registrado_por = j3, registrado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  -- Se deja CERRADO para que en desarrollo se pueda crear y armar el
  -- siguiente ranking desde el panel del coordinador (fase 2).
  update public.ranking set estado = 'cerrado', cerrado_en = now() where id = rk;

  -- Solo para desarrollo: ver la nota del encabezado.
  update public.usuario set debe_cambiar_pin = false;

  -- El rol ya no viaja en el metadata de auth (un cliente lo controla), así
  -- que todo perfil nace jugador. El primer coordinador tiene que nombrarse
  -- desde la base, acá y también en producción: sin uno, `asignar_rol` no
  -- tiene quién la llame.
  update public.usuario set rol = 'coordinador' where carnet = '20001';
end;
$$;

-- =============================================================================
-- Un torneo de ejemplo, de grupos y llave, a medio jugar.
--
-- Sin esto no hay forma de mirar la franja de la portada, el cuadro ni la
-- tabla de grupos sin armar un torneo a mano cada vez que se resetea la base.
-- El id es fijo a propósito: así `/torneos/<id>` es una ruta estable y la
-- auditoría de responsive la puede revisar como cualquier otra.
-- =============================================================================
do $$
declare
  t_id uuid := '11111111-2222-3333-4444-555555555555';
  sem uuid;
  coord uuid;
  jugadores uuid[];
  g record;
  p record;
  v_ganador uuid;
begin
  select id into sem from public.semestre limit 1;
  select id into coord from public.usuario where carnet = '20001';
  select array_agg(id order by carnet) into jugadores
    from public.usuario where carnet in ('20002','20003','20004','20005','20006','20007','20008','EXT-01');

  insert into public.torneo (
    id, semestre_id, nombre, formato, estado, fecha,
    sets_para_ganar, puntos_por_set, horas_autoconfirmacion,
    cant_grupos, clasifican_por_grupo, creado_por
  ) values (
    t_id, sem, 'Copa UVG', 'grupos_y_llave', 'inscripcion', current_date + 7,
    2, 11, 72, 2, 2, coord
  );

  insert into public.torneo_inscripcion (torneo_id, usuario_id)
  select t_id, u from unnest(jugadores) u;

  -- Armar deja el torneo en juego y crea los partidos de grupo.
  perform set_config('request.jwt.claim.sub', coord::text, true);
  perform public.armar_torneo(t_id, 'grupos_y_llave', jugadores, 2::smallint);

  -- Se juega toda la fase de grupos. Gana siempre el de carnet más bajo: da
  -- una tabla ordenada y predecible, que es lo que sirve para mirar el diseño.
  for p in select pa.id, pa.jugador_a, pa.jugador_b from public.partido pa
            where pa.torneo_id = t_id and pa.grupo_id is not null loop
    v_ganador := least(p.jugador_a, p.jugador_b);
    update public.partido set
      estado = 'confirmado', ganador = v_ganador,
      sets_a = case when jugador_a = v_ganador then 2 else 1 end,
      sets_b = case when jugador_b = v_ganador then 2 else 1 end,
      registrado_por = v_ganador, registrado_en = now(),
      confirmado_por = greatest(p.jugador_a, p.jugador_b), confirmado_en = now()
    where id = p.id;
  end loop;

  -- Cerrar los grupos arma la llave con los clasificados.
  perform public.cerrar_grupos(t_id);

  -- Y se juega la primera semifinal, para que el cuadro muestre a la vez una
  -- llave resuelta y una final a medio definir, como el prototipo.
  select pa.id, pa.jugador_a, pa.jugador_b into p
    from public.partido pa
    join public.torneo_llave l on l.partido_id = pa.id
   where l.torneo_id = t_id and l.ronda = 1
   order by l.posicion
   limit 1;
  if p.id is not null then
    v_ganador := least(p.jugador_a, p.jugador_b);
    update public.partido set
      estado = 'confirmado', ganador = v_ganador,
      sets_a = case when jugador_a = v_ganador then 2 else 0 end,
      sets_b = case when jugador_b = v_ganador then 2 else 0 end,
      registrado_por = v_ganador, registrado_en = now(),
      confirmado_por = greatest(p.jugador_a, p.jugador_b), confirmado_en = now()
    where id = p.id;
  end if;
end;
$$;
