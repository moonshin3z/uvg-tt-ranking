-- =============================================================================
-- Reglas del juego y cierres.
--
-- Grupo 2: las reglas del torneo (sets para ganar, puntos por set) existían en
-- la tabla pero no las leía nadie. Un torneo al mejor de 5 aceptaba un 1-0.
-- Grupo 3: los cierres dejaban cosas rotas sin vuelta atrás. Un torneo se podía
-- cerrar con la final en disputa, y después ya nadie podía resolverla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El ranking también tiene reglas de juego.
--
-- El torneo las tenía desde el principio; el ranking no, así que los límites
-- estaban cableados a 4 sets ganados y 7 en total, que es "al mejor de 7" y no
-- lo que juega el club.
--
-- El valor por omisión es 3 (al mejor de 5) y 11 puntos, que es lo que ya usa
-- el torneo y lo que juegan los resultados de la semilla. Si el reglamento del
-- club dice otra cosa, se cambia acá y en el formulario de crear ranking.
-- -----------------------------------------------------------------------------
alter table public.ranking
  add column if not exists sets_para_ganar smallint not null default 3,
  add column if not exists puntos_por_set  smallint not null default 11;

alter table public.ranking drop constraint if exists ranking_reglas_juego;
alter table public.ranking add constraint ranking_reglas_juego
  check (sets_para_ganar between 1 and 5 and puntos_por_set between 5 and 21);

comment on column public.ranking.sets_para_ganar is
  'Sets que hay que ganar para ganar el partido. 3 = al mejor de 5.';

-- -----------------------------------------------------------------------------
-- 2. De dónde salen las reglas de un partido.
--
-- Un partido vive en un ranking o en un torneo, nunca en los dos. Esta función
-- devuelve las reglas del que corresponda, para no repetir el "si es ranking...
-- si es torneo..." en cada sitio.
-- -----------------------------------------------------------------------------
create or replace function public.reglas_de_partido(p_partido_id uuid)
returns table (sets_para_ganar smallint, puntos_por_set smallint)
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(r.sets_para_ganar, t.sets_para_ganar),
         coalesce(r.puntos_por_set,  t.puntos_por_set)
    from public.partido p
    left join public.division d on d.id = p.division_id
    left join public.ranking  r on r.id = d.ranking_id
    left join public.torneo   t on t.id = p.torneo_id
   where p.id = p_partido_id;
$fn$;

revoke execute on function public.reglas_de_partido(uuid) from public;
grant execute on function public.reglas_de_partido(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Un set válido de tenis de mesa.
--
-- Antes solo se pedía que no quedara empatado, así que un set 47-3 entraba en
-- un partido a 11. La regla real: se gana al llegar al tope con dos de
-- ventaja, y si se llega a tope-1 iguales se sigue hasta sacar exactamente
-- dos. Eso deja pasar 11-9, 11-0 y 13-11, y rechaza 11-10, 12-9 y 47-3.
-- -----------------------------------------------------------------------------
create or replace function public.set_valido(p_a int, p_b int, p_tope int)
returns boolean
language sql
immutable
as $fn$
  select case
    when p_a is null or p_b is null or p_a < 0 or p_b < 0 then false
    when p_a = p_b then false
    when greatest(p_a, p_b) < p_tope then false
    when greatest(p_a, p_b) = p_tope then least(p_a, p_b) <= p_tope - 2
    else greatest(p_a, p_b) - least(p_a, p_b) = 2 and least(p_a, p_b) >= p_tope - 1
  end;
$fn$;

-- -----------------------------------------------------------------------------
-- 4. Registrar un resultado respeta las reglas del contenedor.
--
-- Cambian tres cosas respecto de la versión anterior:
--   · el ganador tiene que llegar exactamente a `sets_para_ganar`, y el
--     perdedor quedarse por debajo. Antes se aceptaba 1-0 en un torneo al
--     mejor de 5, y quedaba jugado con ganador;
--   · los puntos de cada set se validan contra `puntos_por_set`;
--   · si se corrige un resultado sin volver a mandar los puntos, el detalle
--     anterior ya no se borra en silencio: hay que mandarlo de nuevo o
--     pedir explícitamente que se borre con un arreglo vacío.
-- El resto del cuerpo es el mismo de antes.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_resultado(
  p_partido_id uuid, p_sets_a smallint, p_sets_b smallint, p_puntos jsonb default null
)
returns public.partido
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.partido%rowtype;
  v_yo uuid := auth.uid();
  v_coord boolean := public.es_coordinador();
  v_ganador uuid;
  v_antes jsonb;
  v_accion public.evento_accion;
  v_gana_a smallint := 0;
  v_gana_b smallint := 0;
  v_reglas record;
  v_tenia_puntos boolean;
  s jsonb;
  i int := 0;
begin
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;

  perform public.exigir_partido_jugable(p_partido_id);
  select * into v_reglas from public.reglas_de_partido(p_partido_id);

  -- Sets obligatorios y coherentes con las reglas de este ranking o torneo
  if p_sets_a is null or p_sets_b is null then raise exception 'Poné cuántos sets ganó cada uno'; end if;
  if p_sets_a < 0 or p_sets_b < 0 then raise exception 'Los sets no pueden ser negativos'; end if;
  if p_sets_a = p_sets_b then raise exception 'Un partido no puede terminar empatado en sets'; end if;
  if greatest(p_sets_a, p_sets_b) <> v_reglas.sets_para_ganar then
    raise exception 'Acá se juega al mejor de %: el que gana tiene que llegar a % sets, y vos pusiste %-%',
      v_reglas.sets_para_ganar * 2 - 1, v_reglas.sets_para_ganar, p_sets_a, p_sets_b;
  end if;

  v_ganador := case when p_sets_a > p_sets_b then p.jugador_a else p.jugador_b end;

  -- Quién puede registrar y en qué estado
  if not v_coord then
    if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
    if p.estado = 'pendiente' then
      v_accion := 'registro';
    elsif p.estado = 'jugado' and p.registrado_por = v_yo then
      v_accion := 'edito';
    else
      raise exception 'Este partido ya no se puede registrar (estado: %)', p.estado;
    end if;
  else
    if p.estado in ('confirmado', 'resuelto', 'anulado') then
      raise exception 'Usá resolver o anular para cambiar un partido %', p.estado;
    end if;
    v_accion := case when p.estado = 'pendiente' then 'registro' else 'edito' end;
  end if;

  -- Corregir el marcador sin volver a mandar los puntos borraba el detalle
  -- anterior sin avisar. Ahora hay que decirlo: `[]` borra, null conserva.
  select exists (select 1 from public.set_partido where partido_id = p.id) into v_tenia_puntos;
  if p_puntos is null and v_tenia_puntos then
    raise exception 'Este partido tenía los puntos de cada set. Mandalos de nuevo, o mandá un arreglo vacío para borrarlos';
  end if;

  if p_puntos is not null then
    if jsonb_typeof(p_puntos) <> 'array' then raise exception 'Los puntos por set tienen que venir como arreglo'; end if;
    delete from public.set_partido where partido_id = p.id;

    if jsonb_array_length(p_puntos) > 0 then
      if jsonb_array_length(p_puntos) <> p_sets_a + p_sets_b then
        raise exception 'Pusiste % sets con puntos pero el marcador dice % sets',
          jsonb_array_length(p_puntos), p_sets_a + p_sets_b;
      end if;
      for s in select * from jsonb_array_elements(p_puntos) loop
        i := i + 1;
        if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) <> 2 then
          raise exception 'El set % tiene que ser un par de números', i;
        end if;
        if not public.set_valido((s->>0)::int, (s->>1)::int, v_reglas.puntos_por_set) then
          raise exception 'El set % (%-%) no es posible jugando a %: se gana con % y dos de ventaja',
            i, (s->>0)::int, (s->>1)::int, v_reglas.puntos_por_set, v_reglas.puntos_por_set;
        end if;
        insert into public.set_partido (partido_id, numero, puntos_a, puntos_b)
        values (p.id, i, (s->>0)::smallint, (s->>1)::smallint);
        if (s->>0)::int > (s->>1)::int then v_gana_a := v_gana_a + 1; else v_gana_b := v_gana_b + 1; end if;
      end loop;
      if v_gana_a <> p_sets_a or v_gana_b <> p_sets_b then
        raise exception 'Los puntos por set dan %-% y el marcador dice %-%', v_gana_a, v_gana_b, p_sets_a, p_sets_b;
      end if;
    end if;
  end if;

  v_antes := public.partido_a_json(p);

  update public.partido set
    ganador = v_ganador,
    sets_a = p_sets_a,
    sets_b = p_sets_b,
    registrado_por = v_yo,
    registrado_en = now(),
    estado = case when v_coord then 'confirmado'::public.partido_estado else 'jugado'::public.partido_estado end,
    confirmado_por = case when v_coord then v_yo else null end,
    confirmado_en = case when v_coord then now() else null end,
    disputa_motivo = null
  where id = p.id
  returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, v_accion, v_antes, public.partido_a_json(p));
  if v_coord then
    insert into public.partido_evento (partido_id, actor, accion, antes, despues)
    values (p.id, v_yo, 'confirmo', null, public.partido_a_json(p));
  end if;

  return p;
end;
$fn$;

revoke execute on function public.registrar_resultado(uuid, smallint, smallint, jsonb) from public, anon;
grant execute on function public.registrar_resultado(uuid, smallint, smallint, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. El marcador en vivo usa las reglas del contenedor, no las que mande el
--    cliente.
--
-- La función ya tenía el partido en la mano y por tanto el torneo, pero usaba
-- los parámetros que le pasaba quien abría el marcador, con 3 y 11 por
-- omisión. Dos jugadores del mismo torneo podían abrir marcadores con reglas
-- distintas. Los parámetros se conservan en la firma para no romper la
-- llamada, pero solo valen para el marcador libre, que no cuelga de nada.
-- -----------------------------------------------------------------------------
create or replace function public.abrir_marcador_de_partido(
  p_partido_id uuid, p_sets_para_ganar smallint default null, p_puntos_por_set smallint default null
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.marcador%rowtype;
  p public.partido%rowtype;
  v_yo uuid;
  v_reglas record;
  v_na text; v_nb text;
begin
  v_yo := public.exigir_activo();
  perform public.exigir_partido_jugable(p_partido_id);

  select * into p from public.partido where id = p_partido_id;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if v_yo not in (p.jugador_a, p.jugador_b) and not public.es_coordinador() then
    raise exception 'No jugás este partido' using errcode = '42501';
  end if;
  if p.estado in ('confirmado', 'resuelto', 'anulado') then
    raise exception 'Ese partido ya está cerrado (estado: %)', p.estado;
  end if;

  select * into m from public.marcador
   where partido_id = p_partido_id and estado = 'en_juego';
  if m.id is not null then return m; end if;

  select * into v_reglas from public.reglas_de_partido(p_partido_id);
  select nombre into v_na from public.usuario where id = p.jugador_a;
  select nombre into v_nb from public.usuario where id = p.jugador_b;

  insert into public.marcador (partido_id, nombre_a, nombre_b, dueno,
                               sets_para_ganar, puntos_por_set, saca)
  values (p.id, v_na, v_nb, v_yo, v_reglas.sets_para_ganar, v_reglas.puntos_por_set, 'a')
  returning * into m;
  return m;
end;
$fn$;

revoke execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) from public, anon;
grant execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. El campeón sale del partido, no de una copia del ganador.
--
-- `campeon_de_torneo` leía `torneo_llave.ganador`, que lo escribe el trigger
-- cuando el partido se confirma o se resuelve. Disputar no dispara ninguna de
-- las dos ramas, así que el campo seguía puesto: una final en disputa
-- mantenía campeón. Ahora se mira el estado del partido de la final.
-- -----------------------------------------------------------------------------
create or replace function public.campeon_de_torneo(p_torneo_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select l.ganador
    from public.torneo_llave l
    left join public.partido pa on pa.id = l.partido_id
   where l.torneo_id = p_torneo_id
     and l.ganador is not null
     -- Sin partido es un bye: ganó pasando, y eso sí cuenta.
     and (pa.id is null or pa.estado in ('confirmado', 'resuelto'))
   order by l.ronda desc, l.posicion
   limit 1;
$fn$;

revoke execute on function public.campeon_de_torneo(uuid) from public;
grant execute on function public.campeon_de_torneo(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Cerrar un torneo exige que no quede nada abierto.
--
-- Antes solo se miraba que la final tuviera ganador en `torneo_llave`, con el
-- mismo problema del punto anterior: con la final en disputa se cerraba igual,
-- y cerrar es una puerta de una sola dirección (el coordinador ya no puede
-- resolver nada en un torneo cerrado). Tampoco se miraba ningún otro partido,
-- así que un partido de grupo disputado después de armar la llave no estorbaba.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_torneo(p_torneo_id uuid)
returns public.torneo
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t public.torneo%rowtype;
  v_final record;
  v_abiertos int;
  v_campeon uuid;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado = 'cerrado' then return t; end if;
  if t.estado in ('borrador', 'inscripcion') then
    raise exception 'El torneo "%" todavía no empezó', t.nombre;
  end if;

  select count(*) into v_abiertos from public.partido
   where torneo_id = p_torneo_id and estado in ('pendiente', 'jugado', 'disputado');
  if v_abiertos > 0 then
    raise exception 'Quedan % partidos sin definir en "%"; resolvelos antes de cerrar', v_abiertos, t.nombre;
  end if;

  select * into v_final from public.torneo_llave
   where torneo_id = p_torneo_id order by ronda desc, posicion limit 1;
  if v_final.id is null then raise exception 'El torneo "%" todavía no tiene llave', t.nombre; end if;

  v_campeon := public.campeon_de_torneo(p_torneo_id);
  if v_campeon is null then
    raise exception 'La final del torneo "%" todavía no se define', t.nombre;
  end if;

  update public.torneo set estado = 'cerrado', actualizado_en = now()
   where id = p_torneo_id returning * into t;
  return t;
end;
$fn$;

revoke execute on function public.cerrar_torneo(uuid) from public, anon;
grant execute on function public.cerrar_torneo(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. No se cierra un ranking con partidos anulados sin motivo.
--
-- `cerrar_fase_regular` y `cerrar_ranking` contaban solo pendiente, jugado y
-- disputado, así que un partido anulado pasaba como definido y se podía cerrar
-- un todos contra todos incompleto: la tabla suma victorias sobre cantidades
-- de partidos distintas por jugador.
--
-- Anular es legítimo cuando alguien se retira: `retirar_del_ranking` anula
-- todos los suyos. Esos no estorban. Los que estorban son los anulados donde
-- ninguno de los dos se retiró, que son los que el coordinador anuló a mano.
-- -----------------------------------------------------------------------------
create or replace function public.anulados_sin_retiro(p_ranking_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int
    from public.partido p
    join public.division d on d.id = p.division_id
   where d.ranking_id = p_ranking_id
     and p.estado = 'anulado'
     and not exists (
       select 1 from public.retiro r
        where r.ranking_id = p_ranking_id
          and r.usuario_id in (p.jugador_a, p.jugador_b)
     );
$fn$;

revoke execute on function public.anulados_sin_retiro(uuid) from public;
grant execute on function public.anulados_sin_retiro(uuid) to anon, authenticated;

create or replace function public.cerrar_fase_regular(p_ranking_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.ranking%rowtype;
  v_sin_jugar int; v_sin_confirmar int; v_disputados int; v_anulados int;
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

  v_anulados := public.anulados_sin_retiro(p_ranking_id);
  if v_anulados > 0 then
    raise exception 'Hay % partidos anulados sin que ninguno de los dos se haya retirado. La tabla quedaría con gente que jugó distinta cantidad de partidos: registrá esos resultados o retirá formalmente a quien no jugó', v_anulados;
  end if;

  update public.ranking set estado = 'fase_regular_cerrada' where id = p_ranking_id;
  return (select count(*)::int from public.empates_relevantes(p_ranking_id));
end;
$fn$;

revoke execute on function public.cerrar_fase_regular(uuid) from public, anon;
grant execute on function public.cerrar_fase_regular(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Resolver un partido sin resultado ya no inventa un 1-0.
--
-- Escribía 1-0, que en un torneo al mejor de 5 es un marcador imposible y
-- quedaba indistinguible de uno real en la tabla y en el historial. Ahora usa
-- el marcador de un partido ganado sin jugar según las reglas del contenedor.
-- -----------------------------------------------------------------------------
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.resolver_partido(uuid, uuid, text)'::regprocedure) into v_def;

  v_def := replace(v_def,
    'when p.sets_a is null then (case when p_ganador = p.jugador_a then 1 else 0 end)::smallint',
    'when p.sets_a is null then (case when p_ganador = p.jugador_a then (select sets_para_ganar from public.reglas_de_partido(p.id)) else 0 end)::smallint');
  v_def := replace(v_def,
    'when p.sets_b is null then (case when p_ganador = p.jugador_b then 1 else 0 end)::smallint',
    'when p.sets_b is null then (case when p_ganador = p.jugador_b then (select sets_para_ganar from public.reglas_de_partido(p.id)) else 0 end)::smallint');

  if v_def not like '%reglas_de_partido(p.id)%' then
    raise exception 'No encontré el 1-0 inventado dentro de resolver_partido; revisá a mano';
  end if;
  execute v_def;
end $$;
