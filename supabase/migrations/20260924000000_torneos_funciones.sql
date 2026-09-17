-- =============================================================================
-- Fase 5 · Torneos: crear, inscribir, sortear, jugar, cerrar
--
-- Sigue el mismo reparto de trabajo que el sorteo del ranking en fase 2: el
-- orden del sorteo lo calcula el cliente con una semilla (determinista,
-- reproducible y testeable), y SQL valida, construye y registra. Así hay un
-- solo mecanismo de sorteo en el proyecto y no dos.
--
-- La llave se guarda como esqueleto completo desde el sorteo, con jugadores en
-- null donde todavía no se sabe quién llega. El `partido` se crea recién
-- cuando hay dos jugadores, y por eso hereda sets, bitácora, confirmación,
-- disputa y autoconfirmación sin nada extra.
--
-- El avance de ronda es un TRIGGER, no una función que alguien deba llamar.
-- Tiene que serlo: un partido también puede quedar confirmado por
-- `autoconfirmar_vencidos`, que escribe directo sobre la tabla. Si el avance
-- viviera en el RPC de confirmar, una semifinal ganada por autoconfirmación
-- nunca pasaría a la final.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registro del sorteo, para poder auditarlo igual que el del ranking.
-- -----------------------------------------------------------------------------
create table if not exists public.torneo_sorteo (
  id            uuid primary key default gen_random_uuid(),
  torneo_id     uuid not null unique references public.torneo (id) on delete cascade,
  semilla       text not null,
  ejecutado_por uuid not null references public.usuario (id),
  ejecutado_en  timestamptz not null default now(),
  resultado     jsonb not null
);

alter table public.torneo_sorteo enable row level security;
drop policy if exists torneo_sorteo_lectura on public.torneo_sorteo;
create policy torneo_sorteo_lectura on public.torneo_sorteo for select using (true);
drop policy if exists torneo_sorteo_coordinador on public.torneo_sorteo;
create policy torneo_sorteo_coordinador on public.torneo_sorteo for all
  using (public.es_coordinador()) with check (public.es_coordinador());
grant select on public.torneo_sorteo to anon, authenticated;

-- =============================================================================
-- Crear e inscribir
-- =============================================================================
create or replace function public.crear_torneo(
  p_semestre_id            uuid,
  p_nombre                 text,
  p_formato                text,
  p_fecha                  date,
  p_sets_para_ganar        smallint,
  p_puntos_por_set         smallint,
  p_horas_autoconfirmacion smallint
)
returns public.torneo
language plpgsql
security definer
set search_path = public
as $fn$
declare t public.torneo%rowtype;
begin
  perform public.exigir_coordinador();
  if length(btrim(coalesce(p_nombre, ''))) = 0 then raise exception 'Poné un nombre al torneo'; end if;

  insert into public.torneo (
    semestre_id, nombre, formato, fecha, sets_para_ganar, puntos_por_set,
    horas_autoconfirmacion, creado_por
  ) values (
    p_semestre_id, btrim(p_nombre), p_formato::public.torneo_formato, p_fecha,
    coalesce(p_sets_para_ganar, 3), coalesce(p_puntos_por_set, 11),
    p_horas_autoconfirmacion, auth.uid()
  )
  returning * into t;
  return t;
end;
$fn$;

create or replace function public.abrir_inscripcion_torneo(p_torneo_id uuid)
returns public.torneo
language plpgsql
security definer
set search_path = public
as $fn$
declare t public.torneo%rowtype;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado <> 'borrador' then
    raise exception 'El torneo "%" ya pasó la etapa de inscripción', t.nombre;
  end if;
  update public.torneo set estado = 'inscripcion', actualizado_en = now()
   where id = p_torneo_id returning * into t;
  return t;
end;
$fn$;

create or replace function public.inscribir_en_torneo(p_torneo_id uuid, p_usuario_id uuid)
returns public.torneo_inscripcion
language plpgsql
security definer
set search_path = public
as $fn$
declare
  i public.torneo_inscripcion%rowtype;
  t public.torneo%rowtype;
  v_activo boolean;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado not in ('borrador', 'inscripcion') then
    raise exception 'El torneo "%" ya se armó; no se puede inscribir a nadie más', t.nombre;
  end if;

  select activo into v_activo from public.usuario where id = p_usuario_id;
  if v_activo is null then raise exception 'Ese jugador no existe'; end if;
  if not v_activo then raise exception 'Ese jugador está dado de baja'; end if;

  insert into public.torneo_inscripcion (torneo_id, usuario_id)
  values (p_torneo_id, p_usuario_id)
  on conflict (torneo_id, usuario_id) do update set torneo_id = excluded.torneo_id
  returning * into i;
  return i;
end;
$fn$;

create or replace function public.sacar_de_torneo(p_torneo_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare t public.torneo%rowtype;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado not in ('borrador', 'inscripcion') then
    raise exception 'El torneo "%" ya se armó; para sacar a alguien hay que rearmarlo', t.nombre;
  end if;
  delete from public.torneo_inscripcion where torneo_id = p_torneo_id and usuario_id = p_usuario_id;
end;
$fn$;

-- =============================================================================
-- Siembra estándar de una llave
--
-- Devuelve en qué orden se colocan las posiciones del cuadro para que el 1 y
-- el 2 solo puedan cruzarse en la final: 4 -> {1,4,2,3}, 8 -> {1,8,4,5,2,7,3,6}.
-- La regla es recursiva: cada posición s de un cuadro de k se convierte en el
-- par (s, 2k+1-s) en el cuadro de 2k.
-- =============================================================================
create or replace function public.orden_siembra(p_tam int)
returns int[]
language plpgsql
immutable
as $fn$
declare
  v_ord int[] := array[1];
  v_nue int[];
  v_n   int := 1;
  s     int;
begin
  if p_tam < 2 then return v_ord; end if;
  while v_n < p_tam loop
    v_nue := array[]::int[];
    foreach s in array v_ord loop
      v_nue := v_nue || s || (2 * v_n + 1 - s);
    end loop;
    v_ord := v_nue;
    v_n := v_n * 2;
  end loop;
  return v_ord;
end;
$fn$;

-- =============================================================================
-- Construir la llave a partir de un orden de siembra ya sorteado
--
-- `p_orden` viene del cliente: los jugadores en el orden en que se siembran,
-- del 1 al N. El cuadro se redondea a la siguiente potencia de 2 y las
-- posiciones que sobran quedan vacías, que es lo que produce los byes.
--
-- Con siembra estándar los byes solo pueden caer en primera ronda y nunca dos
-- en el mismo partido: las posiciones vacías son las últimas (N+1..tam) y cada
-- una se empareja con una cabeza de serie distinta.
-- =============================================================================
create or replace function public.construir_llave(p_torneo_id uuid, p_orden uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t        public.torneo%rowtype;
  v_n      int := coalesce(array_length(p_orden, 1), 0);
  v_tam    int := 2;
  v_rondas int;
  v_ord    int[];
  r        int;
  pos      int;
  v_pa     uuid;
  v_pb     uuid;
  v_ia     int;
  v_ib     int;
  v_pid    uuid;
  v_fila   record;
begin
  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if v_n < 2 then raise exception 'Hacen falta al menos 2 jugadores'; end if;

  while v_tam < v_n loop v_tam := v_tam * 2; end loop;
  if v_tam > 64 then raise exception 'La llave más grande soportada es de 64'; end if;
  v_rondas := (ln(v_tam) / ln(2))::int;
  v_ord := public.orden_siembra(v_tam);

  delete from public.torneo_llave where torneo_id = p_torneo_id;

  -- Esqueleto completo, todas las rondas, jugadores en null
  for r in 1..v_rondas loop
    for pos in 1..(v_tam / (2 ^ r)::int) loop
      insert into public.torneo_llave (torneo_id, ronda, posicion) values (p_torneo_id, r, pos);
    end loop;
  end loop;

  -- Primera ronda: cada partido toma dos posiciones consecutivas del orden
  for pos in 1..(v_tam / 2) loop
    v_ia := v_ord[2 * pos - 1];
    v_ib := v_ord[2 * pos];
    v_pa := case when v_ia <= v_n then p_orden[v_ia] else null end;
    v_pb := case when v_ib <= v_n then p_orden[v_ib] else null end;
    update public.torneo_llave set jugador_a = v_pa, jugador_b = v_pb
     where torneo_id = p_torneo_id and ronda = 1 and posicion = pos;
  end loop;

  update public.torneo set tam_llave = v_tam, actualizado_en = now() where id = p_torneo_id;

  -- Crear los partidos de primera ronda y resolver los byes
  for v_fila in (select l.posicion from public.torneo_llave l
             where l.torneo_id = p_torneo_id and l.ronda = 1 order by l.posicion) loop
    select jugador_a, jugador_b into v_pa, v_pb
      from public.torneo_llave
     where torneo_id = p_torneo_id and ronda = 1 and posicion = v_fila.posicion;

    if v_pa is not null and v_pb is not null then
      insert into public.partido (torneo_id, tipo, jugador_a, jugador_b)
      values (p_torneo_id, 'llave', v_pa, v_pb) returning id into v_pid;
      update public.torneo_llave set partido_id = v_pid
       where torneo_id = p_torneo_id and ronda = 1 and posicion = v_fila.posicion;
    elsif coalesce(v_pa, v_pb) is not null then
      -- Bye: pasa solo, sin jugar
      update public.torneo_llave set ganador = coalesce(v_pa, v_pb)
       where torneo_id = p_torneo_id and ronda = 1 and posicion = v_fila.posicion;
      perform public.propagar_llave(p_torneo_id, 1, v_fila.posicion, coalesce(v_pa, v_pb));
    end if;
  end loop;

  return v_tam;
end;
$fn$;

-- =============================================================================
-- Subir al ganador de una posición a la ronda siguiente
--
-- El ganador de (ronda r, posición p) va a (r+1, ceil(p/2)), del lado A si p
-- es impar y del lado B si es par. Cuando la posición de destino queda con sus
-- dos jugadores, se crea el partido.
-- =============================================================================
create or replace function public.propagar_llave(
  p_torneo_id uuid, p_ronda int, p_posicion int, p_ganador uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_r    int := p_ronda + 1;
  v_pos  int := ceil(p_posicion / 2.0)::int;
  v_lado text := case when p_posicion % 2 = 1 then 'a' else 'b' end;
  l      public.torneo_llave%rowtype;
  v_pid  uuid;
begin
  select * into l from public.torneo_llave
   where torneo_id = p_torneo_id and ronda = v_r and posicion = v_pos for update;
  if l.id is null then return; end if;   -- era la final

  if v_lado = 'a' then
    update public.torneo_llave set jugador_a = p_ganador where id = l.id returning * into l;
  else
    update public.torneo_llave set jugador_b = p_ganador where id = l.id returning * into l;
  end if;

  if l.jugador_a is not null and l.jugador_b is not null and l.partido_id is null then
    insert into public.partido (torneo_id, tipo, jugador_a, jugador_b)
    values (p_torneo_id, 'llave', l.jugador_a, l.jugador_b) returning id into v_pid;
    update public.torneo_llave set partido_id = v_pid where id = l.id;
  end if;
end;
$fn$;

-- =============================================================================
-- El trigger de avance
--
-- Cubre las cuatro maneras en que un partido de llave puede quedar decidido:
-- confirmado por el rival, autoconfirmado por tiempo, resuelto por el
-- coordinador, o dado vuelta. Si se anula, se deshace el avance.
-- =============================================================================
create or replace function public.tg_avanzar_llave()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  l public.torneo_llave%rowtype;
begin
  select * into l from public.torneo_llave where partido_id = new.id;
  if l.id is null then return new; end if;   -- no es partido de llave

  if new.estado in ('confirmado', 'resuelto') and new.ganador is not null then
    if l.ganador is distinct from new.ganador then
      update public.torneo_llave set ganador = new.ganador where id = l.id;
      -- Si ya había subido a otro, se limpia antes de subir al correcto
      if l.ganador is not null then
        perform public.limpiar_desde(l.torneo_id, l.ronda, l.posicion);
      end if;
      perform public.propagar_llave(l.torneo_id, l.ronda, l.posicion, new.ganador);
    end if;
  elsif new.estado = 'anulado' and l.ganador is not null then
    update public.torneo_llave set ganador = null where id = l.id;
    perform public.limpiar_desde(l.torneo_id, l.ronda, l.posicion);
  end if;

  return new;
end;
$fn$;

-- Deshace el avance que produjo una posición, cuando su resultado se corrige.
--
-- Solo toca el LADO que venía de esa posición. El otro lado del cuadro ganó su
-- partido por su cuenta y no tiene por qué perder su lugar porque se corrigió
-- algo en la otra mitad. Si el padre ya había producido un ganador, primero se
-- limpia hacia arriba, porque ese avance también dejó de valer.
create or replace function public.limpiar_desde(p_torneo_id uuid, p_ronda int, p_posicion int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_r    int  := p_ronda + 1;
  v_pos  int  := ceil(p_posicion / 2.0)::int;
  v_lado text := case when p_posicion % 2 = 1 then 'a' else 'b' end;
  l      public.torneo_llave%rowtype;
begin
  select * into l from public.torneo_llave
   where torneo_id = p_torneo_id and ronda = v_r and posicion = v_pos for update;
  if l.id is null then return; end if;   -- era la final, no hay nada arriba

  -- Lo que este padre haya mandado más arriba tampoco vale ya
  if l.ganador is not null then
    perform public.limpiar_desde(p_torneo_id, v_r, v_pos);
  end if;

  -- El partido de esta posición deja de tener sentido: uno de los dos cambió
  if l.partido_id is not null then
    delete from public.partido where id = l.partido_id;
  end if;

  if v_lado = 'a' then
    update public.torneo_llave set jugador_a = null, partido_id = null, ganador = null
     where id = l.id;
  else
    update public.torneo_llave set jugador_b = null, partido_id = null, ganador = null
     where id = l.id;
  end if;
end;
$fn$;

drop trigger if exists avanzar_llave on public.partido;
create trigger avanzar_llave
  after update of estado, ganador on public.partido
  for each row
  when (new.torneo_id is not null and new.grupo_id is null)
  execute function public.tg_avanzar_llave();

-- =============================================================================
-- Armar el torneo
--
-- `p_orden` es el sorteo ya hecho por el cliente, con su semilla, igual que en
-- el ranking. Para formato de llave se siembra directo. Para grupos se reparte
-- en serpentina y se genera el round robin de cada grupo.
-- =============================================================================
create or replace function public.armar_torneo(
  p_torneo_id   uuid,
  p_semilla     text,
  p_orden       uuid[],
  p_cant_grupos smallint
)
returns public.torneo
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t       public.torneo%rowtype;
  v_n     int := coalesce(array_length(p_orden, 1), 0);
  v_g     int;
  v_gid   uuid;
  v_ids   uuid[];
  i       int;
  j       int;
  k       int;
  v_grupo int;
  v_nom   text;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado not in ('borrador', 'inscripcion') then
    raise exception 'El torneo "%" ya está armado', t.nombre;
  end if;
  if v_n < 2 then raise exception 'Hacen falta al menos 2 jugadores inscritos'; end if;

  -- El orden tiene que ser exactamente los inscritos, sin repetidos ni colados
  if exists (
    select 1 from unnest(p_orden) o(id)
     where not exists (
       select 1 from public.torneo_inscripcion ti
        where ti.torneo_id = p_torneo_id and ti.usuario_id = o.id)
  ) then
    raise exception 'El sorteo trae jugadores que no están inscritos';
  end if;
  if v_n <> (select count(*) from public.torneo_inscripcion where torneo_id = p_torneo_id) then
    raise exception 'El sorteo trae % jugadores y hay % inscritos',
      v_n, (select count(*) from public.torneo_inscripcion where torneo_id = p_torneo_id);
  end if;
  if v_n <> (select count(distinct o.id) from unnest(p_orden) o(id)) then
    raise exception 'El sorteo trae jugadores repetidos';
  end if;

  -- Rearmar limpia todo lo anterior
  delete from public.partido where torneo_id = p_torneo_id;
  delete from public.torneo_llave where torneo_id = p_torneo_id;
  update public.torneo_inscripcion set grupo_id = null where torneo_id = p_torneo_id;
  delete from public.torneo_grupo where torneo_id = p_torneo_id;

  -- La siembra queda registrada en la inscripción
  for i in 1..v_n loop
    update public.torneo_inscripcion set siembra = i
     where torneo_id = p_torneo_id and usuario_id = p_orden[i];
  end loop;

  if t.formato = 'llave' then
    perform public.construir_llave(p_torneo_id, p_orden);
    update public.torneo set estado = 'en_juego', cant_grupos = null, actualizado_en = now()
     where id = p_torneo_id returning * into t;
  else
    v_g := coalesce(p_cant_grupos, greatest(2, least(8, (v_n / 4)::int)));
    if v_g < 2 then raise exception 'Con grupos hacen falta al menos 2 grupos'; end if;
    if v_n < v_g * 2 then
      raise exception 'No alcanzan % jugadores para % grupos', v_n, v_g;
    end if;

    -- Serpentina: 1->A, 2->B, ..., g->G, g+1->G, g+2->F, ... reparte las
    -- cabezas de serie sin que se junten dos en el mismo grupo.
    for i in 1..v_g loop
      insert into public.torneo_grupo (torneo_id, nombre) values (p_torneo_id, chr(64 + i));
    end loop;

    for i in 1..v_n loop
      k := ((i - 1) / v_g)::int;                       -- número de vuelta
      j := ((i - 1) % v_g) + 1;                        -- lugar en la vuelta
      v_grupo := case when k % 2 = 0 then j else v_g + 1 - j end;
      v_nom := chr(64 + v_grupo);
      select id into v_gid from public.torneo_grupo
       where torneo_id = p_torneo_id and nombre = v_nom;
      update public.torneo_inscripcion set grupo_id = v_gid
       where torneo_id = p_torneo_id and usuario_id = p_orden[i];
    end loop;

    -- Round robin dentro de cada grupo, en orden canónico
    insert into public.partido (torneo_id, grupo_id, tipo, jugador_a, jugador_b)
    select p_torneo_id, ti.grupo_id, 'grupo',
           least(ti.usuario_id, tj.usuario_id), greatest(ti.usuario_id, tj.usuario_id)
      from public.torneo_inscripcion ti
      join public.torneo_inscripcion tj
        on tj.grupo_id = ti.grupo_id and tj.usuario_id > ti.usuario_id
     where ti.torneo_id = p_torneo_id and ti.grupo_id is not null;

    update public.torneo set estado = 'en_juego', cant_grupos = v_g, actualizado_en = now()
     where id = p_torneo_id returning * into t;
  end if;

  insert into public.torneo_sorteo (torneo_id, semilla, ejecutado_por, resultado)
  values (p_torneo_id, p_semilla, auth.uid(), to_jsonb(p_orden))
  on conflict (torneo_id) do update
    set semilla = excluded.semilla, ejecutado_por = excluded.ejecutado_por,
        ejecutado_en = now(), resultado = excluded.resultado;

  return t;
end;
$fn$;

-- =============================================================================
-- Posiciones dentro de un grupo
--
-- Criterios: partidos ganados, después diferencia de sets, después diferencia
-- de puntos, y al final el nombre para que el orden sea estable.
-- =============================================================================
create or replace function public.posiciones_grupo(p_grupo_id uuid)
returns table (
  usuario_id uuid, nombre text, carnet text,
  pj int, pg int, pp int, sets_f int, sets_c int, dif_sets int, posicion int
)
language sql
stable
security definer
set search_path = public
as $fn$
  with jugadores as (
    select ti.usuario_id, u.nombre, u.carnet
      from public.torneo_inscripcion ti
      join public.usuario u on u.id = ti.usuario_id
     where ti.grupo_id = p_grupo_id
  ),
  jugados as (
    select p.* from public.partido p
     where p.grupo_id = p_grupo_id and p.estado in ('confirmado', 'resuelto')
  ),
  stats as (
    select j.usuario_id, j.nombre, j.carnet,
      count(p.id)::int as pj,
      count(*) filter (where p.ganador = j.usuario_id)::int as pg,
      count(*) filter (where p.ganador is not null and p.ganador <> j.usuario_id)::int as pp,
      coalesce(sum(case when p.jugador_a = j.usuario_id then p.sets_a else p.sets_b end), 0)::int as sets_f,
      coalesce(sum(case when p.jugador_a = j.usuario_id then p.sets_b else p.sets_a end), 0)::int as sets_c
    from jugadores j
    left join jugados p on j.usuario_id in (p.jugador_a, p.jugador_b)
    group by j.usuario_id, j.nombre, j.carnet
  )
  select usuario_id, nombre, carnet, pj, pg, pp, sets_f, sets_c,
         (sets_f - sets_c) as dif_sets,
         row_number() over (order by pg desc, (sets_f - sets_c) desc, nombre)::int as posicion
    from stats;
$fn$;

-- =============================================================================
-- Cerrar la fase de grupos y sembrar la llave
--
-- El orden de siembra es 1.º de A, 1.º de B, ..., 2.º de A, 2.º de B, ... Con
-- la siembra estándar eso hace que el 1.º de un grupo no pueda cruzarse con el
-- 2.º del mismo grupo en primera ronda.
-- =============================================================================
create or replace function public.cerrar_grupos(p_torneo_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t       public.torneo%rowtype;
  v_orden uuid[] := array[]::uuid[];
  v_falta int;
  pos     int;
  g       record;
  v_u     uuid;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.formato <> 'grupos_y_llave' then
    raise exception 'El torneo "%" no tiene fase de grupos', t.nombre;
  end if;
  if t.estado <> 'en_juego' then
    raise exception 'El torneo "%" no está en juego', t.nombre;
  end if;

  select count(*) into v_falta from public.partido
   where torneo_id = p_torneo_id and grupo_id is not null
     and estado not in ('confirmado', 'resuelto', 'anulado');
  if v_falta > 0 then
    raise exception 'Faltan % partidos de grupo por cerrar', v_falta;
  end if;

  if exists (select 1 from public.torneo_llave where torneo_id = p_torneo_id) then
    raise exception 'La llave del torneo "%" ya está armada', t.nombre;
  end if;

  for pos in 1..t.clasifican_por_grupo loop
    for g in (select id from public.torneo_grupo where torneo_id = p_torneo_id order by nombre) loop
      select usuario_id into v_u from public.posiciones_grupo(g.id) where posicion = pos;
      if v_u is not null then v_orden := v_orden || v_u; end if;
    end loop;
  end loop;

  if coalesce(array_length(v_orden, 1), 0) < 2 then
    raise exception 'No hay suficientes clasificados para armar una llave';
  end if;

  return public.construir_llave(p_torneo_id, v_orden);
end;
$fn$;

-- =============================================================================
-- Cerrar el torneo
-- =============================================================================
create or replace function public.cerrar_torneo(p_torneo_id uuid)
returns public.torneo
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t       public.torneo%rowtype;
  v_final public.torneo_llave%rowtype;
begin
  perform public.exigir_coordinador();
  select * into t from public.torneo where id = p_torneo_id for update;
  if t.id is null then raise exception 'Torneo no existe'; end if;
  if t.estado = 'cerrado' then return t; end if;

  select * into v_final from public.torneo_llave
   where torneo_id = p_torneo_id order by ronda desc, posicion limit 1;
  if v_final.id is null then
    raise exception 'El torneo "%" todavía no tiene llave', t.nombre;
  end if;
  if v_final.ganador is null then
    raise exception 'La final del torneo "%" todavía no se define', t.nombre;
  end if;

  update public.torneo set estado = 'cerrado', actualizado_en = now()
   where id = p_torneo_id returning * into t;
  return t;
end;
$fn$;

create or replace function public.campeon_de_torneo(p_torneo_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select ganador from public.torneo_llave
   where torneo_id = p_torneo_id order by ronda desc, posicion limit 1;
$fn$;

-- =============================================================================
-- Permisos: todo lo que arma el torneo es del coordinador. Las consultas de
-- lectura las puede hacer cualquiera, igual que la tabla del ranking.
-- =============================================================================
revoke execute on function public.crear_torneo(uuid, text, text, date, smallint, smallint, smallint) from public, anon;
revoke execute on function public.abrir_inscripcion_torneo(uuid) from public, anon;
revoke execute on function public.inscribir_en_torneo(uuid, uuid) from public, anon;
revoke execute on function public.sacar_de_torneo(uuid, uuid) from public, anon;
revoke execute on function public.armar_torneo(uuid, text, uuid[], smallint) from public, anon;
revoke execute on function public.cerrar_grupos(uuid) from public, anon;
revoke execute on function public.cerrar_torneo(uuid) from public, anon;
revoke execute on function public.construir_llave(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.propagar_llave(uuid, int, int, uuid) from public, anon, authenticated;
revoke execute on function public.limpiar_desde(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.tg_avanzar_llave() from public, anon, authenticated;

grant execute on function public.crear_torneo(uuid, text, text, date, smallint, smallint, smallint) to authenticated;
grant execute on function public.abrir_inscripcion_torneo(uuid) to authenticated;
grant execute on function public.inscribir_en_torneo(uuid, uuid) to authenticated;
grant execute on function public.sacar_de_torneo(uuid, uuid) to authenticated;
grant execute on function public.armar_torneo(uuid, text, uuid[], smallint) to authenticated;
grant execute on function public.cerrar_grupos(uuid) to authenticated;
grant execute on function public.cerrar_torneo(uuid) to authenticated;
grant execute on function public.posiciones_grupo(uuid) to anon, authenticated;
grant execute on function public.campeon_de_torneo(uuid) to anon, authenticated;
grant execute on function public.orden_siembra(int) to anon, authenticated;
