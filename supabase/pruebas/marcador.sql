-- =============================================================================
-- El marcador en vivo y su puente con el resultado.
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

create or replace function pg_temp.exige_error(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

-- Deja un partido pendiente entre dos jugadores (ninguno coordinador) y abre
-- su marcador. Devuelve marcador, partido y los dos jugadores.
create or replace function pg_temp.escenario()
returns table (marcador_id uuid, partido_id uuid, ja uuid, jb uuid)
language plpgsql as $$
declare v_rk uuid; v_p record; m public.marcador%rowtype;
begin
  select id into v_rk from public.ranking limit 1;
  update public.ranking set estado = 'abierto' where id = v_rk;
  select p.id, p.jugador_a, p.jugador_b into v_p
    from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and p.estado = 'pendiente'
     and not exists (select 1 from public.usuario u
                      where u.id in (p.jugador_a, p.jugador_b) and u.rol = 'coordinador')
   limit 1;
  if v_p.id is null then raise exception 'La semilla no tiene un partido pendiente entre dos jugadores'; end if;

  perform set_config('request.jwt.claim.sub', v_p.jugador_a::text, true);
  set local role authenticated;
  select * into m from public.abrir_marcador_de_partido(v_p.id);
  reset role;
  return query select m.id, v_p.id, v_p.jugador_a, v_p.jugador_b;
end; $$;

-- ---------------------------------------------------------------------------
do $$
declare e record;
begin
  select * into e from pg_temp.escenario();
  perform set_config('request.jwt.claim.sub', e.ja::text, true);
  set local role authenticated;

  -- El historial tiene que cuadrar con quién ganó cada set, no solo con cuántos.
  perform pg_temp.exige_error(format(
    'select public.sincronizar_marcador(%L, 2, 0::smallint, 0::smallint, 0::smallint, 2::smallint, %L::jsonb, ''a'', ''en_juego'')',
    e.marcador_id, '[[11,0],[11,0]]'),
    'un historial que dice que ganó uno y un marcador que dice que ganó el otro');

  -- Sets imposibles jugando a 11.
  perform pg_temp.exige_error(format(
    'select public.sincronizar_marcador(%L, 2, 0::smallint, 0::smallint, 1::smallint, 0::smallint, %L::jsonb, ''a'', ''en_juego'')',
    e.marcador_id, '[[11,10]]'),
    'un set 11-10 jugando a 11');

  -- Los dos ganando el mismo partido.
  perform pg_temp.exige_error(format(
    'select public.sincronizar_marcador(%L, 2, 0::smallint, 0::smallint, 2::smallint, 2::smallint, %L::jsonb, ''a'', ''en_juego'')',
    e.marcador_id, '[[11,5],[11,5],[5,11],[5,11]]'),
    'que los dos lleguen a los sets que hacen falta para ganar');

  -- Terminar sin que nadie haya ganado.
  perform pg_temp.exige_error(format(
    'select public.sincronizar_marcador(%L, 2, 0::smallint, 0::smallint, 1::smallint, 0::smallint, %L::jsonb, ''a'', ''terminado'')',
    e.marcador_id, '[[11,5]]'),
    'dar por terminado un partido que va 1-0 de 2');

  -- Una versión disparatada mata el marcador para siempre si se acepta.
  perform pg_temp.exige_error(format(
    'select public.sincronizar_marcador(%L, 9223372036854775807, 0::smallint, 0::smallint, 1::smallint, 0::smallint, %L::jsonb, ''a'', ''en_juego'')',
    e.marcador_id, '[[11,5]]'),
    'aceptar una versión absurdamente alta');
  reset role;
  raise notice 'ok · el marcador no acepta estados imposibles ni una versión que lo congele';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare e record; m public.marcador%rowtype; p public.partido%rowtype; v_sets int;
begin
  select * into e from pg_temp.escenario();
  perform set_config('request.jwt.claim.sub', e.ja::text, true);
  set local role authenticated;

  select * into m from public.sincronizar_marcador(
    e.marcador_id, 2, 0::smallint, 0::smallint, 1::smallint, 0::smallint,
    '[[11,7]]'::jsonb, 'b', 'en_juego');
  select * into m from public.sincronizar_marcador(
    e.marcador_id, 3, 0::smallint, 0::smallint, 2::smallint, 0::smallint,
    '[[11,7],[11,9]]'::jsonb, 'a', 'terminado');
  reset role;

  if m.aviso is not null then
    raise exception 'AGUJERO: el resultado no se registró: %', m.aviso;
  end if;

  select * into p from public.partido where id = e.partido_id;
  if p.estado <> 'jugado' then
    raise exception 'AGUJERO: el partido quedó en % en vez de jugado', p.estado;
  end if;
  if p.sets_a <> 2 or p.sets_b <> 0 then
    raise exception 'AGUJERO: el partido quedó %-% y el marcador decía 2-0', p.sets_a, p.sets_b;
  end if;
  if p.registrado_por <> e.ja then
    raise exception 'AGUJERO: el resultado no quedó a nombre de quien llevaba el marcador';
  end if;
  select count(*) into v_sets from public.set_partido where partido_id = e.partido_id;
  if v_sets <> 2 then
    raise exception 'AGUJERO: el detalle por set no pasó del marcador al partido (hay %)', v_sets;
  end if;

  -- Y el rival lo confirma como cualquier otro resultado.
  perform set_config('request.jwt.claim.sub', e.jb::text, true);
  set local role authenticated;
  perform public.confirmar_resultado(e.partido_id);
  reset role;
  if (select estado from public.partido where id = e.partido_id) <> 'confirmado' then
    raise exception 'AGUJERO: el rival no pudo confirmar el resultado del marcador';
  end if;
  raise notice 'ok · al terminar el marcador el resultado se registra solo y el rival lo confirma';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare e record; m public.marcador%rowtype;
begin
  select * into e from pg_temp.escenario();
  -- El ranking se cierra mientras juegan: el marcador se guarda igual, pero
  -- tiene que quedar dicho por qué el resultado no llegó al partido.
  update public.ranking set estado = 'cerrado';

  perform set_config('request.jwt.claim.sub', e.ja::text, true);
  set local role authenticated;
  select * into m from public.sincronizar_marcador(
    e.marcador_id, 2, 0::smallint, 0::smallint, 2::smallint, 0::smallint,
    '[[11,7],[11,9]]'::jsonb, 'a', 'terminado');
  reset role;

  if m.estado <> 'terminado' then
    raise exception 'AGUJERO: el marcador se perdió porque el resultado no se pudo registrar';
  end if;
  if m.aviso is null then
    raise exception 'AGUJERO: el resultado no se registró y el marcador no lo dice';
  end if;
  if (select estado from public.partido where id = e.partido_id) <> 'pendiente' then
    raise exception 'AGUJERO: se registró un resultado en un ranking cerrado';
  end if;
  raise notice 'ok · si el resultado no se puede registrar, el marcador se guarda y lo explica';
end $$;

rollback;
