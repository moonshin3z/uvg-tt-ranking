-- =============================================================================
-- Tres divisiones y partidos por semana.
--
-- El club juega en Primera, Segunda y Tercera, con 5 jugadores cada una; suben
-- y bajan 2 entre divisiones vecinas y premian a los 2 primeros de cada una.
-- Cada semana se juegan hasta 5 partidos en todo el club, nadie dos veces.
--
-- Cada comprobación se corrió también contra una variante rota a propósito de
-- la migración (sin el freno de jugadores ocupados, sin el disparador que pasa
-- un partido adelantado a su semana real, sin el freno de semanas pasadas) y
-- falla en esa variante.
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

-- En las semanas que reparte la app (de `p_desde` en adelante): ningún jugador
-- dos veces y ninguna con más de `p_max`. Las semanas anteriores pueden tener a
-- alguien dos veces si adelantó un partido, y eso es justamente lo permitido.
create or replace function pg_temp.revisar_semanas(p_rk uuid, p_max int, p_que text, p_desde int default 1) returns void language plpgsql as $$
declare v record;
begin
  select x.semana, x.jugador, count(*) as c into v from (
    select p.semana, p.jugador_a as jugador from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = p_rk and p.tipo = 'regular' and p.estado <> 'anulado' and p.semana >= p_desde
    union all
    select p.semana, p.jugador_b from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = p_rk and p.tipo = 'regular' and p.estado <> 'anulado' and p.semana >= p_desde
  ) x group by 1, 2 having count(*) > 1 limit 1;
  if found then
    raise exception 'AGUJERO: un jugador juega % veces en la semana % · %', v.c, v.semana, p_que;
  end if;

  select p.semana, count(*) as c into v from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = p_rk and p.tipo = 'regular' and p.estado <> 'anulado' and p.semana >= p_desde
     and not p.semana_fija
   group by 1 having count(*) > p_max limit 1;
  if found then
    raise exception 'AGUJERO: la semana % tiene % partidos y el tope es % · %', v.semana, v.c, p_max, p_que;
  end if;

  if exists (
    select 1 from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = p_rk and p.tipo = 'regular' and p.estado = 'pendiente' and p.semana is null
  ) then
    raise exception 'AGUJERO: quedaron partidos pendientes sin semana · %', p_que;
  end if;
end; $$;

-- Un socio nuevo, creado por auth como en la aplicación.
create or replace function pg_temp.socio(p_carnet text, p_nombre text) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    p_carnet || '@uvgtt.local', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('carnet', p_carnet, 'nombre', p_nombre),
    now(), now(), '', '', '', ''
  );
end; $$;

-- -----------------------------------------------------------------------------
-- Preparación: 15 jugadores activos, ranking con las tres divisiones de 5.
-- -----------------------------------------------------------------------------
do $$
declare v_sem uuid; v_rk uuid; v_asig jsonb; i int;
begin
  for i in 1 .. 6 loop
    perform pg_temp.socio('2910' || i, 'Socio ' || i);
  end loop;
  update public.usuario set activo = true;

  select id into v_sem from public.semestre limit 1;
  delete from public.ranking where semestre_id = v_sem and numero = 2;

  perform pg_temp.como('20001');
  v_rk := public.crear_ranking(v_sem, 2::smallint, 'Semanas', current_date + 90);
  reset role;

  if (select count(*) from public.division where ranking_id = v_rk) <> 3
     or not exists (select 1 from public.division where ranking_id = v_rk and tipo = 'tercera') then
    raise exception 'AGUJERO: el ranking no nació con Primera, Segunda y Tercera';
  end if;
  if (select (n_ascienden, n_descienden, n_premiados, partidos_por_semana) from public.ranking where id = v_rk)
     is distinct from (2::smallint, 2::smallint, 2::smallint, 5::smallint) then
    raise exception 'AGUJERO: los valores por defecto no son los del club (suben 2, bajan 2, premian 2, 5 por semana)';
  end if;

  select jsonb_agg(jsonb_build_object('usuario_id', u.id,
           'division', case when u.n <= 5 then 'primera' when u.n <= 10 then 'segunda' else 'tercera' end))
    into v_asig
    from (select id, row_number() over (order by carnet) n from public.usuario where activo) u
   where u.n <= 15;

  perform pg_temp.como('20001');
  perform public.armar_divisiones(v_rk, v_asig, null);
  if public.generar_calendario(v_rk) <> 30 then
    raise exception 'AGUJERO: 5, 5 y 5 tienen que dar 30 partidos';
  end if;
  reset role;

  -- En una misma jornada nadie juega dos veces.
  if exists (
    select 1 from (
      select p.division_id, p.jornada, j from public.partido p
       cross join lateral (values (p.jugador_a), (p.jugador_b)) as v(j)
       join public.division d on d.id = p.division_id where d.ranking_id = v_rk
    ) x group by division_id, jornada, j having count(*) > 1
  ) then
    raise exception 'AGUJERO: alguien juega dos veces en la misma jornada';
  end if;
  if (select count(distinct jornada) from public.partido p join public.division d on d.id = p.division_id
       where d.ranking_id = v_rk and d.tipo = 'primera') <> 5 then
    raise exception 'AGUJERO: con 5 jugadores el todos contra todos tiene 5 jornadas';
  end if;

  raise notice 'ok · un ranking nuevo nace con tres divisiones y un calendario por jornadas';
end $$;

-- -----------------------------------------------------------------------------
-- 1. Abrir reparte los 30 partidos en 6 semanas de 5, sin repetir jugador.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_lunes date := date_trunc('week', public.hoy_guatemala())::date;
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';

  perform pg_temp.como('20001');
  perform public.abrir_ranking(v_rk, v_lunes);
  reset role;

  perform pg_temp.revisar_semanas(v_rk, 5, 'al abrir');
  if (select max(p.semana) from public.partido p join public.division d on d.id = p.division_id where d.ranking_id = v_rk) <> 6 then
    raise exception 'AGUJERO: 30 partidos de a 5 tienen que entrar en 6 semanas';
  end if;
  if (select inicio_semanas from public.ranking where id = v_rk) <> v_lunes then
    raise exception 'AGUJERO: no guardó el lunes de la semana 1';
  end if;

  raise notice 'ok · abrir reparte 30 partidos en 6 semanas de 5, nadie dos veces por semana';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Un partido adelantado pasa a la semana en que se jugó, y las semanas que
--    vienen se arman sin él. La semana en curso no se toca: ya se anunció.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_p public.partido%rowtype; v_antes uuid[]; v_despues uuid[];
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';

  select array_agg(p.id order by p.id) into v_antes from public.partido p
    join public.division d on d.id = p.division_id where d.ranking_id = v_rk and p.semana = 1;

  select p.* into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.semana = 4 limit 1;

  update public.partido set estado = 'jugado', ganador = jugador_a, sets_a = 2, sets_b = 0,
         registrado_por = jugador_a, registrado_en = now()
   where id = v_p.id;

  if (select semana from public.partido where id = v_p.id) <> 1 then
    raise exception 'AGUJERO: el partido adelantado siguió en la semana 4';
  end if;

  select array_agg(p.id order by p.id) into v_despues from public.partido p
    join public.division d on d.id = p.division_id where d.ranking_id = v_rk and p.semana = 1 and p.id <> v_p.id;
  if v_antes is distinct from v_despues then
    raise exception 'AGUJERO: al adelantar un partido cambió la semana en curso, que ya se había anunciado';
  end if;

  perform pg_temp.revisar_semanas(v_rk, 5, 'después de adelantar', 2);
  if (select count(*) from public.partido p join public.division d on d.id = p.division_id
       where d.ranking_id = v_rk and p.semana = 4) <> 5 then
    raise exception 'AGUJERO: la semana 4 no se volvió a llenar después de adelantar uno de sus partidos';
  end if;

  raise notice 'ok · un partido adelantado pasa a su semana real y las siguientes se rearman';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Lo que no se jugó en una semana que ya pasó queda ahí, pendiente.
--    Se simula que pasaron dos semanas corriendo el inicio hacia atrás.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_atrasados int; v_p uuid;
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';
  update public.ranking set inicio_semanas = inicio_semanas - 14 where id = v_rk;

  select count(*) into v_atrasados from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.estado = 'pendiente' and p.semana in (1, 2);

  -- Cualquier cambio de estado vuelve a armar las semanas.
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.estado = 'pendiente' and p.semana = 5 limit 1;
  update public.partido set estado = 'jugado', ganador = jugador_b, sets_a = 0, sets_b = 2,
         registrado_por = jugador_b, registrado_en = now()
   where id = v_p;

  if (select count(*) from public.partido p join public.division d on d.id = p.division_id
       where d.ranking_id = v_rk and p.estado = 'pendiente' and p.semana in (1, 2)) <> v_atrasados then
    raise exception 'AGUJERO: los partidos no jugados de semanas pasadas se movieron solos';
  end if;
  if (select semana from public.partido where id = v_p) <> 3 then
    raise exception 'AGUJERO: el partido jugado esta semana no quedó en la semana 3';
  end if;

  perform pg_temp.revisar_semanas(v_rk, 5, 'con semanas pasadas', 4);
  raise notice 'ok · lo que no se jugó en su semana queda pendiente donde estaba';
end $$;

-- -----------------------------------------------------------------------------
-- 4. El coordinador mueve un atrasado a esta semana; a una pasada no se puede,
--    y un jugador no puede mover nada.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_p uuid;
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.estado = 'pendiente' and p.semana = 1 limit 1;

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(format('select public.mover_partido_a_semana(%L, 2::smallint)', v_p),
    'ya pasó', 'mover a una semana que ya pasó');
  perform public.mover_partido_a_semana(v_p, 3::smallint);
  reset role;

  if (select (semana, semana_fija) from public.partido where id = v_p) is distinct from (3::smallint, true) then
    raise exception 'AGUJERO: el partido no quedó fijo en la semana 3';
  end if;

  perform pg_temp.como('20002');
  perform pg_temp.exige_error(format('select public.mover_partido_a_semana(%L, 4::smallint)', v_p),
    'coordinador', 'un jugador moviendo un partido');
  reset role;

  raise notice 'ok · el coordinador mueve un atrasado; no a semanas pasadas, y un jugador no puede';
end $$;

-- -----------------------------------------------------------------------------
-- 5. Con 4 por semana, las semanas que vienen se rearman de a 4.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid;
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';
  perform pg_temp.como('20001');
  perform public.ajustar_partidos_por_semana(v_rk, 4::smallint);
  reset role;

  if exists (
    select 1 from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = v_rk and p.semana > 3 and p.estado <> 'anulado'
     group by p.semana having count(*) > 4
  ) then
    raise exception 'AGUJERO: quedó una semana futura con más de 4';
  end if;
  perform pg_temp.revisar_semanas(v_rk, 4, 'con 4 por semana', 4);

  -- Con 10 por semana el orden por jornadas ya no alcanza para separar a la
  -- gente: tiene que frenar el que ya juega esa semana. Con 5 por división,
  -- caben a lo sumo 2 partidos por división y semana.
  perform pg_temp.como('20001');
  perform public.ajustar_partidos_por_semana(v_rk, 10::smallint);
  reset role;
  perform pg_temp.revisar_semanas(v_rk, 10, 'con 10 por semana', 4);
  if exists (
    select 1 from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = v_rk and p.semana > 3 and p.estado = 'pendiente'
     group by p.semana, p.division_id having count(*) > 2
  ) then
    raise exception 'AGUJERO: con 5 jugadores una división no puede tener más de 2 partidos en una semana';
  end if;

  perform pg_temp.como('20001');
  perform public.ajustar_partidos_por_semana(v_rk, 4::smallint);
  reset role;
  raise notice 'ok · cambiar los partidos por semana rearma las semanas que vienen';
end $$;

-- -----------------------------------------------------------------------------
-- 6. Ascensos y descensos entre tres divisiones: los 2 primeros de Segunda y
--    de Tercera suben una; los 2 últimos de Primera y de Segunda bajan una.
--    Primera no sube y Tercera no baja.
--
--    Se confirman todos los partidos con el de carnet menor como ganador, así
--    la tabla queda ordenada por carnet en cada división.
-- -----------------------------------------------------------------------------
do $$
declare v_rk uuid; v_mal text;
begin
  select id into v_rk from public.ranking where nombre = 'Semanas';
  update public.partido p set estado = 'confirmado', semana = coalesce(p.semana, 1),
         ganador = case when ua.carnet < ub.carnet then p.jugador_a else p.jugador_b end,
         sets_a = case when ua.carnet < ub.carnet then 2 else 0 end,
         sets_b = case when ua.carnet < ub.carnet then 0 else 2 end
    from public.division d, public.usuario ua, public.usuario ub
   where d.id = p.division_id and d.ranking_id = v_rk and ua.id = p.jugador_a and ub.id = p.jugador_b;

  with prop as (select * from public.proponer_siguiente(v_rk) where division_actual is not null)
  select string_agg(format('%s %s.º → %s', division_actual, posicion, division_propuesta), ', ') into v_mal
    from prop
   where division_propuesta is distinct from (case
     when division_actual = 'primera' and posicion >= 4 then 'segunda'
     when division_actual = 'segunda' and posicion <= 2 then 'primera'
     when division_actual = 'segunda' and posicion >= 4 then 'tercera'
     when division_actual = 'tercera' and posicion <= 2 then 'segunda'
     else division_actual end)::public.division_tipo;
  if v_mal is not null then
    raise exception 'AGUJERO: propuesta equivocada: %', v_mal;
  end if;

  if exists (select 1 from public.proponer_siguiente(v_rk) where origen = 'nuevo' and division_propuesta <> 'tercera') then
    raise exception 'AGUJERO: un jugador nuevo no quedó propuesto en Tercera';
  end if;

  raise notice 'ok · entre tres divisiones suben y bajan 2 entre vecinas, y el nuevo entra en Tercera';
end $$;

-- -----------------------------------------------------------------------------
-- 7. Una división del medio necesita jugadores para que suban 2 y bajen 2.
-- -----------------------------------------------------------------------------
do $$
declare v_sem uuid; v_rk uuid; v_asig jsonb;
begin
  delete from public.ranking where nombre = 'Semanas';
  select id into v_sem from public.semestre limit 1;

  perform pg_temp.como('20001');
  v_rk := public.crear_ranking(v_sem, 2::smallint, 'Corto', current_date + 90);
  select jsonb_agg(jsonb_build_object('usuario_id', u.id,
           'division', case when u.n <= 5 then 'primera' when u.n <= 8 then 'segunda' else 'tercera' end))
    into v_asig
    from (select id, row_number() over (order by carnet) n from public.usuario where activo) u
   where u.n <= 13;
  perform public.armar_divisiones(v_rk, v_asig, null);
  perform public.generar_calendario(v_rk);
  perform pg_temp.exige_error(format('select public.abrir_ranking(%L)', v_rk),
    'no alcanzan', 'abrir con 3 en Segunda cuando suben 2 y bajan 2');
  reset role;

  raise notice 'ok · no abre si en una división del medio no alcanzan para subir y bajar';
end $$;

rollback;
