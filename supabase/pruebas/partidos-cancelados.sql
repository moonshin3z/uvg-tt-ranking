-- Las cancelaciones deben bloquear las RPC, incluso desde una pestaña vieja.
-- Cada operación usa datos válidos: el rechazo tiene que mencionar cancelado.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.exige_error(p_sql text)
returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if position('cancelado' in lower(v_msg)) = 0 then
      raise exception 'Falló por otra razón: %', v_msg;
    end if;
    return;
  end;
  raise exception 'AGUJERO: permitió la operación tras cancelar';
end; $$;

do $$
declare
  sem uuid; r uuid; d uuid; t uuid; p uuid; jugado uuid;
  m public.marcador; abandonado uuid;
  yo uuid; rival uuid; coord uuid;
  clase text; caso record; fallas text[] := '{}';
begin
  select id into strict yo from public.usuario where carnet = '20002';
  select id into strict rival from public.usuario where carnet = '20003';
  select id into strict coord from public.usuario where carnet = '20001';
  insert into public.semestre(nombre, inicio, fin)
    values ('cancelaciones-' || gen_random_uuid(), current_date, current_date + 100) returning id into sem;

  foreach clase in array array['ranking', 'torneo'] loop
    d := null; t := null;
    if clase = 'ranking' then
      insert into public.ranking(semestre_id, numero, nombre, fecha_limite, estado)
        values (sem, 1, 'Ranking cancelable', current_date + 30, 'abierto') returning id into r;
      insert into public.division(ranking_id, tipo) values (r, 'primera') returning id into d;
    else
      insert into public.torneo(semestre_id, nombre, formato, estado, sets_para_ganar)
        values (sem, 'Torneo cancelable', 'llave', 'en_juego', 2) returning id into t;
    end if;
    insert into public.partido(division_id, torneo_id, tipo, jugador_a, jugador_b)
      values (d, t, case when d is null then 'llave'::public.partido_tipo else 'regular'::public.partido_tipo end,
              least(yo, rival), greatest(yo, rival)) returning id into p;
    insert into public.partido(division_id, torneo_id, tipo, jugador_a, jugador_b,
                              estado, ganador, sets_a, sets_b, registrado_por, registrado_en)
      values (d, t, case when d is null then 'llave'::public.partido_tipo else 'desempate'::public.partido_tipo end,
              least(yo, rival), greatest(yo, rival), 'jugado', least(yo, rival), 2, 0, rival, now())
      returning id into jugado;

    perform set_config('request.jwt.claim.sub', yo::text, true);
    set local role authenticated;
    m := public.abrir_marcador_de_partido(p);
    reset role;
    insert into public.marcador(codigo, partido_id, nombre_a, nombre_b, dueno, estado)
      values (public.codigo_marcador(), jugado, 'A', 'B', yo, 'abandonado') returning id into abandonado;
    perform set_config('request.jwt.claim.sub', coord::text, true);
    set local role authenticated;
    if clase = 'ranking' then perform public.cancelar_ranking(r, 'Prueba de cancelación');
    else perform public.cancelar_torneo(t, 'Prueba de cancelación'); end if;
    reset role;

    for caso in select * from (values
      ('registrar', yo, format('select public.registrar_resultado(%L, 2::smallint, 0::smallint, %L::jsonb)', p, '[[11,0],[11,0]]')),
      ('confirmar', yo, format('select public.confirmar_resultado(%L)', jugado)),
      ('disputar', yo, format('select public.disputar_resultado(%L, %L)', jugado, 'Resultado equivocado')),
      ('abrir marcador', yo, format('select public.abrir_marcador_de_partido(%L)', p)),
      ('reabrir marcador', yo, format('select public.reabrir_marcador(%L)', abandonado)),
      ('sincronizar marcador', yo, format('select public.sincronizar_marcador(%L, 1::bigint, 1::smallint, 0::smallint, 0::smallint, 0::smallint, %L::jsonb, %L, %L)', m.id, '[]', 'a', 'en_juego')),
      ('anular como coordinador', coord, format('select public.anular_partido(%L, %L)', p, 'Partido equivocado'))
    ) as casos(nombre, actor, sql) loop
      perform set_config('request.jwt.claim.sub', caso.actor::text, true);
      set local role authenticated;
      begin
        perform pg_temp.exige_error(caso.sql);
        raise notice 'ok · % cancelado rechaza %', clase, caso.nombre;
      exception when others then
        fallas := array_append(fallas, clase || ' / ' || caso.nombre || ': ' || sqlerrm);
      end;
      reset role;
    end loop;
  end loop;
  if cardinality(fallas) > 0 then raise exception '%', array_to_string(fallas, E'\n'); end if;
end $$;
rollback;
