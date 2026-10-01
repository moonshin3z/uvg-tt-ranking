-- =============================================================================
-- Tres divisiones y partidos por semana: funciones.
--
-- 1. Las funciones que suponían exactamente Mayor y Menor ahora trabajan con
--    las divisiones que tenga el ranking (2 o 3), ordenadas por nivel:
--    Primera es la de arriba. Entre cada par de divisiones vecinas suben
--    `n_ascienden` y bajan `n_descienden`; en cada división premian a los
--    primeros `n_premiados`.
--
-- 2. Partidos por semana. Al abrir el ranking, la base reparte los partidos en
--    semanas de hasta `partidos_por_semana`, sin que nadie juegue dos veces la
--    misma semana. Las semanas que ya empezaron no se tocan, porque ya se
--    anunciaron en el grupo. Si se juega un partido de una semana que todavía
--    no llegó, pasa a la semana en que se jugó y las siguientes se vuelven a
--    armar. Un partido que no se jugó en su semana queda pendiente donde
--    estaba: no suma y lo decide el coordinador, que puede pasarlo a otra.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ayudantes
-- -----------------------------------------------------------------------------

-- 1 = Primera, 2 = Segunda, 3 = Tercera: la posición en el enum.
create or replace function public.nivel_division(p_tipo public.division_tipo)
returns integer
language sql
stable
set search_path = public
as $$
  select array_position(enum_range(null::public.division_tipo), p_tipo);
$$;

create or replace function public.division_de_nivel(p_nivel integer)
returns public.division_tipo
language sql
stable
set search_path = public
as $$
  select (enum_range(null::public.division_tipo))[p_nivel];
$$;

-- El día de hoy en Guatemala. Las semanas se cuentan en hora local: a las 7 de
-- la noche del domingo en Guatemala ya es lunes en UTC.
create or replace function public.hoy_guatemala()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Guatemala')::date;
$$;

-- Número de semana de un día, con la semana 1 empezando el lunes `p_inicio`.
-- Antes del inicio da 0 o menos.
create or replace function public.semana_de(p_inicio date, p_dia date)
returns integer
language sql
immutable
as $$
  select case when p_inicio is null or p_dia is null then null
              else floor((p_dia - p_inicio)::numeric / 7)::integer + 1 end;
$$;

-- Jornada del todos contra todos por el método del círculo, de 1 en adelante.
-- `p_i` y `p_j` son las posiciones (desde 0) de los dos jugadores dentro de la
-- división y `p_n` cuántos son. Con un número impar se agrega un jugador
-- fantasma: el que le toca contra él, descansa esa jornada.
create or replace function public.jornada_circular(p_i integer, p_j integer, p_n integer)
returns smallint
language sql
immutable
as $$
  select (
    case
      when greatest(p_i, p_j) = m - 1 then (2 * least(p_i, p_j)) % (m - 1)
      else (p_i + p_j) % (m - 1)
    end + 1
  )::smallint
  from (select case when p_n % 2 = 0 then p_n else p_n + 1 end as m) x;
$$;

-- -----------------------------------------------------------------------------
-- Crear un ranking: ahora con cuántas divisiones y cuántos partidos por semana.
--
-- Agregar parámetros con default crearía una segunda versión de la función, y
-- con dos versiones PostgREST responde 300. Se borra la anterior primero.
-- Los defaults de ascensos, descensos y premios pasan a 2, que es lo que
-- decidió el club.
-- -----------------------------------------------------------------------------
drop function if exists public.crear_ranking(
  uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer, smallint, smallint
);

create or replace function public.crear_ranking(
  p_semestre_id uuid,
  p_numero smallint,
  p_nombre text,
  p_fecha_limite date,
  p_pts_victoria smallint default 1,
  p_pts_derrota smallint default 0,
  p_n_ascienden smallint default 2,
  p_n_descienden smallint default 2,
  p_n_premiados smallint default 2,
  p_horas_autoconfirmacion integer default 72,
  p_sets_para_ganar smallint default 2,
  p_puntos_por_set smallint default 11,
  p_divisiones smallint default 3,
  p_partidos_por_semana smallint default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform public.exigir_coordinador();

  if coalesce(p_sets_para_ganar, 0) < 1 then
    raise exception 'Hay que ganar al menos un set';
  end if;

  if coalesce(p_divisiones, 0) < 2 or p_divisiones > array_length(enum_range(null::public.division_tipo), 1) then
    raise exception 'Un ranking tiene entre 2 y % divisiones', array_length(enum_range(null::public.division_tipo), 1);
  end if;

  if exists (select 1 from public.ranking where estado::text not in ('cerrado', 'cancelado')) then
    raise exception 'Ya hay un ranking en curso; cerralo, cancelalo o borralo antes de crear otro';
  end if;

  insert into public.ranking (
    semestre_id, numero, nombre, fecha_limite, pts_victoria, pts_derrota,
    n_ascienden, n_descienden, n_premiados, horas_autoconfirmacion,
    sets_para_ganar, puntos_por_set, partidos_por_semana
  ) values (
    p_semestre_id, p_numero, btrim(p_nombre), p_fecha_limite, p_pts_victoria, p_pts_derrota,
    p_n_ascienden, p_n_descienden, p_n_premiados, p_horas_autoconfirmacion,
    coalesce(p_sets_para_ganar, 2), coalesce(p_puntos_por_set, 11), coalesce(p_partidos_por_semana, 5)
  ) returning id into v_id;

  insert into public.division (ranking_id, tipo)
  select v_id, e.tipo
    from unnest(enum_range(null::public.division_tipo)) with ordinality as e(tipo, nivel)
   where e.nivel <= p_divisiones;

  return v_id;
end;
$$;

revoke execute on function public.crear_ranking(
  uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer, smallint, smallint, smallint, smallint
) from public, anon;
grant execute on function public.crear_ranking(
  uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer, smallint, smallint, smallint, smallint
) to authenticated;

-- -----------------------------------------------------------------------------
-- El ranking siguiente: hereda también cuántas divisiones y partidos por semana.
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
  v_divisiones smallint;
begin
  perform public.exigir_coordinador();
  select * into a from public.ranking where id = p_ranking_anterior;
  if a.id is null then raise exception 'Ranking anterior no existe'; end if;
  if a.estado <> 'cerrado' then raise exception 'Cerrá el ranking anterior primero'; end if;

  select nombre into v_semestre from public.semestre where id = p_semestre_id;
  if v_semestre is null then raise exception 'Semestre no existe'; end if;
  v_nombre := 'Ranking ' || p_numero || ' · ' || v_semestre;

  select count(*)::smallint into v_divisiones from public.division where ranking_id = p_ranking_anterior;

  v_nuevo := public.crear_ranking(
    p_semestre_id, p_numero, v_nombre, p_fecha_limite,
    a.pts_victoria, a.pts_derrota, a.n_ascienden, a.n_descienden, a.n_premiados, a.horas_autoconfirmacion,
    a.sets_para_ganar, a.puntos_por_set, greatest(v_divisiones, 2::smallint), a.partidos_por_semana
  );

  update public.ranking set anterior_id = p_ranking_anterior where id = v_nuevo;

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

-- -----------------------------------------------------------------------------
-- Armar las divisiones: cualquier cantidad, cada una con al menos 2.
-- -----------------------------------------------------------------------------
create or replace function public.armar_divisiones(
  p_ranking_id uuid,
  p_asignacion jsonb,
  p_semilla text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.ranking_estado;
  v_anterior uuid;
  v_n integer;
  v_insertados integer;
begin
  perform public.exigir_coordinador();

  select estado, anterior_id into v_estado, v_anterior from public.ranking where id = p_ranking_id;
  if v_estado is null then raise exception 'Ranking no existe'; end if;
  if v_estado <> 'borrador' then raise exception 'Las divisiones solo se cambian en borrador'; end if;

  if p_semilla is not null and v_anterior is not null then
    raise exception 'Este ranking hereda sus divisiones del anterior; el sorteo es solo para el primero. Asigná a mano.';
  end if;

  if jsonb_typeof(p_asignacion) is distinct from 'array' then
    raise exception 'La asignación tiene que ser una lista de jugadores con su división';
  end if;

  -- Un ranking sin divisiones no es un estado posible hoy, pero lo fue: los
  -- creados entre las migraciones 27 y 1001 nacieron así. Si aparece uno, se
  -- arregla en el momento con las divisiones que nombra la asignación.
  select count(*) into v_n from public.division where ranking_id = p_ranking_id;
  if v_n = 0 then
    insert into public.division (ranking_id, tipo)
    select p_ranking_id, e.tipo
      from unnest(enum_range(null::public.division_tipo)) as e(tipo)
     where exists (
       select 1 from jsonb_to_recordset(p_asignacion) as a(usuario_id uuid, division text)
        where a.division = e.tipo::text
     );
    select count(*) into v_n from public.division where ranking_id = p_ranking_id;
  end if;

  if jsonb_array_length(p_asignacion) < 2 * greatest(v_n, 2) then
    raise exception 'Se necesitan al menos % jugadores (2 por división)', 2 * greatest(v_n, 2);
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_asignacion) as a(usuario_id uuid, division text)
     where not exists (
       select 1 from public.division d where d.ranking_id = p_ranking_id and d.tipo::text = a.division
     )
  ) then
    raise exception 'Hay jugadores asignados a una división que este ranking no tiene';
  end if;

  delete from public.partido where division_id in (select id from public.division where ranking_id = p_ranking_id);
  delete from public.inscripcion where division_id in (select id from public.division where ranking_id = p_ranking_id);
  delete from public.sorteo where ranking_id = p_ranking_id;
  delete from public.retiro where ranking_id = p_ranking_id;

  insert into public.inscripcion (division_id, usuario_id, origen)
  select
    d.id,
    a.usuario_id,
    case when p_semilla is null then 'manual'::public.inscripcion_origen else 'sorteo'::public.inscripcion_origen end
  from jsonb_to_recordset(p_asignacion) as a(usuario_id uuid, division text)
  join public.division d on d.ranking_id = p_ranking_id and d.tipo::text = a.division;

  get diagnostics v_insertados = row_count;

  if exists (
    select 1 from public.division d
     where d.ranking_id = p_ranking_id
       and (select count(*) from public.inscripcion i where i.division_id = d.id) < 2
  ) then
    raise exception 'Cada división necesita al menos 2 jugadores';
  end if;

  if exists (
    select 1 from public.inscripcion i
      join public.division d on d.id = i.division_id
      join public.usuario u on u.id = i.usuario_id
     where d.ranking_id = p_ranking_id and not u.activo
  ) then
    raise exception 'Hay jugadores inactivos en la asignación';
  end if;

  if p_semilla is not null then
    insert into public.sorteo (ranking_id, semilla, ejecutado_por, resultado)
    values (p_ranking_id, p_semilla, auth.uid(), p_asignacion);
  end if;

  return v_insertados;
end;
$$;

-- -----------------------------------------------------------------------------
-- El calendario: todos contra todos, ahora con la jornada de cada partido.
-- -----------------------------------------------------------------------------
create or replace function public.generar_calendario(p_ranking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.ranking_estado;
  v_creados integer;
begin
  perform public.exigir_coordinador();

  select estado into v_estado from public.ranking where id = p_ranking_id;
  if v_estado is null then raise exception 'Ranking no existe'; end if;
  if v_estado <> 'borrador' then raise exception 'El calendario solo se genera en borrador'; end if;

  delete from public.partido p using public.division d
  where p.division_id = d.id and d.ranking_id = p_ranking_id;

  insert into public.partido (division_id, jugador_a, jugador_b, tipo, jornada)
  with jug as (
    select i.division_id, i.usuario_id,
           (row_number() over (partition by i.division_id order by u.nombre, i.usuario_id) - 1)::integer as k,
           (count(*) over (partition by i.division_id))::integer as n
      from public.inscripcion i
      join public.division d on d.id = i.division_id
      join public.usuario u on u.id = i.usuario_id
     where d.ranking_id = p_ranking_id
  )
  select a.division_id, least(a.usuario_id, b.usuario_id), greatest(a.usuario_id, b.usuario_id), 'regular',
         public.jornada_circular(a.k, b.k, a.n)
    from jug a
    join jug b on b.division_id = a.division_id and a.usuario_id < b.usuario_id;

  get diagnostics v_creados = row_count;
  if v_creados = 0 then raise exception 'No hay inscripciones; armá las divisiones primero'; end if;
  return v_creados;
end;
$$;

-- -----------------------------------------------------------------------------
-- Repartir los partidos en semanas.
--
-- Las semanas que ya empezaron no se tocan: ya se anunciaron. La primera vez
-- (nada repartido todavía) se arma también la semana en curso. Se reparten de
-- nuevo los pendientes que no fijó el coordinador.
--
-- Cada semana se llena con hasta `partidos_por_semana` partidos sin que nadie
-- juegue dos veces. Primero las jornadas más tempranas, y entre partidos de la
-- misma jornada, el de la división que menos lleva esa semana. Así las tres
-- divisiones avanzan parejo y con 5, 5 y 5 jugadores salen 6 semanas de 5.
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
     where d.ranking_id = p_ranking_id and p.tipo = 'regular' and p.semana is not null
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

-- -----------------------------------------------------------------------------
-- Abrir el ranking: valida con cualquier cantidad de divisiones, fija la
-- semana 1 y reparte los partidos.
--
-- Sin `p_inicio_semanas`, la semana 1 es esta si hoy es lunes o martes (se
-- juega martes, miércoles y jueves) y la que viene si no.
-- -----------------------------------------------------------------------------
drop function if exists public.abrir_ranking(uuid);

create or replace function public.abrir_ranking(p_ranking_id uuid, p_inicio_semanas date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  d record;
  v_n integer;
  v_partidos integer;
  v_esperados integer := 0;
  v_hoy date := public.hoy_guatemala();
  v_inicio date;
begin
  perform public.exigir_coordinador();

  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado <> 'borrador' then raise exception 'El ranking ya no está en borrador'; end if;
  if r.fecha_limite < current_date then raise exception 'La fecha límite ya pasó'; end if;

  select count(*) into v_n from public.division where ranking_id = p_ranking_id;

  for d in
    select dv.tipo, public.nivel_division(dv.tipo) as nivel, initcap(dv.tipo::text) as nombre,
           (select count(*) from public.inscripcion i where i.division_id = dv.id)::integer as c
      from public.division dv where dv.ranking_id = p_ranking_id
     order by 2
  loop
    if d.c < 2 then raise exception 'Cada división necesita al menos 2 jugadores'; end if;
    if d.nivel > 1 and r.n_ascienden > d.c then
      raise exception 'n_ascienden (%) supera los jugadores de % (%)', r.n_ascienden, d.nombre, d.c;
    end if;
    if d.nivel < v_n and r.n_descienden > d.c then
      raise exception 'n_descienden (%) supera los jugadores de % (%)', r.n_descienden, d.nombre, d.c;
    end if;
    if d.nivel > 1 and d.nivel < v_n and r.n_ascienden + r.n_descienden > d.c then
      raise exception 'En % no alcanzan los jugadores para que suban % y bajen % (tiene %)',
        d.nombre, r.n_ascienden, r.n_descienden, d.c;
    end if;
    v_esperados := v_esperados + (d.c * (d.c - 1)) / 2;
  end loop;

  select count(*) into v_partidos from public.partido p join public.division dv on dv.id = p.division_id
    where dv.ranking_id = p_ranking_id and p.tipo = 'regular';
  if v_partidos <> v_esperados then
    raise exception 'El calendario no está completo (% de % partidos); generalo de nuevo', v_partidos, v_esperados;
  end if;

  v_inicio := date_trunc('week', coalesce(
    p_inicio_semanas,
    case when extract(isodow from v_hoy) <= 2 then v_hoy else v_hoy + 7 end
  ))::date;

  update public.ranking set estado = 'abierto', inicio_semanas = v_inicio where id = p_ranking_id;
  perform public.planificar_semanas(p_ranking_id);
end;
$$;

revoke execute on function public.abrir_ranking(uuid, date) from public, anon;
grant execute on function public.abrir_ranking(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Cuando un partido deja de estar pendiente (o vuelve a estarlo), las semanas
-- que no empezaron se arman de nuevo.
--
-- Antes de guardar: si se jugó un partido de una semana que todavía no llegó,
-- pasa a la semana en que se jugó. Si vuelve a pendiente un partido anulado
-- (deshacer un retiro), queda sin semana para que se reparta otra vez.
-- -----------------------------------------------------------------------------
create or replace function public.tg_partido_semana()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_hoy integer;
begin
  if new.division_id is null or new.tipo <> 'regular' then return new; end if;
  select r.inicio_semanas into v_inicio
    from public.division d join public.ranking r on r.id = d.ranking_id
   where d.id = new.division_id;
  if v_inicio is null then return new; end if;

  v_hoy := greatest(public.semana_de(v_inicio, public.hoy_guatemala()), 1);

  if old.estado = 'pendiente' and new.estado not in ('pendiente', 'anulado')
     and new.semana is not null and new.semana > v_hoy then
    new.semana := v_hoy;
    new.semana_fija := false;
  end if;

  if old.estado = 'anulado' and new.estado = 'pendiente' then
    new.semana := null;
    new.semana_fija := false;
  end if;

  return new;
end;
$$;

create or replace function public.tg_partido_replanificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ranking uuid;
begin
  if new.division_id is null or new.tipo <> 'regular' then return null; end if;
  select d.ranking_id into v_ranking from public.division d where d.id = new.division_id;
  perform public.planificar_semanas(v_ranking);
  return null;
end;
$$;

revoke execute on function public.tg_partido_semana() from public, anon, authenticated;
revoke execute on function public.tg_partido_replanificar() from public, anon, authenticated;

drop trigger if exists partido_semana on public.partido;
create trigger partido_semana
  before update of estado on public.partido
  for each row
  when (old.estado is distinct from new.estado)
  execute function public.tg_partido_semana();

drop trigger if exists partido_replanificar on public.partido;
create trigger partido_replanificar
  after update of estado on public.partido
  for each row
  when (old.estado is distinct from new.estado and (old.estado = 'pendiente' or new.estado = 'pendiente'))
  execute function public.tg_partido_replanificar();

-- -----------------------------------------------------------------------------
-- El coordinador pasa un partido pendiente a otra semana, o lo suelta para que
-- lo acomode la app (sin p_semana).
-- -----------------------------------------------------------------------------
create or replace function public.mover_partido_a_semana(p_partido_id uuid, p_semana smallint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  r public.ranking%rowtype;
  v_hoy integer;
begin
  perform public.exigir_coordinador();

  select * into p from public.partido where id = p_partido_id;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if p.division_id is null or p.tipo <> 'regular' then
    raise exception 'Solo los partidos del ranking tienen semana';
  end if;
  if p.estado <> 'pendiente' then raise exception 'Ese partido ya se jugó'; end if;

  select rk.* into r from public.division d join public.ranking rk on rk.id = d.ranking_id where d.id = p.division_id;
  if r.estado <> 'abierto' or r.inicio_semanas is null then
    raise exception 'El ranking no está repartido en semanas';
  end if;

  v_hoy := greatest(public.semana_de(r.inicio_semanas, public.hoy_guatemala()), 1);
  if p_semana is not null and p_semana < v_hoy then
    raise exception 'Esa semana ya pasó; elegí esta o una que venga';
  end if;

  update public.partido
     set semana = p_semana, semana_fija = p_semana is not null
   where id = p_partido_id;

  perform public.planificar_semanas(r.id);
end;
$$;

revoke execute on function public.mover_partido_a_semana(uuid, smallint) from public, anon;
grant execute on function public.mover_partido_a_semana(uuid, smallint) to authenticated;

-- El coordinador cambia cuántos partidos van por semana. Las semanas que ya
-- empezaron quedan como estaban.
create or replace function public.ajustar_partidos_por_semana(p_ranking_id uuid, p_cantidad smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_coordinador();
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 30 then
    raise exception 'Entre 1 y 30 partidos por semana';
  end if;
  update public.ranking set partidos_por_semana = p_cantidad where id = p_ranking_id;
  if not found then raise exception 'Ranking no existe'; end if;
  perform public.planificar_semanas(p_ranking_id);
end;
$$;

revoke execute on function public.ajustar_partidos_por_semana(uuid, smallint) from public, anon;
grant execute on function public.ajustar_partidos_por_semana(uuid, smallint) to authenticated;

-- -----------------------------------------------------------------------------
-- Empates que importan: premio en todas; ascenso donde hay una división arriba
-- y descenso donde hay una abajo.
-- -----------------------------------------------------------------------------
create or replace function public.empates_relevantes(p_ranking_id uuid)
returns table (
  division_id uuid,
  division public.division_tipo,
  pts integer,
  min_pos integer,
  max_pos integer,
  motivo text,
  accion text,
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
  v_total int;
  corte_descenso int;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  select count(*) into v_total from public.division dv where dv.ranking_id = p_ranking_id;

  for d in
    select dv.id, dv.tipo, public.nivel_division(dv.tipo) as nivel
      from public.division dv where dv.ranking_id = p_ranking_id
  loop
    select count(*) into n from public.inscripcion i where i.division_id = d.id;
    corte_descenso := n - r.n_descienden;

    return query
    with pos as (select * from public.orden_division(d.id)),
    grupos as (
      -- Siguen empatados solo si coinciden en TODO lo que ordena la tabla.
      -- Si algún criterio los separó, el empate está resuelto.
      select p.pts as gpts, min(p.posicion) as mn, max(p.posicion) as mx,
             array_agg(p.usuario_id order by p.nombre) as us,
             array_agg(p.nombre order by p.nombre) as nb,
             bool_or(p.pg_desempate > 0) as jugaron_desempate
      from pos p
      group by p.pts, p.pg_desempate, p.dif_sets_desempate, p.gano_directo, p.dif_sets, p.orden_manual
      having count(*) > 1
    )
    select d.id, d.tipo, g.gpts, g.mn, g.mx,
      case
        when g.mn <= r.n_premiados then 'premio'
        when d.nivel > 1 and g.mn <= r.n_ascienden then 'ascenso'
        else 'descenso'
      end,
      case
        when exists (
          select 1 from public.partido p
           where p.division_id = d.id and p.tipo = 'desempate'
             and p.estado in ('confirmado', 'resuelto')
             and p.jugador_a = any(g.us) and p.jugador_b = any(g.us)
        ) then 'decidir' else 'jugar'
      end,
      g.us, g.nb
    from grupos g
    where g.mn <= r.n_premiados
       or (d.nivel > 1 and g.mn <= r.n_ascienden and g.mx > r.n_ascienden)
       or (d.nivel < v_total and g.mn <= corte_descenso and g.mx > corte_descenso);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Propuesta para el ranking siguiente: los primeros suben una división, los
-- últimos bajan una, y el que no jugó entra en la de más abajo.
-- -----------------------------------------------------------------------------
create or replace function public.proponer_siguiente(p_ranking_id uuid)
returns table (
  usuario_id uuid,
  nombre text,
  carnet text,
  division_actual public.division_tipo,
  posicion integer,
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
  v_total int;
begin
  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  select count(*) into v_total from public.division dv where dv.ranking_id = p_ranking_id;

  for d in
    select dv.id, dv.tipo, public.nivel_division(dv.tipo) as nivel
      from public.division dv where dv.ranking_id = p_ranking_id
  loop
    select count(*) into n from public.inscripcion i where i.division_id = d.id;
    return query
    select p.usuario_id, p.nombre, u.carnet, d.tipo, p.posicion,
      case
        when d.nivel > 1 and p.posicion <= r.n_ascienden then public.division_de_nivel(d.nivel - 1)
        when d.nivel < v_total and p.posicion > n - r.n_descienden then public.division_de_nivel(d.nivel + 1)
        else d.tipo
      end,
      case
        when d.nivel > 1 and p.posicion <= r.n_ascienden then 'ascenso'::public.inscripcion_origen
        when d.nivel < v_total and p.posicion > n - r.n_descienden then 'descenso'::public.inscripcion_origen
        else 'permanece'::public.inscripcion_origen
      end
    from public.posiciones_division(d.id) p
    join public.usuario u on u.id = p.usuario_id;
  end loop;

  -- Los que no estaban. `division_actual` y `posicion` van en null justamente
  -- porque no tienen: es lo que distingue a un jugador nuevo de uno que
  -- permanece, y la pantalla lo usa para marcarlo.
  return query
  select u.id, u.nombre, u.carnet,
         null::public.division_tipo, null::int,
         public.division_de_nivel(greatest(v_total, 1)), 'nuevo'::public.inscripcion_origen
    from public.usuario u
   where u.activo
     and not exists (
       select 1 from public.inscripcion i
         join public.division dv on dv.id = i.division_id
        where dv.ranking_id = p_ranking_id and i.usuario_id = u.id
     )
   order by u.nombre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial del perfil: ahora dice cuántas divisiones tenía cada ranking, para
-- saber si había una arriba (pudo subir) o una abajo (pudo bajar).
-- Cambia lo que devuelve, así que se borra y se crea con los mismos permisos.
-- -----------------------------------------------------------------------------
drop function if exists public.historial_jugador(uuid);

create function public.historial_jugador(p_usuario_id uuid)
returns table (
  ranking_id uuid,
  ranking_nombre text,
  ranking_estado public.ranking_estado,
  division public.division_tipo,
  posicion integer,
  jugadores_division integer,
  pj integer,
  pg integer,
  pp integer,
  pts integer,
  n_premiados smallint,
  n_ascienden smallint,
  n_descienden smallint,
  divisiones integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.nombre,
    r.estado,
    d.tipo,
    pos.posicion::int,
    (select count(*) from public.inscripcion i2 where i2.division_id = d.id)::int,
    coalesce(t.pj, 0),
    coalesce(t.pg, 0),
    coalesce(t.pp, 0),
    coalesce(t.pts, 0),
    r.n_premiados,
    r.n_ascienden,
    r.n_descienden,
    (select count(*) from public.division d2 where d2.ranking_id = r.id)::int
  from public.inscripcion i
  join public.division d on d.id = i.division_id
  join public.ranking r on r.id = d.ranking_id
  join lateral public.posiciones_division(d.id) pos on pos.usuario_id = i.usuario_id
  left join public.tabla_posiciones t on t.division_id = d.id and t.usuario_id = i.usuario_id
  where i.usuario_id = p_usuario_id
    and r.estado::text not in ('borrador', 'cancelado')
  order by r.creado_en desc;
$$;

grant execute on function public.historial_jugador(uuid) to anon, authenticated;
