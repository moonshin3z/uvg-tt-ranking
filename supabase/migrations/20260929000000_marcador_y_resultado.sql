-- =============================================================================
-- El marcador en vivo, de verdad conectado al resultado.
--
-- La migración del marcador prometía en su encabezado que al terminar, "el
-- resultado se registra con la ruta de siempre: confirmación del rival,
-- disputa y autoconfirmación incluidas", y que "el marcador no es un camino
-- paralelo para meter resultados". Ese puente nunca se construyó. El marcador
-- quedaba en 'terminado' con el partido en 'pendiente', el resultado se
-- volvía a teclear a mano, y nada comparaba lo tecleado con lo que el
-- marcador público había mostrado toda la tarde.
--
-- Decisión de Iván: al terminar el marcador, el resultado se registra solo y
-- el rival lo confirma como cualquier otro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Un aviso, para cuando el resultado no se pueda registrar.
--
-- Si el partido ya no admite resultado (el ranking cerró mientras jugaban, por
-- ejemplo), el marcador igual se guarda: lo que pasó en la mesa pasó. Pero
-- queda dicho por qué no llegó al ranking, en vez de que los jugadores se
-- enteren tres días después.
-- -----------------------------------------------------------------------------
alter table public.marcador add column if not exists aviso text;
comment on column public.marcador.aviso is
  'Por qué el resultado de este marcador no se pudo registrar en el partido. Null si se registró bien o si el marcador es libre.';

-- -----------------------------------------------------------------------------
-- 2. Un set del historial, bien formado.
-- -----------------------------------------------------------------------------
create or replace function public.historial_valido(p_historial jsonb, p_sets_a int, p_sets_b int, p_tope int)
returns text
language plpgsql
immutable
as $fn$
declare
  s jsonb;
  i int := 0;
  v_a int := 0;
  v_b int := 0;
begin
  if jsonb_typeof(p_historial) <> 'array' then return 'El historial tiene que ser un arreglo'; end if;
  if jsonb_array_length(p_historial) <> p_sets_a + p_sets_b then
    return format('El historial trae %s sets y el marcador dice %s',
                  jsonb_array_length(p_historial), p_sets_a + p_sets_b);
  end if;

  for s in select * from jsonb_array_elements(p_historial) loop
    i := i + 1;
    if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) <> 2
       or jsonb_typeof(s->0) <> 'number' or jsonb_typeof(s->1) <> 'number' then
      return format('El set %s tiene que ser un par de números', i);
    end if;
    if not public.set_valido((s->>0)::int, (s->>1)::int, p_tope) then
      return format('El set %s (%s-%s) no es posible jugando a %s', i, (s->>0)::int, (s->>1)::int, p_tope);
    end if;
    if (s->>0)::int > (s->>1)::int then v_a := v_a + 1; else v_b := v_b + 1; end if;
  end loop;

  -- Antes solo se contaba cuántos sets traía el historial, no quién los ganó.
  -- Un historial [[11,0],[11,0],[11,0]] con el marcador en 0-3 se guardaba tal
  -- cual, y el marcador público mostraba que ganó uno y que iba ganando el otro.
  if v_a <> p_sets_a or v_b <> p_sets_b then
    return format('El historial dice que los sets van %s-%s y el marcador dice %s-%s',
                  v_a, v_b, p_sets_a, p_sets_b);
  end if;
  return null;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 3. Sincronizar el marcador.
--
-- Qué cambia:
--   · el historial se valida entero, no solo su largo;
--   · `>=` en lugar de `>`: con 3 sets para ganar, un 3-3 pasaba, y eso son los
--     dos ganando el mismo partido;
--   · un marcador no se puede dar por terminado sin que alguien haya ganado;
--   · la versión que manda el cliente tiene techo. Antes, un número enorme
--     dejaba el marcador congelado para siempre y todo lo posterior se
--     descartaba en silencio, que es exactamente el modo de falla que el
--     diseño de foto más versión quería evitar;
--   · y al terminar, si el marcador cuelga de un partido, el resultado se
--     registra por la ruta de siempre.
-- -----------------------------------------------------------------------------
create or replace function public.sincronizar_marcador(
  p_marcador_id uuid, p_version bigint, p_puntos_a smallint, p_puntos_b smallint,
  p_sets_a smallint, p_sets_b smallint, p_historial jsonb, p_saca text, p_estado text
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m       public.marcador%rowtype;
  v_yo    uuid;
  v_est   public.marcador_estado;
  v_error text;
  v_aviso text;
begin
  v_yo := public.exigir_activo();
  select * into m from public.marcador where id = p_marcador_id for update;
  if m.id is null then raise exception 'Marcador no existe'; end if;
  if m.dueno <> v_yo and not public.es_coordinador() then
    raise exception 'Este marcador lo lleva otra persona' using errcode = '42501';
  end if;

  -- Foto vieja: no es error, simplemente ya pasó
  if p_version <= m.version then return m; end if;
  -- Foto del futuro: eso es un reloj roto o un cliente con un error, y
  -- aceptarla mata el marcador para siempre. Mejor decirlo.
  if p_version > m.version + 10000 then
    raise exception 'La versión % está demasiado adelante de la del servidor (%). Recargá el marcador', p_version, m.version;
  end if;

  if m.estado <> 'en_juego' then
    raise exception 'El marcador ya está %', m.estado;
  end if;

  v_est := coalesce(nullif(p_estado, ''), 'en_juego')::public.marcador_estado;

  if p_sets_a is null or p_sets_b is null or p_sets_a < 0 or p_sets_b < 0 then
    raise exception 'Los sets no pueden faltar ni ser negativos';
  end if;
  if p_sets_a >= m.sets_para_ganar and p_sets_b >= m.sets_para_ganar then
    raise exception 'Los dos no pueden llegar a % sets en el mismo partido', m.sets_para_ganar;
  end if;
  if greatest(p_sets_a, p_sets_b) > m.sets_para_ganar then
    raise exception 'Más sets de los que se juegan (al mejor de %)', m.sets_para_ganar * 2 - 1;
  end if;

  v_error := public.historial_valido(p_historial, p_sets_a, p_sets_b, m.puntos_por_set);
  if v_error is not null then raise exception '%', v_error; end if;

  if v_est = 'terminado' and greatest(p_sets_a, p_sets_b) <> m.sets_para_ganar then
    raise exception 'El partido no terminó: va %-% y se juega a % sets', p_sets_a, p_sets_b, m.sets_para_ganar;
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

  -- El puente. Solo al terminar, y solo si el marcador cuelga de un partido.
  if v_est = 'terminado' and m.partido_id is not null then
    begin
      perform public.registrar_resultado(m.partido_id, p_sets_a, p_sets_b, p_historial);
    exception when others then
      -- El marcador se guarda igual: lo que pasó en la mesa pasó. Pero queda
      -- dicho por qué no llegó al partido.
      v_aviso := sqlerrm;
    end;
    update public.marcador set aviso = v_aviso where id = m.id returning * into m;
  end if;

  return m;
end;
$fn$;

revoke execute on function public.sincronizar_marcador(uuid, bigint, smallint, smallint, smallint, smallint, jsonb, text, text) from public, anon;
grant execute on function public.sincronizar_marcador(uuid, bigint, smallint, smallint, smallint, smallint, jsonb, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Reparación: `abrir_marcador_de_partido` había perdido el código.
--
-- Al reescribirla en 20260926 para que tomara las reglas del torneo, se me
-- cayó la columna `codigo`, que es `not null` y la genera `codigo_marcador()`.
-- Resultado: abrir un marcador de un partido reventaba. La versión de acá es
-- la misma más el código, y `supabase/pruebas/marcador.sql` abre uno en cada
-- bloque, así que si vuelve a faltar algo, falla.
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

  insert into public.marcador (codigo, partido_id, nombre_a, nombre_b, dueno,
                               sets_para_ganar, puntos_por_set, saca)
  values (public.codigo_marcador(), p.id, v_na, v_nb, v_yo,
          v_reglas.sets_para_ganar, v_reglas.puntos_por_set, 'a')
  returning * into m;
  return m;
end;
$fn$;

revoke execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) from public, anon;
grant execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) to authenticated;
