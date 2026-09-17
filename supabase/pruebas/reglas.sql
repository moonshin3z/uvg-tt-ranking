-- =============================================================================
-- Pruebas de las reglas del juego y de los cierres.
-- Se corren igual que supabase/pruebas/permisos.sql. Todo dentro de una
-- transacción que se revierte.
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

-- El `raise` va fuera del bloque que atrapa, si no se atrapa a sí mismo.
create or replace function pg_temp.exige_error(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;

create or replace function pg_temp.torneo_de_dos() returns uuid language plpgsql as $$
declare v_t uuid; v_sem uuid;
begin
  select id into v_sem from public.semestre limit 1;
  perform pg_temp.como('20001');
  select (public.crear_torneo(v_sem, 'Prueba ' || gen_random_uuid()::text, 'llave', current_date,
                              3::smallint, 11::smallint, 72::smallint)).id into v_t;
  perform public.abrir_inscripcion_torneo(v_t);
  perform public.inscribir_en_torneo(v_t, id) from public.usuario where carnet in ('20002','20003');
  perform public.armar_torneo(v_t, 'llave',
    array(select id from public.usuario where carnet in ('20002','20003')), null);
  reset role;
  return v_t;
end; $$;

-- ---------------------------------------------------------------------------
do $$
declare v_t uuid; v_p uuid; v_a uuid;
begin
  v_t := pg_temp.torneo_de_dos();
  select id, jugador_a into v_p, v_a from public.partido where torneo_id = v_t limit 1;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  set local role authenticated;

  perform pg_temp.exige_error(format('select public.registrar_resultado(%L, 1::smallint, 0::smallint, null)', v_p),
    'registrar 1-0 en un torneo al mejor de 5');
  perform pg_temp.exige_error(format('select public.registrar_resultado(%L, 2::smallint, 1::smallint, null)', v_p),
    'registrar 2-1 en un torneo al mejor de 5');
  perform pg_temp.exige_error(format('select public.registrar_resultado(%L, 4::smallint, 2::smallint, null)', v_p),
    'registrar 4-2 en un torneo al mejor de 5');
  perform public.registrar_resultado(v_p, 3::smallint, 1::smallint, null);
  reset role;
  raise notice 'ok · el marcador tiene que llegar a los sets que se juegan';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_t uuid; v_p uuid; v_a uuid;
begin
  v_t := pg_temp.torneo_de_dos();
  select id, jugador_a into v_p, v_a from public.partido where torneo_id = v_t limit 1;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  set local role authenticated;

  perform pg_temp.exige_error(
    format('select public.registrar_resultado(%L, 3::smallint, 0::smallint, %L::jsonb)', v_p, '[[47,3],[11,4],[11,9]]'),
    'un set 47-3 jugando a 11');
  perform pg_temp.exige_error(
    format('select public.registrar_resultado(%L, 3::smallint, 0::smallint, %L::jsonb)', v_p, '[[11,10],[11,4],[11,9]]'),
    'un set 11-10 jugando a 11');
  perform pg_temp.exige_error(
    format('select public.registrar_resultado(%L, 3::smallint, 0::smallint, %L::jsonb)', v_p, '[[8,5],[11,4],[11,9]]'),
    'un set que no llega al tope');
  -- válidos: al tope con dos de ventaja, y el desempate exacto
  perform public.registrar_resultado(v_p, 3::smallint, 0::smallint, '[[11,9],[11,0],[13,11]]'::jsonb);
  reset role;
  raise notice 'ok · cada set respeta los puntos que se juegan y los dos de ventaja';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_t uuid; v_p uuid; v_a uuid; v_b uuid;
begin
  v_t := pg_temp.torneo_de_dos();
  select id, jugador_a, jugador_b into v_p, v_a, v_b from public.partido where torneo_id = v_t limit 1;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  set local role authenticated;
  perform public.registrar_resultado(v_p, 3::smallint, 1::smallint, null);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform public.confirmar_resultado(v_p);
  reset role;

  if public.campeon_de_torneo(v_t) is null then raise exception 'ROTO: una final confirmada tiene que dar campeón'; end if;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  set local role authenticated;
  perform public.disputar_resultado(v_p, 'no fue ese resultado');
  reset role;

  if public.campeon_de_torneo(v_t) is not null then
    raise exception 'AGUJERO: hay campeón con la final en disputa';
  end if;

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(format('select public.cerrar_torneo(%L)', v_t),
    'cerrar un torneo con la final en disputa');
  reset role;
  raise notice 'ok · sin final resuelta no hay campeón ni cierre';
end $$;

-- ---------------------------------------------------------------------------
do $$
declare v_rk uuid; v_p uuid;
begin
  select id into v_rk from public.ranking limit 1;
  update public.ranking set estado = 'abierto' where id = v_rk;
  -- deja todo definido salvo uno, que se anula a mano sin retirar a nadie
  update public.partido p set estado = 'confirmado', ganador = p.jugador_a, sets_a = 3, sets_b = 1
    from public.division d where d.id = p.division_id and d.ranking_id = v_rk and p.estado <> 'anulado';
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk limit 1;
  update public.partido set estado = 'anulado' where id = v_p;

  perform pg_temp.como('20001');
  perform pg_temp.exige_error(format('select public.cerrar_fase_regular(%L)', v_rk),
    'cerrar la fase regular con un partido anulado sin que nadie se retirara');
  reset role;
  raise notice 'ok · no se cierra un todos contra todos incompleto';
end $$;

rollback;
