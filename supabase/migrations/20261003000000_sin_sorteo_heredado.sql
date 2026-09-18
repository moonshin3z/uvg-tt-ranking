-- El sorteo es una sola vez, en el primer ranking del club.
--
-- De ahí en adelante las divisiones salen de la tabla anterior: los primeros de
-- Menor suben, los últimos de Mayor bajan, el resto permanece. Eso ya lo hacía
-- `crear_ranking_siguiente`, pero nada impedía volver a sortear el ranking
-- heredado mientras estuviera en borrador, y un sorteo borra todos los ascensos
-- y descensos sin avisar. Acá se prohíbe en la base, no solo en la pantalla:
-- cualquiera con sesión de coordinador puede llamar a la función directamente.
--
-- Lo que sigue permitido en un ranking heredado es la asignación manual, que es
-- como el coordinador sube a un jugador nuevo o corrige un caso raro.

-- -----------------------------------------------------------------------------
-- 1. El ranking siguiente deja dicho de dónde viene.
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
    a.pts_victoria, a.pts_derrota, a.n_ascienden, a.n_descienden, a.n_premiados, a.horas_autoconfirmacion,
    a.sets_para_ganar, a.puntos_por_set
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
-- 2. La propuesta incluye a los que no estaban en el ranking anterior.
--
-- El que se inscribió al club después del primer ranking, y el que se había
-- retirado y vuelve, entran los dos en Menor. El coordinador puede subirlos a
-- mano antes de abrir, o desmarcarlos si no van a jugar.
-- -----------------------------------------------------------------------------
drop function if exists public.proponer_siguiente(uuid);

create function public.proponer_siguiente(p_ranking_id uuid)
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

  -- Los que no estaban. `division_actual` y `posicion` van en null justamente
  -- porque no tienen: es lo que distingue a un jugador nuevo de uno que
  -- permanece, y la pantalla lo usa para marcarlo.
  return query
  select u.id, u.nombre, u.carnet,
         null::public.division_tipo, null::int,
         'menor'::public.division_tipo, 'nuevo'::public.inscripcion_origen
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

revoke execute on function public.proponer_siguiente(uuid) from public, anon;
grant execute on function public.proponer_siguiente(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Sortear un ranking heredado queda prohibido.
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
  v_mayor uuid;
  v_menor uuid;
  v_insertados integer;
begin
  perform public.exigir_coordinador();

  select estado, anterior_id into v_estado, v_anterior from public.ranking where id = p_ranking_id;
  if v_estado is null then raise exception 'Ranking no existe'; end if;
  if v_estado <> 'borrador' then raise exception 'Las divisiones solo se cambian en borrador'; end if;

  if p_semilla is not null and v_anterior is not null then
    raise exception 'Este ranking hereda sus divisiones del anterior; el sorteo es solo para el primero. Asigná a mano.';
  end if;

  select id into v_mayor from public.division where ranking_id = p_ranking_id and tipo = 'mayor';
  select id into v_menor from public.division where ranking_id = p_ranking_id and tipo = 'menor';

  if jsonb_typeof(p_asignacion) <> 'array' or jsonb_array_length(p_asignacion) < 4 then
    raise exception 'Se necesitan al menos 4 jugadores (2 por división)';
  end if;

  -- Limpiar lo anterior (calendario y sorteo incluidos)
  delete from public.partido where division_id in (v_mayor, v_menor);
  delete from public.inscripcion where division_id in (v_mayor, v_menor);
  delete from public.sorteo where ranking_id = p_ranking_id;
  -- Los retiros son de la composición anterior; rearmar los deja sin sentido.
  delete from public.retiro where ranking_id = p_ranking_id;

  insert into public.inscripcion (division_id, usuario_id, origen)
  select
    case a.division when 'mayor' then v_mayor when 'menor' then v_menor end,
    a.usuario_id,
    case when p_semilla is null then 'manual'::public.inscripcion_origen else 'sorteo'::public.inscripcion_origen end
  from jsonb_to_recordset(p_asignacion) as a(usuario_id uuid, division text);

  get diagnostics v_insertados = row_count;

  if (select count(*) from public.inscripcion where division_id = v_mayor) < 2
     or (select count(*) from public.inscripcion where division_id = v_menor) < 2 then
    raise exception 'Cada división necesita al menos 2 jugadores';
  end if;

  if exists (
    select 1 from public.inscripcion i join public.usuario u on u.id = i.usuario_id
    where i.division_id in (v_mayor, v_menor) and not u.activo
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

revoke execute on function public.armar_divisiones(uuid, jsonb, text) from public, anon;
grant execute on function public.armar_divisiones(uuid, jsonb, text) to authenticated;
