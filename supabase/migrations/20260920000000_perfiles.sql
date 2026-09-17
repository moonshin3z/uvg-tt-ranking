-- =============================================================================
-- Perfil público del jugador e historial de rankings.
-- Solo lectura: todo esto ya se podía calcular, faltaba exponerlo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Historial de un jugador: una fila por ranking en el que participó, con su
-- posición final y su récord. Ordenado del más reciente al más viejo.
--
-- Nota: si a alguien lo retiraron de un ranking, su inscripción se borró, así
-- que ese ranking no aparece acá. Es lo correcto: quedó fuera de esa tabla.
-- -----------------------------------------------------------------------------
create or replace function public.historial_jugador(p_usuario_id uuid)
returns table (
  ranking_id uuid,
  ranking_nombre text,
  ranking_estado public.ranking_estado,
  division public.division_tipo,
  posicion int,
  jugadores_division int,
  pj int,
  pg int,
  pp int,
  pts int,
  n_premiados smallint,
  n_ascienden smallint,
  n_descienden smallint
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
    pos.posicion,
    (select count(*) from public.inscripcion i2 where i2.division_id = d.id)::int,
    coalesce(t.pj, 0),
    coalesce(t.pg, 0),
    coalesce(t.pp, 0),
    coalesce(t.pts, 0),
    r.n_premiados,
    r.n_ascienden,
    r.n_descienden
  from public.inscripcion i
  join public.division d on d.id = i.division_id
  join public.ranking r on r.id = d.ranking_id
  join lateral public.posiciones_division(d.id) pos on pos.usuario_id = i.usuario_id
  left join public.tabla_posiciones t on t.division_id = d.id and t.usuario_id = i.usuario_id
  where i.usuario_id = p_usuario_id and r.estado <> 'borrador'
  order by r.creado_en desc;
$$;

-- El perfil es público, igual que la tabla.
grant execute on function public.historial_jugador(uuid) to anon, authenticated;
