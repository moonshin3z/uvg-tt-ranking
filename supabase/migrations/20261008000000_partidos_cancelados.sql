-- Cancelar conserva la historia, pero ya no permite resultados ni marcadores.
-- Cuerpos actuales completos: solo se agrega la guarda de cancelación.
-- El cierre conserva su comportamiento anterior: un marcador en vuelo puede
-- guardar lo que pasó en la mesa y explicar por qué no registró el resultado.

CREATE OR REPLACE FUNCTION public.exigir_partido_editable(p_partido_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record;
begin
  perform public.exigir_activo();

  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;
  if c.estado = 'cancelado' then
    raise exception 'El % está cancelado', c.clase;
  end if;
  if c.estado = 'cerrado' then
    if c.clase = 'ranking' then
      raise exception 'El ranking ya está cerrado';
    else
      raise exception 'El torneo "%" ya terminó', c.nombre;
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.exigir_partido_jugable(p_partido_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  v_tipo public.partido_tipo;
begin
  perform public.exigir_activo();

  select * into c from public.contenedor_de_partido(p_partido_id);
  if c is null then raise exception 'Ese partido no pertenece a ningún ranking ni torneo'; end if;
  if c.estado = 'cancelado' then
    raise exception 'El % está cancelado', c.clase;
  end if;

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
  if m.partido_id is not null and exists (
    select 1 from public.contenedor_de_partido(m.partido_id) c where c.estado = 'cancelado'
  ) then
    raise exception 'El ranking o torneo de este marcador está cancelado';
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

CREATE OR REPLACE FUNCTION public.sincronizar_marcador(p_marcador_id uuid, p_version bigint, p_puntos_a smallint, p_puntos_b smallint, p_sets_a smallint, p_sets_b smallint, p_historial jsonb, p_saca text, p_estado text)
 RETURNS marcador
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if m.partido_id is not null and exists (
    select 1 from public.contenedor_de_partido(m.partido_id) c where c.estado = 'cancelado'
  ) then
    raise exception 'El ranking o torneo de este marcador está cancelado';
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
$function$;

-- CREATE OR REPLACE conserva las firmas y sus permisos anteriores.
