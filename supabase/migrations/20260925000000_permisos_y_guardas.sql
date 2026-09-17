-- =============================================================================
-- Permisos y guardas de contenedor.
--
-- El cliente habla con Postgres por PostgREST, así que todo lo que RLS y los
-- GRANT permiten es alcanzable con una petición directa, sin pasar por la
-- interfaz. Esta migración cierra los agujeros que eso dejaba abiertos.
-- Cada bloque dice qué se podía hacer antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Un jugador no edita su propia fila.
--
-- La política anterior dejaba hacer UPDATE de la fila propia fijando solo
-- `rol`, así que un jugador podía:
--   · reactivarse después de que el coordinador lo diera de baja;
--   · ponerse `debe_cambiar_pin = false` y seguir con el PIN que el
--     coordinador repartió;
--   · cambiarse el `carnet` al de otro estudiante, lo que además revienta el
--     alta de ese estudiante cuando el coordinador la intenta (el trigger
--     choca con el UNIQUE y deja una cuenta de auth sin perfil).
--
-- Ninguna pantalla necesita ese UPDATE: lo único que el jugador cambia de sí
-- mismo es el PIN, y eso ahora pasa por `cambiar_mi_pin`.
-- -----------------------------------------------------------------------------
drop policy if exists usuario_edita_su_perfil on public.usuario;

-- -----------------------------------------------------------------------------
-- 2. El PIN se cambia en un solo paso, del lado del servidor.
--
-- Antes eran dos: `auth.updateUser` desde la app y después un UPDATE a
-- `usuario.debe_cambiar_pin`. Al ser dos, el segundo se podía hacer sin el
-- primero. Acá el hash nuevo y la baja de la bandera son la misma
-- transacción: no hay forma de quitarse la obligación sin cambiar el PIN.
-- -----------------------------------------------------------------------------
create or replace function public.cambiar_mi_pin(p_nuevo text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_yo uuid := auth.uid();
  v_pin text := btrim(coalesce(p_nuevo, ''));
begin
  if v_yo is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if v_pin !~ '^[0-9]{6}$' then raise exception 'El PIN debe tener 6 dígitos'; end if;
  -- Los mismos rechazos que ya hacía la app, acá para que valgan también si
  -- alguien llama la función directamente.
  if v_pin ~ '^(.)\1{5}$' or v_pin in ('123456', '654321', '012345') then
    raise exception 'Elegí un PIN menos obvio';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_yo;
  if not found then raise exception 'No encontré tu cuenta'; end if;

  update public.usuario set debe_cambiar_pin = false, actualizado_en = now() where id = v_yo;
end;
$fn$;

revoke execute on function public.cambiar_mi_pin(text) from public, anon;
grant execute on function public.cambiar_mi_pin(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. `debe_cambiar_pin` deja de ser público.
--
-- `usuario` se leía entera sin sesión. Eso daba el padrón completo y, sobre
-- todo, la lista de quién todavía tiene el PIN que puso el coordinador. Con el
-- PIN de 6 dígitos y el correo derivado del carnet, eso es una lista de
-- objetivos ordenada por facilidad.
--
-- El carnet sigue siendo legible: la ficha pública de cada jugador vive en
-- /jugador/<carnet>, así que ya está en la URL. Si alguna vez se quiere
-- esconder, hay que cambiar antes esa ruta.
-- -----------------------------------------------------------------------------
revoke select on public.usuario from anon, authenticated;
grant select (id, carnet, nombre, rol, activo, creado_en, actualizado_en)
  on public.usuario to anon, authenticated;

-- El propio usuario sí necesita ver su bandera: se la devuelve esta función,
-- que solo puede hablar de quien la llama.
create or replace function public.mi_perfil()
returns public.usuario
language sql
stable
security definer
set search_path = public
as $fn$
  select * from public.usuario where id = auth.uid();
$fn$;

revoke execute on function public.mi_perfil() from public, anon;
grant execute on function public.mi_perfil() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. El rol no lo decide quien se registra.
--
-- El trigger tomaba `rol` de `raw_user_meta_data`, que es exactamente lo que
-- el cliente manda en `signUp`. Con el registro abierto, cualquiera se daba de
-- alta como coordinador en un viaje. El registro está cerrado, pero ese
-- interruptor vive en el panel de Supabase y no en este repositorio, así que
-- no es una defensa que se pueda revisar acá.
--
-- Ahora todo perfil nace como jugador y el ascenso pasa por `asignar_rol`,
-- que exige coordinador.
-- -----------------------------------------------------------------------------
create or replace function public.crear_perfil_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.usuario (id, carnet, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'carnet', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre'),
    'jugador'
  );
  return new;
end;
$fn$;

create or replace function public.asignar_rol(p_usuario_id uuid, p_rol text)
returns public.usuario
language plpgsql
security definer
set search_path = public
as $fn$
declare u public.usuario%rowtype;
begin
  perform public.exigir_coordinador();
  if p_rol not in ('jugador', 'coordinador') then
    raise exception 'Rol desconocido: %', p_rol;
  end if;
  -- Quedarse sin coordinadores deja el club sin quien administre nada y no hay
  -- forma de recuperarlo desde la aplicación.
  if p_rol = 'jugador'
     and (select rol from public.usuario where id = p_usuario_id) = 'coordinador'
     and (select count(*) from public.usuario where rol = 'coordinador' and activo) <= 1 then
    raise exception 'Es el único coordinador activo; nombrá a otro antes de bajarlo';
  end if;

  update public.usuario set rol = p_rol::public.rol, actualizado_en = now()
   where id = p_usuario_id returning * into u;
  if u.id is null then raise exception 'Usuario no existe'; end if;
  return u;
end;
$fn$;

revoke execute on function public.asignar_rol(uuid, text) from public, anon;
grant execute on function public.asignar_rol(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Quien está de baja no juega.
--
-- `activo` solo se miraba al armar la sesión en la aplicación. Ninguna RPC lo
-- comprobaba, y el token dura una semana, así que un jugador dado de baja
-- seguía registrando, confirmando y disputando resultados por la API durante
-- los siete días siguientes a su baja.
-- -----------------------------------------------------------------------------
create or replace function public.exigir_activo()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare u public.usuario%rowtype;
begin
  select * into u from public.usuario where id = auth.uid();
  if u.id is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if not u.activo then
    raise exception 'Tu cuenta está dada de baja; hablá con el coordinador' using errcode = '42501';
  end if;
  return u.id;
end;
$fn$;

revoke execute on function public.exigir_activo() from public, anon;
grant execute on function public.exigir_activo() to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Las dos guardas de contenedor también exigen cuenta activa.
--
-- Se ponen acá y no en cada RPC para que valga de una vez para registrar,
-- confirmar, disputar, resolver y anular.
-- -----------------------------------------------------------------------------
create or replace function public.exigir_partido_jugable(p_partido_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  c record;
  v_tipo public.partido_tipo;
begin
  perform public.exigir_activo();

  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;

  select tipo into v_tipo from public.partido where id = p_partido_id;

  if c.clase = 'ranking' then
    if c.estado not in ('abierto', 'en_desempates') then
      raise exception 'El ranking no está en juego';
    end if;
    if v_tipo = 'desempate' and c.estado <> 'en_desempates' then
      raise exception 'Los desempates se juegan al cerrar la fase regular';
    end if;
  else
    if c.estado = 'borrador' then
      raise exception 'El torneo "%" todavía no se arma', c.nombre;
    elsif c.estado = 'inscripcion' then
      raise exception 'El torneo "%" todavía está en inscripción', c.nombre;
    elsif c.estado = 'cerrado' then
      raise exception 'El torneo "%" ya terminó', c.nombre;
    end if;
  end if;
end;
$fn$;

create or replace function public.exigir_partido_editable(p_partido_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare c record;
begin
  perform public.exigir_activo();

  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;
  if c.estado = 'cerrado' then
    if c.clase = 'ranking' then
      raise exception 'El ranking ya está cerrado';
    else
      raise exception 'El torneo "%" ya terminó', c.nombre;
    end if;
  end if;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 7. Confirmar y disputar miran el contenedor.
--
-- Eran las dos únicas de las cinco funciones de partido que se quedaron sin la
-- guarda cuando se agregaron los torneos. La consecuencia era grave y
-- verificada: con el ranking ya cerrado, cualquiera de los dos jugadores
-- disputaba un partido confirmado, el partido salía de la tabla de posiciones
-- y las posiciones de un ranking cerrado cambiaban solas. Y no había vuelta
-- atrás: `resolver_partido` y `anular_partido` rechazan un ranking cerrado, así
-- que el coordinador se quedaba sin ninguna forma de arreglarlo.
-- -----------------------------------------------------------------------------
create or replace function public.confirmar_resultado(p_partido_id uuid)
returns public.partido
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.partido%rowtype;
  v_yo uuid;
  v_antes jsonb;
begin
  v_yo := public.exigir_activo();
  perform public.exigir_partido_jugable(p_partido_id);

  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
  if p.estado <> 'jugado' then raise exception 'Solo se confirma un resultado registrado (estado: %)', p.estado; end if;
  if p.registrado_por = v_yo then raise exception 'No podés confirmar tu propio registro'; end if;

  v_antes := public.partido_a_json(p);
  update public.partido set estado = 'confirmado', confirmado_por = v_yo, confirmado_en = now()
  where id = p.id returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'confirmo', v_antes, public.partido_a_json(p));
  return p;
end;
$fn$;

create or replace function public.disputar_resultado(p_partido_id uuid, p_motivo text)
returns public.partido
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.partido%rowtype;
  v_yo uuid;
  v_antes jsonb;
begin
  v_yo := public.exigir_activo();
  perform public.exigir_partido_jugable(p_partido_id);

  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Explicá brevemente el motivo'; end if;
  select * into p from public.partido where id = p_partido_id for update;
  if p.id is null then raise exception 'Partido no existe'; end if;
  if v_yo not in (p.jugador_a, p.jugador_b) then raise exception 'No jugás este partido' using errcode = '42501'; end if;
  if p.estado not in ('jugado', 'confirmado') then raise exception 'No se puede disputar (estado: %)', p.estado; end if;
  if p.estado = 'jugado' and p.registrado_por = v_yo then raise exception 'Vos lo registraste; corregilo en vez de disputarlo'; end if;

  v_antes := public.partido_a_json(p);
  update public.partido set estado = 'disputado', disputa_motivo = left(trim(p_motivo), 500)
  where id = p.id returning * into p;

  insert into public.partido_evento (partido_id, actor, accion, antes, despues)
  values (p.id, v_yo, 'disputo', v_antes, public.partido_a_json(p) || jsonb_build_object('motivo', p.disputa_motivo));
  return p;
end;
$fn$;

revoke execute on function public.confirmar_resultado(uuid) from public, anon;
revoke execute on function public.disputar_resultado(uuid, text) from public, anon;
grant execute on function public.confirmar_resultado(uuid) to authenticated;
grant execute on function public.disputar_resultado(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. El marcador en vivo también exige cuenta activa, y no se abre fuera de
--    juego.
--
-- `abrir_marcador_de_partido` comprobaba el estado del partido pero no el del
-- ranking ni el del torneo, así que se podía publicar por Realtime un marcador
-- de un partido de un torneo que no había empezado, o de uno ya cerrado. Lo
-- segundo es peor de lo que parece: el partido se juega de verdad y después no
-- hay dónde anotarlo, porque registrar el resultado sí mira el contenedor.
--
-- Estas cuatro se reescriben con su propia definición más la guarda, para no
-- tocar nada más de su comportamiento.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.abrir_marcador_de_partido(p_partido_id uuid, p_sets_para_ganar smallint, p_puntos_por_set smallint)
 RETURNS marcador
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m        public.marcador%rowtype;
  p        public.partido%rowtype;
  v_yo     uuid := auth.uid();
  v_coord  boolean := public.es_coordinador();
  v_na     text;
  v_nb     text;
begin
  perform public.exigir_activo();
  perform public.exigir_partido_jugable(p_partido_id);
  if v_yo is null then raise exception 'Tenés que ingresar' using errcode = '42501'; end if;

  select * into p from public.partido where id = p_partido_id;
  if p.id is null then raise exception 'Partido no existe'; end if;

  if not v_coord and v_yo not in (p.jugador_a, p.jugador_b) then
    raise exception 'No jugás este partido' using errcode = '42501';
  end if;

  if p.estado in ('confirmado', 'resuelto', 'anulado') then
    raise exception 'Ese partido ya tiene resultado';
  end if;

  select m2.* into m from public.marcador m2
   where m2.partido_id = p_partido_id and m2.estado = 'en_juego';
  if m.id is not null then return m; end if;

  select nombre into v_na from public.usuario where id = p.jugador_a;
  select nombre into v_nb from public.usuario where id = p.jugador_b;

  insert into public.marcador (
    codigo, partido_id, nombre_a, nombre_b, dueno, sets_para_ganar, puntos_por_set, saca
  ) values (
    public.codigo_marcador(), p_partido_id, v_na, v_nb, v_yo,
    coalesce(p_sets_para_ganar, 3), coalesce(p_puntos_por_set, 11), 'a'
  )
  returning * into m;
  return m;
end;
$function$;

CREATE OR REPLACE FUNCTION public.abrir_marcador_libre(p_nombre_a text, p_nombre_b text, p_sets_para_ganar smallint, p_puntos_por_set smallint)
 RETURNS marcador
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m    public.marcador%rowtype;
  v_yo uuid := auth.uid();
begin
  perform public.exigir_activo();
  if v_yo is null then raise exception 'Tenés que ingresar' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_nombre_a, ''))) = 0 or length(btrim(coalesce(p_nombre_b, ''))) = 0 then
    raise exception 'Poné los dos nombres';
  end if;

  insert into public.marcador (
    codigo, nombre_a, nombre_b, dueno, sets_para_ganar, puntos_por_set, saca
  ) values (
    public.codigo_marcador(),
    left(btrim(p_nombre_a), 40), left(btrim(p_nombre_b), 40), v_yo,
    coalesce(p_sets_para_ganar, 3), coalesce(p_puntos_por_set, 11), 'a'
  )
  returning * into m;
  return m;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sincronizar_marcador(p_marcador_id uuid, p_version bigint, p_puntos_a smallint, p_puntos_b smallint, p_sets_a smallint, p_sets_b smallint, p_historial jsonb, p_saca text, p_estado text)
 RETURNS marcador
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m       public.marcador%rowtype;
  v_yo    uuid := auth.uid();
  v_est   public.marcador_estado;
  v_largo int;
begin
  perform public.exigir_activo();
  select * into m from public.marcador where id = p_marcador_id for update;
  if m.id is null then raise exception 'Marcador no existe'; end if;
  if m.dueno <> v_yo and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;

  -- Foto vieja: no es error, simplemente ya pasó
  if p_version <= m.version then return m; end if;

  if m.estado <> 'en_juego' then
    raise exception 'El marcador ya está %', m.estado;
  end if;

  v_est := coalesce(nullif(p_estado, ''), 'en_juego')::public.marcador_estado;

  if p_sets_a > m.sets_para_ganar or p_sets_b > m.sets_para_ganar then
    raise exception 'Más sets de los que se juegan (al mejor de %)', m.sets_para_ganar * 2 - 1;
  end if;
  if jsonb_typeof(p_historial) <> 'array' then raise exception 'Historial inválido'; end if;
  v_largo := jsonb_array_length(p_historial);
  if v_largo <> p_sets_a + p_sets_b then
    raise exception 'El historial trae % sets y el marcador dice %', v_largo, p_sets_a + p_sets_b;
  end if;

  update public.marcador set
    puntos_a       = p_puntos_a,
    puntos_b       = p_puntos_b,
    sets_a         = p_sets_a,
    sets_b         = p_sets_b,
    historial      = p_historial,
    saca           = nullif(p_saca, ''),
    estado         = v_est,
    version        = p_version,
    actualizado_en = now()
  where id = m.id
  returning * into m;
  return m;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_marcador(p_marcador_id uuid)
 RETURNS marcador
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.marcador%rowtype;
begin
  perform public.exigir_activo();
  select * into m from public.marcador where id = p_marcador_id for update;
  if m.id is null then raise exception 'Marcador no existe'; end if;
  if m.dueno <> auth.uid() and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;
  if m.estado = 'en_juego' then return m; end if;

  -- No se puede reabrir si el partido ya quedó registrado por la vía normal
  if m.partido_id is not null and exists (
    select 1 from public.partido p
     where p.id = m.partido_id and p.estado in ('confirmado', 'resuelto', 'anulado')
  ) then
    raise exception 'El resultado de ese partido ya quedó firme';
  end if;

  update public.marcador
     set estado = 'en_juego', version = m.version + 1, actualizado_en = now()
   where id = m.id
  returning * into m;
  return m;
end;
$function$;
