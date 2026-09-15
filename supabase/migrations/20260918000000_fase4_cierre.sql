-- =============================================================================
-- Fase 4: cierre del ranking.
--
-- Flujo: abierto -> (todos los partidos resueltos) -> fase_regular_cerrada
--        -> (si hay empates relevantes) en_desempates -> cerrado
--        -> el coordinador crea el ranking siguiente con los ascensos/descensos
--
-- Reglamento aplicado:
--   * Un empate se rompe con partido adicional entre los empatados; si son
--     tres o más, todos contra todos entre ellos (rondas sucesivas si hace
--     falta: "la organización puede pedir desempates extra").
--   * Empate relevante = afecta premio (1º a 3º), ascenso o descenso.
--   * Suben los n_ascienden primeros de Menor, bajan los n_descienden últimos
--     de Mayor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rondas de desempate: permite más de un desempate entre la misma pareja.
-- Los partidos regulares quedan todos en ronda 1, así que siguen siendo únicos.
-- -----------------------------------------------------------------------------
alter table public.partido add column if not exists ronda smallint not null default 1;
drop index if exists public.partido_unico_por_pareja;
create unique index if not exists partido_unico_por_pareja
  on public.partido (division_id, jugador_a, jugador_b, tipo, ronda);

-- -----------------------------------------------------------------------------
-- Posiciones de una división.
--
-- El orden aquí (pts, desempates ganados, nombre) coincide con el de la tabla
-- pública en los puestos que deciden algo: cualquier empate que afecte premio,
-- ascenso o descenso se rompe con partidos antes de poder cerrar, así que los
-- criterios extra que usa la vista (enfrentamiento directo) solo alteran
-- puestos que no cambian ningún resultado.
-- -----------------------------------------------------------------------------
create or replace function public.posiciones_division(p_division_id uuid)
returns table (usuario_id uuid, nombre text, pts int, pg_desempate int, posicion int)
language sql
stable
security definer
set search_path = public
as $$
  select t.usuario_id, t.nombre, t.pts, t.pg_desempate,
         row_number() over (order by t.pts desc, t.pg_desempate desc, t.nombre)::int
  from public.tabla_posiciones t
  where t.division_id = p_division_id;
$$;

-- -----------------------------------------------------------------------------
-- Empates que hay que romper antes de cerrar.
-- -----------------------------------------------------------------------------
create or replace function public.empates_relevantes(p_ranking_id uuid)
returns table (
  division_id uuid,
  division public.division_tipo,
  pts int,
  min_pos int,
  max_pos int,
  motivo text,
  usuarios uuid[],
  nombres text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  d record;
  n int;
  corte_descenso int;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;

  for d in select dv.id, dv.tipo from public.division dv where dv.ranking_id = p_ranking_id loop
    select count(*) into n from public.inscripcion i where i.division_id = d.id;
    corte_descenso := n - r.n_descienden;

    return query
    with pos as (select * from public.posiciones_division(d.id)),
    grupos as (
      -- Siguen empatados solo si coinciden en puntos Y en desempates ganados:
      -- ese es exactamente el orden que usa posiciones_division.
      select p.pts as gpts, min(p.posicion) as mn, max(p.posicion) as mx,
             array_agg(p.usuario_id order by p.nombre) as us,
             array_agg(p.nombre order by p.nombre) as nb
      from pos p group by p.pts, p.pg_desempate having count(*) > 1
    )
    select d.id, d.tipo, g.gpts, g.mn, g.mx,
      case
        when g.mn <= r.n_premiados then 'premio'
        when d.tipo = 'menor' then 'ascenso'
        else 'descenso'
      end,
      g.us, g.nb
    from grupos g
    where g.mn <= r.n_premiados
       or (d.tipo = 'menor' and g.mn <= r.n_ascienden and g.mx > r.n_ascienden)
       or (d.tipo = 'mayor' and g.mn <= corte_descenso and g.mx > corte_descenso);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cerrar la fase regular: exige que ningún partido regular quede sin definir.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_fase_regular(p_ranking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v_sin_jugar int;
  v_sin_confirmar int;
  v_disputados int;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado <> 'abierto' then raise exception 'La fase regular no está abierta (estado: %)', r.estado; end if;

  select
    count(*) filter (where p.estado = 'pendiente'),
    count(*) filter (where p.estado = 'jugado'),
    count(*) filter (where p.estado = 'disputado')
  into v_sin_jugar, v_sin_confirmar, v_disputados
  from public.partido p
  join public.division d on d.id = p.division_id
  where d.ranking_id = p_ranking_id and p.tipo = 'regular';

  if v_sin_jugar > 0 or v_sin_confirmar > 0 or v_disputados > 0 then
    raise exception 'Faltan definir partidos: % sin jugar, % sin confirmar, % en disputa',
      v_sin_jugar, v_sin_confirmar, v_disputados;
  end if;

  update public.ranking set estado = 'fase_regular_cerrada' where id = p_ranking_id;
  return (select count(*)::int from public.empates_relevantes(p_ranking_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Generar los partidos de desempate (todos contra todos dentro de cada grupo).
-- Se puede llamar varias veces: cada llamada abre una ronda nueva para los
-- grupos que sigan empatados.
-- -----------------------------------------------------------------------------
create or replace function public.generar_desempates(p_ranking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  g record;
  v_ronda smallint;
  v_creados int := 0;
  i int;
  k int;
  v_pendientes int;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado not in ('fase_regular_cerrada', 'en_desempates') then
    raise exception 'Primero cerrá la fase regular';
  end if;

  select count(*) into v_pendientes
  from public.partido p join public.division d on d.id = p.division_id
  where d.ranking_id = p_ranking_id and p.tipo = 'desempate'
    and p.estado in ('pendiente', 'jugado', 'disputado');
  if v_pendientes > 0 then
    raise exception 'Todavía hay % desempates sin definir', v_pendientes;
  end if;

  for g in select * from public.empates_relevantes(p_ranking_id) loop
    select coalesce(max(p.ronda), 0) + 1 into v_ronda
    from public.partido p where p.division_id = g.division_id and p.tipo = 'desempate';

    for i in 1 .. array_length(g.usuarios, 1) loop
      for k in i + 1 .. array_length(g.usuarios, 1) loop
        insert into public.partido (division_id, jugador_a, jugador_b, tipo, ronda)
        values (
          g.division_id,
          least(g.usuarios[i], g.usuarios[k]),
          greatest(g.usuarios[i], g.usuarios[k]),
          'desempate',
          v_ronda
        )
        on conflict do nothing;
        v_creados := v_creados + 1;
      end loop;
    end loop;
  end loop;

  if v_creados = 0 then raise exception 'No hay empates que romper'; end if;
  update public.ranking set estado = 'en_desempates' where id = p_ranking_id;
  return v_creados;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cerrar el ranking.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_ranking(p_ranking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v_pendientes int;
  v_empates int;
begin
  perform public.exigir_coordinador();
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado not in ('fase_regular_cerrada', 'en_desempates') then
    raise exception 'Primero cerrá la fase regular (estado: %)', r.estado;
  end if;

  select count(*) into v_pendientes
  from public.partido p join public.division d on d.id = p.division_id
  where d.ranking_id = p_ranking_id and p.estado in ('pendiente', 'jugado', 'disputado');
  if v_pendientes > 0 then raise exception 'Quedan % partidos sin definir', v_pendientes; end if;

  select count(*) into v_empates from public.empates_relevantes(p_ranking_id);
  if v_empates > 0 then
    raise exception 'Siguen % empates sin romper; generá otra ronda de desempates', v_empates;
  end if;

  update public.ranking set estado = 'cerrado', cerrado_en = now() where id = p_ranking_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Propuesta de divisiones del ranking siguiente.
-- -----------------------------------------------------------------------------
create or replace function public.proponer_siguiente(p_ranking_id uuid)
returns table (
  usuario_id uuid,
  nombre text,
  carnet text,
  division_actual public.division_tipo,
  posicion int,
  division_propuesta public.division_tipo,
  origen public.inscripcion_origen
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  d record;
  n int;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;

  for d in select dv.id, dv.tipo from public.division dv where dv.ranking_id = p_ranking_id loop
    select count(*) into n from public.inscripcion i where i.division_id = d.id;
    return query
    select p.usuario_id, p.nombre, u.carnet, d.tipo, p.posicion,
      case
        when d.tipo = 'menor' and p.posicion <= r.n_ascienden then 'mayor'::public.division_tipo
        when d.tipo = 'mayor' and p.posicion > n - r.n_descienden then 'menor'::public.division_tipo
        else d.tipo
      end,
      case
        when d.tipo = 'menor' and p.posicion <= r.n_ascienden then 'ascenso'::public.inscripcion_origen
        when d.tipo = 'mayor' and p.posicion > n - r.n_descienden then 'descenso'::public.inscripcion_origen
        else 'permanece'::public.inscripcion_origen
      end
    from public.posiciones_division(d.id) p
    join public.usuario u on u.id = p.usuario_id;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear el ranking siguiente con los ascensos y descensos ya aplicados.
-- p_asignacion permite al coordinador ajustar antes de confirmar; si viene
-- null se usa la propuesta tal cual.
-- -----------------------------------------------------------------------------
create or replace function public.crear_ranking_siguiente(
  p_ranking_anterior uuid,
  p_semestre_id uuid,
  p_numero smallint,
  p_fecha_limite date,
  p_asignacion jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.ranking%rowtype;
  v_nuevo uuid;
  v_nombre text;
  v_semestre text;
  v_asignacion jsonb;
begin
  perform public.exigir_coordinador();
  select * into a from public.ranking where id = p_ranking_anterior;
  if a.id is null then raise exception 'Ranking anterior no existe'; end if;
  if a.estado <> 'cerrado' then raise exception 'Cerrá el ranking anterior primero'; end if;

  select nombre into v_semestre from public.semestre where id = p_semestre_id;
  if v_semestre is null then raise exception 'Semestre no existe'; end if;
  v_nombre := 'Ranking ' || p_numero || ' · ' || v_semestre;

  v_nuevo := public.crear_ranking(
    p_semestre_id, p_numero, v_nombre, p_fecha_limite,
    a.pts_victoria, a.pts_derrota, a.n_ascienden, a.n_descienden, a.n_premiados, a.horas_autoconfirmacion
  );

  v_asignacion := coalesce(
    p_asignacion,
    (select jsonb_agg(jsonb_build_object('usuario_id', s.usuario_id, 'division', s.division_propuesta))
     from public.proponer_siguiente(p_ranking_anterior) s)
  );

  -- Reusa la validación de armar_divisiones, pero conservando el origen real
  perform public.armar_divisiones(v_nuevo, v_asignacion, null);

  update public.inscripcion i set origen = sub.origen
  from (
    select s.usuario_id, s.origen from public.proponer_siguiente(p_ranking_anterior) s
  ) sub
  where i.usuario_id = sub.usuario_id
    and i.division_id in (select id from public.division where ranking_id = v_nuevo);

  return v_nuevo;
end;
$$;

revoke execute on function public.cerrar_fase_regular(uuid) from public, anon;
revoke execute on function public.generar_desempates(uuid) from public, anon;
revoke execute on function public.cerrar_ranking(uuid) from public, anon;
revoke execute on function public.crear_ranking_siguiente(uuid, uuid, smallint, date, jsonb) from public, anon;
