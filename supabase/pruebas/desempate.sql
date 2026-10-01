-- =============================================================================
-- El desempate que no termina: ciclo de tres.
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

-- Fija un resultado regular ya confirmado entre dos carnets de una división.
create or replace function pg_temp.gana(p_div uuid, p_g text, p_p text, p_sg int, p_sp int) returns void
language plpgsql as $$
declare vg uuid; vp uuid;
begin
  select id into vg from public.usuario where carnet = p_g;
  select id into vp from public.usuario where carnet = p_p;
  update public.partido set estado = 'confirmado', ganador = vg,
         sets_a = case when jugador_a = vg then p_sg else p_sp end,
         sets_b = case when jugador_b = vg then p_sg else p_sp end
   where division_id = p_div and tipo = 'regular'
     and least(jugador_a, jugador_b) = least(vg, vp)
     and greatest(jugador_a, jugador_b) = greatest(vg, vp);
end; $$;

-- ---------------------------------------------------------------------------
do $$
declare
  v_rk uuid; v_d uuid; v_men uuid;
  v_a uuid; v_b uuid; v_c uuid;
  v_emp record; v_n int; v_pend int;
begin
  select id into v_rk from public.ranking limit 1;
  select id into v_d   from public.division where ranking_id = v_rk and tipo = 'primera';
  select id into v_men from public.division where ranking_id = v_rk and tipo = 'segunda';
  update public.ranking set estado = 'abierto', n_premiados = 1, n_ascienden = 1, n_descienden = 1
   where id = v_rk;

  -- Mayor: Ana, Bruno y Carla empatados en 1 punto peleando el premio, con
  -- ciclo entre ellos y la misma diferencia de sets. El coordinador pierde
  -- todo para quedar último y no meterse en el empate.
  -- La división menor se deja resuelta y sin empates relevantes, para que no
  -- interfiera. Un partido confirmado necesita sets, por el CHECK de la tabla.
  update public.partido set estado = 'confirmado', ganador = jugador_a, sets_a = 2, sets_b = 0
   where division_id = v_men;
  update public.partido set estado = 'pendiente', ganador = null, sets_a = null, sets_b = null
   where division_id = v_d;
  perform pg_temp.gana(v_d, '20002', '20003', 2, 1);  -- Ana  > Bruno
  perform pg_temp.gana(v_d, '20003', '20004', 2, 1);  -- Bruno > Carla
  perform pg_temp.gana(v_d, '20004', '20002', 2, 1);  -- Carla > Ana
  perform pg_temp.gana(v_d, '20002', '20001', 2, 1);
  perform pg_temp.gana(v_d, '20003', '20001', 2, 1);
  perform pg_temp.gana(v_d, '20004', '20001', 2, 1);

  select id into v_a from public.usuario where carnet = '20002';
  select id into v_b from public.usuario where carnet = '20003';
  select id into v_c from public.usuario where carnet = '20004';

  perform pg_temp.como('20001');
  perform public.cerrar_fase_regular(v_rk);

  -- Primer escalón: el reglamento manda jugar.
  select * into v_emp from public.empates_relevantes(v_rk) where division_id = v_d limit 1;
  if v_emp.division_id is null then raise exception 'La prueba no logró el empate de tres'; end if;
  if v_emp.accion <> 'jugar' then
    raise exception 'AGUJERO: un empate sin desempates jugados debería decir jugar, y dice %', v_emp.accion;
  end if;
  if array_length(v_emp.usuarios, 1) <> 3 then
    raise exception 'La prueba esperaba tres empatados y hay %', array_length(v_emp.usuarios, 1);
  end if;

  perform public.generar_desempates(v_rk);
  reset role;

  -- El desempate sale cíclico otra vez, y con la misma diferencia de sets.
  -- Todo en un update: el partido no puede tener estado y ganador sin sets.
  update public.partido p set
    estado = 'confirmado',
    ganador = g.gana,
    sets_a = case when p.jugador_a = g.gana then 2 else 1 end,
    sets_b = case when p.jugador_b = g.gana then 2 else 1 end
   from (
     select pa.id,
       case
         when least(pa.jugador_a, pa.jugador_b) = least(v_a, v_b)
          and greatest(pa.jugador_a, pa.jugador_b) = greatest(v_a, v_b) then v_a
         when least(pa.jugador_a, pa.jugador_b) = least(v_b, v_c)
          and greatest(pa.jugador_a, pa.jugador_b) = greatest(v_b, v_c) then v_b
         else v_c
       end as gana
     from public.partido pa
     where pa.division_id = v_d and pa.tipo = 'desempate'
   ) g
   where p.id = g.id;

  -- Segundo escalón: ya jugaron y siguen iguales, así que toca decidir.
  select * into v_emp from public.empates_relevantes(v_rk) where division_id = v_d limit 1;
  if v_emp.division_id is null then
    raise exception 'AGUJERO: el ciclo de tres quedó sin marcar y el ranking se cerraría solo';
  end if;
  if v_emp.accion <> 'decidir' then
    raise exception 'AGUJERO: tras el desempate cíclico debería decir decidir, y dice %', v_emp.accion;
  end if;

  perform pg_temp.como('20001');
  -- No se puede seguir generando partidos: ya no es un empate de los de jugar.
  perform pg_temp.exige_error(format('select public.generar_desempates(%L)', v_rk),
    'generar otra ronda de desempates cuando ya no hay nada que jugar');
  -- Y no se puede cerrar con el empate abierto.
  perform pg_temp.exige_error(format('select public.cerrar_ranking(%L)', v_rk),
    'cerrar el ranking con un empate sin resolver');
  -- El motivo es obligatorio.
  perform pg_temp.exige_error(
    format('select public.decidir_empate(%L, array[%L,%L,%L]::uuid[], %L)', v_d, v_b, v_c, v_a, 'corto'),
    'decidir sin explicar por qué');

  perform public.decidir_empate(v_d, array[v_b, v_c, v_a]::uuid[],
    'Ciclo de tres sin diferencia de sets; se ordenó por el resultado del torneo interno de agosto');
  reset role;

  -- El orden decidido manda, y el empate deja de bloquear.
  if (select usuario_id from public.orden_division(v_d) where posicion = 1) <> v_b then
    raise exception 'AGUJERO: la decisión del coordinador no se aplicó al orden';
  end if;
  select count(*) into v_n from public.empates_relevantes(v_rk) where division_id = v_d;
  if v_n > 0 then raise exception 'AGUJERO: el empate decidido sigue bloqueando el cierre'; end if;

  perform pg_temp.como('20001');
  perform public.cerrar_ranking(v_rk);
  reset role;
  if (select estado from public.ranking where id = v_rk) <> 'cerrado' then
    raise exception 'AGUJERO: el ranking no se pudo cerrar ni con el empate decidido';
  end if;
  raise notice 'ok · el ciclo de tres: primero se juega, después se decide, y el ranking cierra';
end $$;

rollback;
