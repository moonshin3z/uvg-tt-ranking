-- El coordinador puede eliminar cualquier torneo, también con resultados.
-- Conservamos la firma para que las versiones anteriores de la app sigan
-- funcionando durante el despliegue; ya no se pide motivo ni se crea una baja.
create or replace function public.eliminar_torneo(p_torneo_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.torneo%rowtype;
  v jsonb;
begin
  perform public.exigir_coordinador();

  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Ese torneo no existe'; end if;

  v := public.contenido_del_torneo(p_torneo_id);
  -- Las relaciones en cascada eliminan sus inscripciones, cuadro, partidos,
  -- sets, eventos y marcadores sin tocar jugadores ni otros torneos.
  delete from public.torneo where id = p_torneo_id;
  return v;
end;
$$;

grant execute on function public.eliminar_torneo(uuid, text) to authenticated;
revoke execute on function public.eliminar_torneo(uuid, text) from public, anon;
