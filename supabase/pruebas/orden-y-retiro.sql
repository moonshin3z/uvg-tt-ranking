-- =============================================================================
-- Orden de la tabla, clasificación de grupos y deshacer un retiro.
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

-- ---------------------------------------------------------------------------
-- Enfrentamiento directo por encima del nombre
create or replace function pg_temp.gana(p_div uuid, p_ganador text, p_perdedor text) returns void
language plpgsql as $$
declare vg uuid; vp uuid;
begin
  select id into vg from public.usuario where carnet = p_ganador;
  select id into vp from public.usuario where carnet = p_perdedor;
  update public.partido set estado = 'confirmado', ganador = vg,
         sets_a = case when jugador_a = vg then 2 else 0 end,
         sets_b = case when jugador_b = vg then 2 else 0 end
   where division_id = p_div
     and least(jugador_a, jugador_b) = least(vg, vp)
     and greatest(jugador_a, jugador_b) = greatest(vg, vp);
end; $$;

do $$
declare v_d uuid; v_ana uuid; v_bruno uuid; v_pa int; v_pb int;
begin
  -- División mayor de la semilla: coordinador (20001), Ana (20002),
  -- Bruno (20003), Carla (20004). Se arma a mano un cuadro donde Ana y Bruno
  -- quedan con los mismos puntos y Bruno le ganó el directo a Ana.
  select d.id into v_d from public.division d where d.tipo = 'primera' limit 1;
  update public.partido set estado = 'pendiente', ganador = null, sets_a = null, sets_b = null
   where division_id = v_d;

  perform pg_temp.gana(v_d, '20003', '20002');  -- Bruno le gana a Ana (el directo)
  perform pg_temp.gana(v_d, '20002', '20004');  -- Ana le gana a Carla
  perform pg_temp.gana(v_d, '20002', '20001');  -- Ana le gana al coordinador
  perform pg_temp.gana(v_d, '20003', '20004');  -- Bruno le gana a Carla
  perform pg_temp.gana(v_d, '20001', '20003');  -- el coordinador le gana a Bruno
  perform pg_temp.gana(v_d, '20004', '20001');  -- Carla le gana al coordinador

  select id into v_ana from public.usuario where carnet = '20002';
  select id into v_bruno from public.usuario where carnet = '20003';

  if (select pts from public.orden_division(v_d) where usuario_id = v_ana)
     <> (select pts from public.orden_division(v_d) where usuario_id = v_bruno) then
    raise exception 'La prueba no logró empatarlos en puntos';
  end if;

  select posicion into v_pa from public.orden_division(v_d) where usuario_id = v_ana;
  select posicion into v_pb from public.orden_division(v_d) where usuario_id = v_bruno;
  -- Alfabéticamente Ana va antes que Bruno: si el orden fuera por nombre,
  -- Ana quedaría arriba. Tiene que quedar Bruno, que le ganó el directo.
  if v_pb > v_pa then
    raise exception 'AGUJERO: Ana (pos %) va antes que Bruno (pos %) aunque Bruno le ganó el directo', v_pa, v_pb;
  end if;
  raise notice 'ok · el enfrentamiento directo ordena por encima del nombre';
end $$;

-- ---------------------------------------------------------------------------
-- Deshacer un retiro devuelve los partidos como estaban
do $$
declare v_rk uuid; v_j uuid; v_antes jsonb; v_despues jsonb; v_repuestos int;
begin
  select id into v_rk from public.ranking limit 1;
  update public.ranking set estado = 'abierto' where id = v_rk;
  select id into v_j from public.usuario where carnet = '20002';

  select jsonb_agg(jsonb_build_object('id', p.id, 'estado', p.estado, 'ganador', p.ganador,
                                      'sa', p.sets_a, 'sb', p.sets_b) order by p.id)
    into v_antes
    from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and v_j in (p.jugador_a, p.jugador_b);

  perform pg_temp.como('20001');
  perform public.retirar_del_ranking(v_rk, v_j, 'se lesionó');
  select public.deshacer_retiro(v_rk, v_j) into v_repuestos;
  reset role;

  select jsonb_agg(jsonb_build_object('id', p.id, 'estado', p.estado, 'ganador', p.ganador,
                                      'sa', p.sets_a, 'sb', p.sets_b) order by p.id)
    into v_despues
    from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and v_j in (p.jugador_a, p.jugador_b);

  if v_antes is distinct from v_despues then
    raise exception 'AGUJERO: deshacer el retiro no dejó los partidos como estaban. antes=% despues=%', v_antes, v_despues;
  end if;
  if not exists (select 1 from public.inscripcion i join public.division d on d.id = i.division_id
                  where d.ranking_id = v_rk and i.usuario_id = v_j) then
    raise exception 'AGUJERO: deshacer el retiro no devolvió la inscripción';
  end if;
  if exists (select 1 from public.retiro where ranking_id = v_rk and usuario_id = v_j) then
    raise exception 'AGUJERO: quedó el registro del retiro deshecho';
  end if;
  raise notice 'ok · deshacer un retiro devuelve la inscripción y los partidos (% repuestos)', v_repuestos;
end $$;

-- ---------------------------------------------------------------------------
-- El detalle de sets sobrevive al retiro
do $$
declare v_rk uuid; v_j uuid; v_p uuid; v_sets int;
begin
  select id into v_rk from public.ranking limit 1;
  update public.ranking set estado = 'abierto' where id = v_rk;
  select id into v_j from public.usuario where carnet = '20004';
  select p.id into v_p from public.partido p join public.division d on d.id = p.division_id
   where d.ranking_id = v_rk and v_j in (p.jugador_a, p.jugador_b) limit 1;
  delete from public.set_partido where partido_id = v_p;
  insert into public.set_partido (partido_id, numero, puntos_a, puntos_b)
  values (v_p, 1, 11, 7), (v_p, 2, 11, 9);

  perform pg_temp.como('20001');
  perform public.retirar_del_ranking(v_rk, v_j, 'se fue del país');
  reset role;

  select count(*) into v_sets from public.set_partido where partido_id = v_p;
  if v_sets <> 2 then
    raise exception 'AGUJERO: el retiro borró el detalle de sets (quedaron %)', v_sets;
  end if;
  raise notice 'ok · el retiro conserva el detalle de cada set';
end $$;

rollback;
