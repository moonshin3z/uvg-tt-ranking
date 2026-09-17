-- Dos arreglos de la migración 27, que reescribió funciones enteras en vez de
-- extenderlas y perdió cosas por el camino.
--
-- 1. `crear_ranking` dejó de crear las divisiones.
--
-- La versión de la migración 15 terminaba con:
--
--     insert into public.division (ranking_id, tipo) values (v_id,'mayor'), (v_id,'menor');
--
-- La 27 la reescribió de cero para agregarle los sets y esa línea se quedó
-- afuera. El ranking se crea bien y no da ningún error; el problema aparece
-- después, al armar las divisiones, porque `armar_divisiones` busca la mayor y
-- la menor del ranking, no las encuentra, y el insert revienta con
-- «null value in column division_id», que no le dice nada a nadie.
--
-- 2. `crear_ranking_siguiente` no heredaba las reglas del ranking anterior.
--
-- Copiaba puntos, ascensos, descensos, premios y horas de autoconfirmación,
-- pero no los sets ni los puntos por set, porque llama a `crear_ranking` por
-- posición con diez argumentos y los dos que faltan tomaban su valor por
-- omisión. El ranking 2 volvía callado a 2 de 3 a 11 aunque el 1 estuviera al
-- mejor de 5, y el primer resultado de 3-1 se rechazaba sin explicación.

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
  p_horas_autoconfirmacion integer default 72,
  p_sets_para_ganar smallint default 2,
  p_puntos_por_set smallint default 11
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare v_id uuid;
begin
  perform public.exigir_coordinador();
  if coalesce(p_sets_para_ganar, 0) < 1 then
    raise exception 'Hay que ganar al menos un set';
  end if;
  insert into public.ranking (
    semestre_id, numero, nombre, fecha_limite, pts_victoria, pts_derrota,
    n_ascienden, n_descienden, n_premiados, horas_autoconfirmacion,
    sets_para_ganar, puntos_por_set
  ) values (
    p_semestre_id, p_numero, btrim(p_nombre), p_fecha_limite, p_pts_victoria, p_pts_derrota,
    p_n_ascienden, p_n_descienden, p_n_premiados, p_horas_autoconfirmacion,
    coalesce(p_sets_para_ganar, 2), coalesce(p_puntos_por_set, 11)
  ) returning id into v_id;

  -- Esto es lo que había perdido la migración 27.
  insert into public.division (ranking_id, tipo) values (v_id, 'mayor'), (v_id, 'menor');

  return v_id;
end;
$fn$;

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
