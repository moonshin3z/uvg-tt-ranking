-- =============================================================================
-- Pruebas de permisos y guardas, contra la base local.
--
--   npx supabase db reset
--   psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--        -v ON_ERROR_STOP=1 -f supabase/pruebas/permisos.sql
--
-- Cada bloque reproduce un agujero real que estuvo abierto. Si alguno vuelve a
-- pasar, esto falla con el nombre del agujero. Todo corre dentro de una
-- transacción que se revierte: no ensucia la base.
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

-- El `raise` del final va FUERA del bloque que atrapa, si no se atrapa a sí
-- mismo y la prueba pasa siempre. Pasó: la primera versión de este archivo
-- daba verde contra una base con los agujeros abiertos.
create or replace function pg_temp.exige_error(p_sql text, p_que text) returns void language plpgsql as $$
declare v_paso boolean := false;
begin
  begin
    execute p_sql;
    v_paso := true;
  exception when others then
    return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

-- ---------------------------------------------------------------------------
do $$
declare v_j uuid; v_antes record; v_despues record;
begin
  select id into v_j from public.usuario where carnet = '20002';
  update public.usuario set activo = false, debe_cambiar_pin = true, carnet = '20002' where id = v_j;
  select activo, debe_cambiar_pin, carnet into v_antes from public.usuario where id = v_j;

  perform pg_temp.como('20002');
  update public.usuario set activo = true, debe_cambiar_pin = false, carnet = '29999' where id = v_j;
  reset role;

  select activo, debe_cambiar_pin, carnet into v_despues from public.usuario where id = v_j;
  if v_despues is distinct from v_antes then
    raise exception 'AGUJERO: un jugador editó su propia fila (%, se esperaba %)', v_despues, v_antes;
  end if;
  raise notice 'ok · un jugador no se reactiva, ni se quita el PIN pendiente, ni se roba un carnet';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_p uuid;
begin
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
    join public.ranking r on r.id = d.ranking_id
   where p.estado = 'confirmado' and r.estado = 'cerrado' limit 1;
  if v_p is null then raise exception 'La semilla no tiene un partido confirmado en un ranking cerrado'; end if;

  perform pg_temp.como('20002');
  perform pg_temp.exige_error(
    format('select public.disputar_resultado(%L, ''el marcador estaba mal'')', v_p),
    'disputar un partido confirmado de un ranking CERRADO');
  reset role;
  raise notice 'ok · no se altera la tabla de un ranking cerrado disputando un partido';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_p uuid; v_j uuid;
begin
  select id into v_j from public.usuario where carnet = '20002';
  update public.ranking set estado = 'abierto';
  select id into v_p from public.partido where estado = 'pendiente' and division_id is not null
     and (jugador_a = v_j or jugador_b = v_j) limit 1;
  update public.usuario set activo = false where id = v_j;

  perform pg_temp.como('20002');
  perform pg_temp.exige_error(
    format('select public.registrar_resultado(%L, 3::smallint, 1::smallint, null)', v_p),
    'registrar un resultado con la cuenta dada de baja');
  perform pg_temp.exige_error(
    'select public.abrir_marcador_libre(''Uno'', ''Dos'', 3::smallint, 11::smallint)',
    'abrir un marcador con la cuenta dada de baja');
  reset role;
  raise notice 'ok · quien está de baja no registra resultados ni abre marcadores';
end $$;

-- ---------------------------------------------------------------------------
do $$
begin
  set local role anon;
  perform pg_temp.exige_error(
    'select count(*) from public.usuario where debe_cambiar_pin',
    'leer sin sesión quién sigue con el PIN inicial');
  reset role;
  raise notice 'ok · debe_cambiar_pin no es legible desde el cliente';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_j uuid; v_hash text;
begin
  select id, encrypted_password into v_j, v_hash from auth.users
   where id = (select id from public.usuario where carnet = '20002');
  update public.usuario set activo = true, debe_cambiar_pin = true where id = v_j;

  perform pg_temp.como('20002');
  perform public.cambiar_mi_pin('483920');
  reset role;

  if (select debe_cambiar_pin from public.usuario where id = v_j) then
    raise exception 'AGUJERO: cambiar_mi_pin no bajó la bandera';
  end if;
  if (select encrypted_password from auth.users where id = v_j) = v_hash then
    raise exception 'AGUJERO: cambiar_mi_pin no cambió la contraseña';
  end if;
  if not (select encrypted_password = extensions.crypt('483920', encrypted_password)
            from auth.users where id = v_j) then
    raise exception 'AGUJERO: el PIN nuevo no sirve para entrar';
  end if;

  perform pg_temp.como('20002');
  perform pg_temp.exige_error('select public.cambiar_mi_pin(''111111'')', 'poner un PIN obvio');
  perform pg_temp.exige_error('select public.cambiar_mi_pin(''12345'')', 'poner un PIN de 5 dígitos');
  reset role;
  raise notice 'ok · el PIN se cambia en un solo paso y no se puede decouplar de la bandera';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_j uuid;
begin
  select id into v_j from public.usuario where carnet = '20003';
  perform pg_temp.como('20002');
  perform pg_temp.exige_error(
    format('select public.asignar_rol(%L, ''coordinador'')', v_j),
    'nombrarse coordinador sin serlo');
  reset role;
  raise notice 'ok · el rol lo asigna un coordinador, no quien se registra';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_p uuid; v_a uuid; v_b uuid;
begin
  update public.ranking set estado = 'abierto';
  update public.usuario set activo = true;
  -- Ninguno de los dos puede ser el coordinador: si registra él, el partido
  -- queda confirmado de una y no hay nada que confirmar después.
  select p.id, p.jugador_a, p.jugador_b into v_p, v_a, v_b
    from public.partido p
   where p.estado = 'pendiente' and p.division_id is not null
     and not exists (select 1 from public.usuario u
                      where u.id in (p.jugador_a, p.jugador_b) and u.rol = 'coordinador')
   limit 1;
  if v_p is null then raise exception 'La semilla no tiene un partido entre dos jugadores'; end if;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  set local role authenticated;
  -- 2 sets: el ranking de la semilla se juega al mejor de 3.
  perform public.registrar_resultado(v_p, 2::smallint, 1::smallint, null);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform public.confirmar_resultado(v_p);
  reset role;

  if (select estado from public.partido where id = v_p) <> 'confirmado' then
    raise exception 'ROTO: el camino normal de registrar y confirmar dejó de funcionar';
  end if;
  raise notice 'ok · el camino normal sigue funcionando';
end $$;

rollback;
