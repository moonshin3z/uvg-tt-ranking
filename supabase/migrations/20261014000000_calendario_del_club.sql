-- =============================================================================
-- El calendario del club.
--
-- El coordinador armó en Excel en qué semana va cada partido (35 partidos en 8
-- semanas) y el club lo quiere así, no repartido por la app. Esta función fija
-- cada partido en la semana que dice el calendario. Lo que el calendario no
-- nombre lo sigue acomodando `planificar_semanas` en las semanas con lugar.
--
-- Se puede cargar con el ranking en borrador (queda listo para cuando se abra)
-- o ya abierto. Un partido que ya se jugó no se mueve: queda en la semana en
-- que se jugó.
--
-- p_filas: [{ "jugador_a": uuid, "jugador_b": uuid, "semana": 1 }, ...]
-- Devuelve cuántos partidos quedaron fijos.
-- =============================================================================

create or replace function public.fijar_calendario(p_ranking_id uuid, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.ranking_estado;
  v_mal record;
  v_fijados integer;
begin
  perform public.exigir_coordinador();

  select estado into v_estado from public.ranking where id = p_ranking_id;
  if v_estado is null then raise exception 'Ranking no existe'; end if;
  if v_estado not in ('borrador', 'abierto') then
    raise exception 'El calendario solo se carga con el ranking en borrador o abierto';
  end if;

  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El calendario viene vacío';
  end if;

  drop table if exists pg_temp.calendario_cargado;
  create temporary table calendario_cargado on commit drop as
  select least(f.jugador_a, f.jugador_b) as a, greatest(f.jugador_a, f.jugador_b) as b, f.semana
    from jsonb_to_recordset(p_filas) as f(jugador_a uuid, jugador_b uuid, semana integer);

  if exists (select 1 from calendario_cargado where a is null or b is null or a = b or semana is null or semana < 1) then
    raise exception 'Hay filas del calendario sin dos jugadores distintos o sin semana';
  end if;

  select c.a, c.b, count(*) as n into v_mal
    from calendario_cargado c group by c.a, c.b having count(*) > 1 limit 1;
  if found then
    raise exception 'El partido entre % y % aparece % veces en el calendario',
      (select nombre from public.usuario where id = v_mal.a), (select nombre from public.usuario where id = v_mal.b), v_mal.n;
  end if;

  select c.a, c.b into v_mal
    from calendario_cargado c
   where not exists (
     select 1 from public.partido p join public.division d on d.id = p.division_id
      where d.ranking_id = p_ranking_id and p.tipo = 'regular'
        and p.jugador_a = c.a and p.jugador_b = c.b
   )
   limit 1;
  if found then
    raise exception 'El partido entre % y % no está en el calendario de este ranking; revisá que estén en la misma división',
      (select nombre from public.usuario where id = v_mal.a), (select nombre from public.usuario where id = v_mal.b);
  end if;

  select x.semana, x.j into v_mal
    from (
      select semana, a as j from calendario_cargado
      union all
      select semana, b from calendario_cargado
    ) x
   group by x.semana, x.j having count(*) > 1 limit 1;
  if found then
    raise exception '% juega dos veces en la semana %', (select nombre from public.usuario where id = v_mal.j), v_mal.semana;
  end if;

  update public.partido p
     set semana = c.semana, semana_fija = true
    from calendario_cargado c, public.division d
   where d.id = p.division_id and d.ranking_id = p_ranking_id and p.tipo = 'regular'
     and p.jugador_a = c.a and p.jugador_b = c.b
     and p.estado = 'pendiente';
  get diagnostics v_fijados = row_count;

  perform public.planificar_semanas(p_ranking_id);
  return v_fijados;
end;
$$;

revoke execute on function public.fijar_calendario(uuid, jsonb) from public, anon;
grant execute on function public.fijar_calendario(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Al abrir, lo que fijó el calendario del club se respeta.
--
-- `planificar_semanas` arma la semana en curso solo cuando no hay nada
-- repartido todavía. Con el calendario cargado en borrador sí hay: los fijos.
-- Para que la primera vez también llene la semana en curso con lo que no fijó
-- el calendario, la condición pasa a mirar solo los partidos no fijos.
-- -----------------------------------------------------------------------------
create or replace function public.planificar_semanas(p_ranking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v_hoy integer;
  v_desde integer;
  v_semana integer;
  v_cupo integer;
  v_ocupados uuid[];
  v_elegido record;
  v_puestos integer := 0;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null or r.estado <> 'abierto' or r.inicio_semanas is null then return 0; end if;

  v_hoy := public.semana_de(r.inicio_semanas, public.hoy_guatemala());

  if exists (
    select 1 from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.semana is not null and not p.semana_fija
  ) then
    v_desde := greatest(v_hoy + 1, 1);
  else
    v_desde := greatest(v_hoy, 1);
  end if;

  update public.partido p set semana = null
    from public.division d
   where d.id = p.division_id and d.ranking_id = p_ranking_id
     and p.tipo = 'regular' and p.estado = 'pendiente' and not p.semana_fija
     and p.semana >= v_desde;

  v_semana := v_desde;
  while exists (
    select 1 from public.partido p join public.division d on d.id = p.division_id
     where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.estado = 'pendiente' and p.semana is null
  ) and v_semana < v_desde + 200 loop
    select coalesce(array_agg(x.jugador), '{}'::uuid[]), count(distinct x.id)
      into v_ocupados, v_cupo
      from (
        select p.id, p.jugador_a as jugador from public.partido p join public.division d on d.id = p.division_id
         where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.semana = v_semana and p.estado <> 'anulado'
        union all
        select p.id, p.jugador_b from public.partido p join public.division d on d.id = p.division_id
         where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.semana = v_semana and p.estado <> 'anulado'
      ) x;
    v_cupo := r.partidos_por_semana - v_cupo;

    while v_cupo > 0 loop
      select p.id, p.jugador_a, p.jugador_b into v_elegido
        from public.partido p
        join public.division d on d.id = p.division_id
       where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.estado = 'pendiente' and p.semana is null
         and not (p.jugador_a = any(v_ocupados)) and not (p.jugador_b = any(v_ocupados))
       order by p.jornada nulls last,
                (select count(*) from public.partido q
                  where q.division_id = p.division_id and q.tipo = 'regular' and q.semana = v_semana),
                public.nivel_division(d.tipo),
                p.creado_en, p.id
       limit 1;
      exit when not found;

      update public.partido set semana = v_semana where id = v_elegido.id;
      v_ocupados := v_ocupados || v_elegido.jugador_a || v_elegido.jugador_b;
      v_cupo := v_cupo - 1;
      v_puestos := v_puestos + 1;
    end loop;

    v_semana := v_semana + 1;
  end loop;

  return v_puestos;
end;
$$;

revoke execute on function public.planificar_semanas(uuid) from public, anon, authenticated;
