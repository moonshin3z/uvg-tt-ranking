-- =============================================================================
-- Seed de desarrollo local (solo `supabase db reset`; NUNCA en producción).
-- Crea un coordinador y 8 jugadores con PIN 123456, un semestre con el
-- ranking 1 (queda CERRADO) con dos divisiones y algunos partidos, para poder
-- armar el ranking 2 desde el panel del coordinador.
--
-- Login local:  carnet 20001 / PIN 123456  (coordinador)
--               carnet 20002 / PIN 123456  (jugador, división mayor)
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
  update public.partido set estado = 'confirmado', ganador = j2, sets_a = case when a = j2 then 3 else 1 end,
    sets_b = case when b = j2 then 3 else 1 end, registrado_por = j2, registrado_en = now(), confirmado_por = j3, confirmado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  a := least(j2, j4); b := greatest(j2, j4);
  update public.partido set estado = 'confirmado', ganador = j2, sets_a = case when a = j2 then 3 else 2 end,
    sets_b = case when b = j2 then 3 else 2 end, registrado_por = j4, registrado_en = now(), confirmado_por = j2, confirmado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  a := least(j3, j4); b := greatest(j3, j4);
  update public.partido set estado = 'jugado', ganador = j3,
    sets_a = case when a = j3 then 3 else 0 end, sets_b = case when b = j3 then 3 else 0 end,
    registrado_por = j3, registrado_en = now()
  where division_id = d_mayor and jugador_a = a and jugador_b = b;

  -- Se deja CERRADO para que en desarrollo se pueda crear y armar el
  -- siguiente ranking desde el panel del coordinador (fase 2).
  update public.ranking set estado = 'cerrado', cerrado_en = now() where id = rk;
end;
$$;
