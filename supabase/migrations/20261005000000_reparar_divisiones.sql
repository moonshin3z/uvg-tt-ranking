-- Repara los rankings que nacieron sin divisiones, y hace que no vuelva a
-- doler si pasa otra vez.
--
-- La migración 27 le quitó sin querer a `crear_ranking` la línea que crea la
-- división Mayor y la Menor, y la 1001 la devolvió. Pero los rankings creados
-- con la versión rota siguen existiendo, y no hay nada en la aplicación que los
-- pueda arreglar: al sortear, `armar_divisiones` no encuentra las divisiones,
-- mete null en `inscripcion.division_id` y Postgres responde
--
--   null value in column "division_id" of relation "inscripcion"
--
-- que no le dice nada a nadie. Acá se hacen dos cosas: rellenar lo que falta en
-- los que ya existen, y cambiar el error por uno que se entienda si alguna vez
-- vuelve a faltar.

-- 1. Los que ya están.
insert into public.division (ranking_id, tipo)
select r.id, t.tipo
  from public.ranking r
  cross join (values ('mayor'::public.division_tipo), ('menor'::public.division_tipo)) as t(tipo)
 where not exists (
   select 1 from public.division d where d.ranking_id = r.id and d.tipo = t.tipo
 );

-- 2. Que el error se entienda. Es lo único que cambia de la función.
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

  -- Un ranking sin divisiones no es un estado posible hoy, pero lo fue: los
  -- creados entre las migraciones 27 y 1001 nacieron así. Si aparece uno, se
  -- arregla en el momento en vez de reventar con un error de Postgres.
  if v_mayor is null then
    insert into public.division (ranking_id, tipo) values (p_ranking_id, 'mayor') returning id into v_mayor;
  end if;
  if v_menor is null then
    insert into public.division (ranking_id, tipo) values (p_ranking_id, 'menor') returning id into v_menor;
  end if;

  if jsonb_typeof(p_asignacion) <> 'array' or jsonb_array_length(p_asignacion) < 4 then
    raise exception 'Se necesitan al menos 4 jugadores (2 por división)';
  end if;

  delete from public.partido where division_id in (v_mayor, v_menor);
  delete from public.inscripcion where division_id in (v_mayor, v_menor);
  delete from public.sorteo where ranking_id = p_ranking_id;
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
