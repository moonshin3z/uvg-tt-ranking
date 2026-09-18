-- La lista de jugadores para el coordinador.
--
-- La migración 25 quitó el SELECT de tabla sobre `usuario` y lo repartió
-- columna por columna, dejando `debe_cambiar_pin` fuera: es una pista de si
-- alguien todavía tiene el PIN que le dieron, y no tiene por qué viajar al
-- navegador de cualquiera.
--
-- Pero /admin/jugadores la necesita, y la estaba pidiendo con un select normal.
-- Resultado: la pantalla entera reventaba con «permission denied for table
-- usuario» desde esa migración, y nadie lo vio porque la auditoría de responsive
-- medía la pantalla de error, que no tiene defectos de layout.
--
-- Se arregla por donde corresponde: la columna sigue sin poder leerse desde el
-- navegador, y una función de coordinador devuelve la lista completa.
create or replace function public.jugadores_del_club()
returns table (
  id uuid,
  carnet text,
  nombre text,
  rol public.rol,
  activo boolean,
  debe_cambiar_pin boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  perform public.exigir_coordinador();
  return query
  select u.id, u.carnet, u.nombre, u.rol, u.activo, u.debe_cambiar_pin
    from public.usuario u
   order by u.activo desc, u.nombre;
end;
$fn$;

revoke execute on function public.jugadores_del_club() from public, anon;
grant execute on function public.jugadores_del_club() to authenticated;
