-- =============================================================================
-- Fase 2: el coordinador arma un ranking.
-- Funciones RPC (security definer) que hacen cada paso de forma atómica y
-- validan estado + rol. La UI solo llama a estas funciones; no arma
-- inscripciones ni partidos a mano.
-- =============================================================================

create or replace function public.exigir_coordinador()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_coordinador() then
    raise exception 'Solo el coordinador puede hacer esto' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear ranking en borrador con sus dos divisiones. Devuelve el id.
-- -----------------------------------------------------------------------------
create or replace function public.crear_ranking(
  p_semestre_id uuid,
  p_numero smallint,
  p_nombre text,
  p_fecha_limite date,
  p_pts_victoria smallint default 1,
  p_pts_derrota smallint default 0,
  p_n_ascienden smallint default 3,
  p_n_descienden smallint default 3,
  p_n_premiados smallint default 3,
  p_horas_autoconfirmacion integer default 72
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.exigir_coordinador();

  if exists (select 1 from public.ranking where estado <> 'cerrado') then
    raise exception 'Ya hay un ranking en curso; cerralo antes de crear otro';
  end if;

  insert into public.ranking (
    semestre_id, numero, nombre, fecha_limite,
    pts_victoria, pts_derrota, n_ascienden, n_descienden, n_premiados, horas_autoconfirmacion
  ) values (
    p_semestre_id, p_numero, p_nombre, p_fecha_limite,
    p_pts_victoria, p_pts_derrota, p_n_ascienden, p_n_descienden, p_n_premiados, p_horas_autoconfirmacion
  ) returning id into v_id;

  insert into public.division (ranking_id, tipo) values (v_id, 'mayor'), (v_id, 'menor');
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Armar divisiones. p_asignacion: [{usuario_id, division: 'mayor'|'menor'}].
-- p_semilla no nulo => fue sorteo (se registra en `sorteo`); nulo => manual.
-- Reemplaza la asignación anterior mientras el ranking esté en borrador.
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
  v_mayor uuid;
  v_menor uuid;
  v_insertados integer;
begin
  perform public.exigir_coordinador();

  select estado into v_estado from public.ranking where id = p_ranking_id;
  if v_estado is null then raise exception 'Ranking no existe'; end if;
  if v_estado <> 'borrador' then raise exception 'Las divisiones solo se cambian en borrador'; end if;

  select id into v_mayor from public.division where ranking_id = p_ranking_id and tipo = 'mayor';
  select id into v_menor from public.division where ranking_id = p_ranking_id and tipo = 'menor';

  if jsonb_typeof(p_asignacion) <> 'array' or jsonb_array_length(p_asignacion) < 4 then
    raise exception 'Se necesitan al menos 4 jugadores (2 por división)';
  end if;

  -- Limpiar lo anterior (calendario y sorteo incluidos)
  delete from public.partido where division_id in (v_mayor, v_menor);
  delete from public.inscripcion where division_id in (v_mayor, v_menor);
  delete from public.sorteo where ranking_id = p_ranking_id;

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

-- -----------------------------------------------------------------------------
-- Generar calendario round robin: todos contra todos, una vez, por división.
-- Idempotente: si ya existe, lo regenera (solo en borrador).
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

  insert into public.partido (division_id, jugador_a, jugador_b, tipo)
  select i1.division_id, least(i1.usuario_id, i2.usuario_id), greatest(i1.usuario_id, i2.usuario_id), 'regular'
  from public.inscripcion i1
  join public.inscripcion i2 on i2.division_id = i1.division_id and i1.usuario_id < i2.usuario_id
  join public.division d on d.id = i1.division_id
  where d.ranking_id = p_ranking_id;

  get diagnostics v_creados = row_count;
  if v_creados = 0 then raise exception 'No hay inscripciones; armá las divisiones primero'; end if;
  return v_creados;
end;
$$;

-- -----------------------------------------------------------------------------
-- Abrir el ranking: valida que todo esté listo y pasa a 'abierto'.
-- -----------------------------------------------------------------------------
create or replace function public.abrir_ranking(p_ranking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ranking%rowtype;
  v_mayor integer;
  v_menor integer;
  v_partidos integer;
  v_esperados integer;
begin
  perform public.exigir_coordinador();

  select * into r from public.ranking where id = p_ranking_id;
  if r.id is null then raise exception 'Ranking no existe'; end if;
  if r.estado <> 'borrador' then raise exception 'El ranking ya no está en borrador'; end if;
  if r.fecha_limite < current_date then raise exception 'La fecha límite ya pasó'; end if;

  select count(*) into v_mayor from public.inscripcion i join public.division d on d.id = i.division_id
    where d.ranking_id = p_ranking_id and d.tipo = 'mayor';
  select count(*) into v_menor from public.inscripcion i join public.division d on d.id = i.division_id
    where d.ranking_id = p_ranking_id and d.tipo = 'menor';

  if v_mayor < 2 or v_menor < 2 then raise exception 'Cada división necesita al menos 2 jugadores'; end if;
  if r.n_ascienden > v_menor then raise exception 'n_ascienden (%) supera los jugadores de Menor (%)', r.n_ascienden, v_menor; end if;
  if r.n_descienden > v_mayor then raise exception 'n_descienden (%) supera los jugadores de Mayor (%)', r.n_descienden, v_mayor; end if;

  select count(*) into v_partidos from public.partido p join public.division d on d.id = p.division_id
    where d.ranking_id = p_ranking_id and p.tipo = 'regular';
  v_esperados := (v_mayor * (v_mayor - 1)) / 2 + (v_menor * (v_menor - 1)) / 2;
  if v_partidos <> v_esperados then
    raise exception 'El calendario no está completo (% de % partidos); generalo de nuevo', v_partidos, v_esperados;
  end if;

  update public.ranking set estado = 'abierto' where id = p_ranking_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Semestre: lo crea el coordinador directo (RLS ya lo permite). Índice útil.
-- -----------------------------------------------------------------------------
create index if not exists ranking_estado_idx on public.ranking (estado);

-- Permisos de ejecución: solo usuarios autenticados (dentro se exige rol).
revoke execute on function public.crear_ranking(uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer) from public, anon;
revoke execute on function public.armar_divisiones(uuid, jsonb, text) from public, anon;
revoke execute on function public.generar_calendario(uuid) from public, anon;
revoke execute on function public.abrir_ranking(uuid) from public, anon;
revoke execute on function public.exigir_coordinador() from public, anon;
