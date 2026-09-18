-- Elimina el progreso de un marcador que todavía no terminó.
--
-- Si el marcador pertenece a un ranking o torneo, el partido programado se
-- conserva pendiente para poder jugarlo de nuevo. Un marcador libre sí
-- desaparece por completo porque no tiene un partido asociado.
create or replace function public.eliminar_marcador(p_marcador_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.marcador%rowtype;
  v_yo uuid;
begin
  v_yo := public.exigir_activo();

  select * into m
    from public.marcador
   where id = p_marcador_id
   for update;

  if m.id is null then
    raise exception 'Marcador no existe';
  end if;
  if m.dueno <> v_yo and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;
  if m.estado = 'terminado' then
    raise exception 'El partido ya terminó';
  end if;

  delete from public.marcador where id = m.id;
  return m.id;
end;
$$;

revoke execute on function public.eliminar_marcador(uuid) from public, anon;
grant execute on function public.eliminar_marcador(uuid) to authenticated;
