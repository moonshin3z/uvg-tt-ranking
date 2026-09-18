-- =============================================================================
-- Cómo se arman las divisiones.
--
-- La regla del club: el sorteo es una sola vez, en el primer ranking. De ahí en
-- adelante los lugares salen de la tabla anterior, y el que entra nuevo al club
-- empieza en Menor.
--
-- Va en su propio archivo por lo mismo que herencia.sql: necesita la semilla
-- tal como quedó, y las pruebas de reglas.sql ya movieron estados y divisiones
-- para cuando terminan.
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

do $$
declare v_ant uuid; v_sem uuid; v_nuevo uuid; v_asig jsonb; v_nuevos int; v_err text;
begin
  select id, semestre_id into v_ant, v_sem from public.ranking where numero=1 and estado='cerrado' limit 1;

  -- un socio que no jugó el ranking anterior. Se crea por auth, como en la
  -- aplicación: el trigger `crear_perfil_desde_auth` le arma el perfil.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    '29999@uvgtt.local', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('carnet', '29999', 'nombre', 'Recien Llegado'),
    now(), now(), '', '', '', ''
  );

  select count(*) into v_nuevos from public.proponer_siguiente(v_ant) where origen = 'nuevo';
  if v_nuevos <> 1 then
    raise exception 'AGUJERO: la propuesta trajo % jugadores nuevos y debía traer 1', v_nuevos;
  end if;
  if not exists (select 1 from public.proponer_siguiente(v_ant)
                  where origen='nuevo' and division_propuesta='menor') then
    raise exception 'AGUJERO: el jugador nuevo no quedó propuesto en Menor';
  end if;

  perform pg_temp.como('20001');
  v_nuevo := public.crear_ranking_siguiente(v_ant, v_sem, 2::smallint, current_date + 60);
  reset role;

  if (select anterior_id from public.ranking where id = v_nuevo) is distinct from v_ant then
    raise exception 'AGUJERO: el ranking nuevo no guardó de cuál hereda';
  end if;

  if not exists (
    select 1 from public.inscripcion i
      join public.division d on d.id = i.division_id
      join public.usuario u on u.id = i.usuario_id
     where d.ranking_id = v_nuevo and u.carnet = '29999' and d.tipo = 'menor'
  ) then
    raise exception 'AGUJERO: el jugador nuevo no quedó inscrito en Menor del ranking heredado';
  end if;

  -- Sortear el heredado tiene que fallar, y fallar POR ESO.
  --
  -- La asignación va repartida de verdad entre las dos divisiones: con todos
  -- en Mayor, `armar_divisiones` se caía antes de llegar a la guarda por
  -- «Cada división necesita al menos 2 jugadores», el `when others` se comía
  -- ese error y la prueba daba verde con la guarda quitada. Por eso además se
  -- exige que el mensaje hable de la herencia y no de cualquier otra cosa.
  select jsonb_agg(jsonb_build_object(
           'usuario_id', i.usuario_id,
           'division', case when i.n % 2 = 0 then 'mayor' else 'menor' end))
    into v_asig
    from (select i.usuario_id, row_number() over (order by i.usuario_id) as n
            from public.inscripcion i join public.division d on d.id = i.division_id
           where d.ranking_id = v_nuevo) i;

  perform pg_temp.como('20001');
  begin
    perform public.armar_divisiones(v_nuevo, v_asig, 'semilla-de-prueba');
    v_err := 'sin error';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  reset role;

  if v_err = 'sin error' then
    raise exception 'AGUJERO: dejó sortear un ranking que hereda sus divisiones';
  end if;
  if v_err not like '%hereda%' then
    raise exception 'AGUJERO: el sorteo del heredado falló, pero por otra cosa: %', v_err;
  end if;

  raise notice 'ok · el heredado no se sortea, y los nuevos entran en Menor';
end $$;
rollback;
