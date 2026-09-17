-- =============================================================================
-- Lo que `crear_ranking` tiene que dejar armado, y lo que el ranking siguiente
-- tiene que heredar.
--
-- Va en su propio archivo y no dentro de reglas.sql porque necesita la semilla
-- tal como quedó: las pruebas de reglas.sql corren todas en una transacción y
-- para cuando termina la última, los estados y las divisiones ya se movieron.
--
-- Las dos comprobaciones son de la misma falla de raíz: la migración 27
-- reescribió funciones enteras en vez de extenderlas, y por el camino perdió
-- un insert en una y dos argumentos en la otra. Ninguna de las dos daba error.
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

-- -----------------------------------------------------------------------------
-- 1. Un ranking nuevo nace con sus dos divisiones.
--
-- Sin esto el ranking se crea sin error y la falla aparece recién al armar las
-- divisiones, como «null value in column division_id», que no explica nada.
-- -----------------------------------------------------------------------------
do $$
declare v_sem uuid; v_rk uuid; v_divs integer; v_sets smallint;
begin
  select id into v_sem from public.semestre limit 1;

  perform pg_temp.como('20001');
  -- numero 2 porque la semilla ya dejó el 1 de ese semestre.
  delete from public.ranking where semestre_id = v_sem and numero = 2;
  v_rk := public.crear_ranking(
    v_sem, 2::smallint, 'Prueba de divisiones', current_date + 30,
    1::smallint, 0::smallint, 3::smallint, 3::smallint, 3::smallint, 72,
    3::smallint, 21::smallint
  );
  reset role;

  select count(*) into v_divs from public.division where ranking_id = v_rk;
  if v_divs <> 2 then
    raise exception 'AGUJERO: el ranking nuevo quedó con % divisiones y necesita 2 (mayor y menor)', v_divs;
  end if;

  select sets_para_ganar into v_sets from public.ranking where id = v_rk;
  if v_sets <> 3 then
    raise exception 'AGUJERO: no guardó los sets que se le pidieron: quedó en %', v_sets;
  end if;

  raise notice 'ok · un ranking nuevo nace con mayor y menor, y con las reglas que se le pidieron';
end $$;

-- -----------------------------------------------------------------------------
-- 2. El ranking siguiente hereda las reglas del anterior.
-- -----------------------------------------------------------------------------
do $$
declare v_ant uuid; v_sem uuid; v_nuevo uuid; v_sets smallint; v_pts smallint;
begin
  select id, semestre_id into v_ant, v_sem
    from public.ranking where numero = 1 and estado = 'cerrado' limit 1;
  if v_ant is null then raise exception 'La semilla no dejó un ranking 1 cerrado'; end if;

  update public.ranking set sets_para_ganar = 3, puntos_por_set = 21 where id = v_ant;
  delete from public.ranking where semestre_id = v_sem and numero = 2;

  perform pg_temp.como('20001');
  v_nuevo := public.crear_ranking_siguiente(v_ant, v_sem, 2::smallint, current_date + 60);
  reset role;

  select sets_para_ganar, puntos_por_set into v_sets, v_pts
    from public.ranking where id = v_nuevo;

  if v_sets <> 3 or v_pts <> 21 then
    raise exception
      'AGUJERO: el ranking siguiente no heredó las reglas: sets=% (debía 3), puntos=% (debía 21)',
      v_sets, v_pts;
  end if;

  raise notice 'ok · el ranking siguiente hereda sets y puntos por set';
end $$;

rollback;
