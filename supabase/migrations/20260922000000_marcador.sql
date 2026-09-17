-- =============================================================================
-- Fase 5 · Marcador en vivo
--
-- La idea es que el celular reemplace al marcador físico cuando no hay uno.
-- De ahí salen las dos reglas que mandan en este diseño:
--
--   1. Tiene que funcionar SIN partido registrado. Dos personas cualesquiera
--      agarran un teléfono y anotan. Por eso `partido_id` es nullable y hay
--      `nombre_a` / `nombre_b` de texto libre.
--   2. Se anota local y se publica. El cliente lleva la cuenta al instante
--      (sin esperar red) y manda fotos del estado cada tanto. El servidor no
--      cuenta puntos, solo guarda el último estado conocido y lo reparte por
--      Realtime a quien esté mirando.
--
-- Por eso `sincronizar_marcador` recibe el estado completo y no incrementos:
-- con mala señal los incrementos se pierden o se duplican, una foto con número
-- de versión no. Gana siempre la versión más alta del dueño.
--
-- `historial` guarda los sets cerrados como [[11,7],[9,11],...], que es
-- exactamente la forma que `registrar_resultado` ya espera en `p_puntos`. Al
-- terminar, el resultado se registra con la ruta de siempre: confirmación del
-- rival, disputa y autoconfirmación incluidas. El marcador no es un camino
-- paralelo para meter resultados.
-- =============================================================================

do $$ begin
  create type public.marcador_estado as enum ('en_juego', 'terminado', 'abandonado');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Código corto para compartir. Sin vocales ni caracteres que se confundan
-- (0/O, 1/I/L) porque la gente lo va a dictar en voz alta en el gimnasio.
-- -----------------------------------------------------------------------------
create or replace function public.codigo_marcador()
returns text
language plpgsql
volatile
as $$
declare
  abc  constant text := '23456789BCDFGHJKMNPQRSTVWXYZ';
  cod  text;
  i    int;
begin
  loop
    cod := '';
    for i in 1..5 loop
      cod := cod || substr(abc, 1 + floor(random() * length(abc))::int, 1);
    end loop;
    exit when not exists (select 1 from public.marcador m where m.codigo = cod);
  end loop;
  return cod;
end;
$$;

create table if not exists public.marcador (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  -- null = partido suelto que no cuenta para nada
  partido_id      uuid references public.partido (id) on delete cascade,
  nombre_a        text not null,
  nombre_b        text not null,
  -- quien opera el marcador; es el único que puede sincronizar
  dueno           uuid not null references public.usuario (id) on delete restrict,
  sets_para_ganar smallint not null default 3,     -- 3 = al mejor de 5
  puntos_por_set  smallint not null default 11,
  puntos_a        smallint not null default 0,
  puntos_b        smallint not null default 0,
  sets_a          smallint not null default 0,
  sets_b          smallint not null default 0,
  historial       jsonb not null default '[]'::jsonb,
  saca            text,                            -- 'a' | 'b' | null
  estado          public.marcador_estado not null default 'en_juego',
  -- monótona; el servidor descarta fotos viejas que llegan tarde
  version         bigint not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint marcador_nombres check (
    length(btrim(nombre_a)) > 0 and length(btrim(nombre_b)) > 0
  ),
  constraint marcador_sets_para_ganar check (sets_para_ganar between 1 and 4),
  constraint marcador_puntos_por_set check (puntos_por_set between 5 and 21),
  constraint marcador_puntos check (puntos_a between 0 and 99 and puntos_b between 0 and 99),
  constraint marcador_sets check (
    sets_a between 0 and 4 and sets_b between 0 and 4
    and sets_a <= sets_para_ganar and sets_b <= sets_para_ganar
  ),
  constraint marcador_saca check (saca is null or saca in ('a', 'b')),
  constraint marcador_historial check (jsonb_typeof(historial) = 'array')
);

-- Un partido no puede tener dos marcadores vivos a la vez. Si dos jugadores
-- abren el marcador del mismo partido, el segundo se engancha al primero.
create unique index if not exists marcador_un_vivo_por_partido
  on public.marcador (partido_id)
  where partido_id is not null and estado = 'en_juego';

create index if not exists marcador_estado_idx on public.marcador (estado, actualizado_en desc);
create index if not exists marcador_dueno_idx on public.marcador (dueno, creado_en desc);

comment on table public.marcador is
  'Marcador en vivo. El cliente cuenta y manda fotos del estado; el servidor solo guarda la última y la reparte por Realtime.';
comment on column public.marcador.version is
  'Monótona por marcador. sincronizar_marcador descarta fotos con versión menor o igual a la guardada.';

-- =============================================================================
-- Abrir el marcador de un partido que ya existe
--
-- Idempotente a propósito: si ya hay uno vivo para ese partido lo devuelve en
-- vez de fallar. Es lo que hace falta cuando alguien recarga la página o
-- cuando los dos jugadores lo abren al mismo tiempo.
-- =============================================================================
create or replace function public.abrir_marcador_de_partido(
  p_partido_id      uuid,
  p_sets_para_ganar smallint,
  p_puntos_por_set  smallint
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m        public.marcador%rowtype;
  p        public.partido%rowtype;
  v_yo     uuid := auth.uid();
  v_coord  boolean := public.es_coordinador();
  v_na     text;
  v_nb     text;
begin
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
$$;

-- =============================================================================
-- Abrir un marcador suelto (no cuenta para nada, solo cuenta puntos)
-- =============================================================================
create or replace function public.abrir_marcador_libre(
  p_nombre_a        text,
  p_nombre_b        text,
  p_sets_para_ganar smallint,
  p_puntos_por_set  smallint
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m    public.marcador%rowtype;
  v_yo uuid := auth.uid();
begin
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
$$;

-- =============================================================================
-- Sincronizar: el cliente manda una foto completa del estado
--
-- Si la versión que llega es menor o igual a la guardada, la foto es vieja
-- (llegó tarde por la red) y se ignora en silencio devolviendo lo que hay.
-- Eso es lo que hace que anotar sin señal y recuperar después no rompa nada.
-- =============================================================================
create or replace function public.sincronizar_marcador(
  p_marcador_id uuid,
  p_version     bigint,
  p_puntos_a    smallint,
  p_puntos_b    smallint,
  p_sets_a      smallint,
  p_sets_b      smallint,
  p_historial   jsonb,
  p_saca        text,
  p_estado      text
)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m       public.marcador%rowtype;
  v_yo    uuid := auth.uid();
  v_est   public.marcador_estado;
  v_largo int;
begin
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
$$;

-- =============================================================================
-- Reabrir un marcador terminado por error
-- =============================================================================
create or replace function public.reabrir_marcador(p_marcador_id uuid)
returns public.marcador
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.marcador%rowtype;
begin
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
$$;

-- =============================================================================
-- RLS
--
-- Lectura pública: cualquiera puede mirar un marcador en vivo con el código,
-- igual que mirar el marcador de la mesa desde la grada. Escritura solo por
-- las funciones de arriba.
-- =============================================================================
alter table public.marcador enable row level security;

drop policy if exists marcador_lectura on public.marcador;
create policy marcador_lectura on public.marcador for select using (true);

drop policy if exists marcador_coordinador on public.marcador;
create policy marcador_coordinador on public.marcador for all
  using (public.es_coordinador()) with check (public.es_coordinador());

grant select on public.marcador to anon, authenticated;

revoke execute on function public.codigo_marcador() from public, anon, authenticated;
revoke execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) from public, anon;
revoke execute on function public.abrir_marcador_libre(text, text, smallint, smallint) from public, anon;
revoke execute on function public.sincronizar_marcador(uuid, bigint, smallint, smallint, smallint, smallint, jsonb, text, text) from public, anon;
revoke execute on function public.reabrir_marcador(uuid) from public, anon;

grant execute on function public.abrir_marcador_de_partido(uuid, smallint, smallint) to authenticated;
grant execute on function public.abrir_marcador_libre(text, text, smallint, smallint) to authenticated;
grant execute on function public.sincronizar_marcador(uuid, bigint, smallint, smallint, smallint, smallint, jsonb, text, text) to authenticated;
grant execute on function public.reabrir_marcador(uuid) to authenticated;

-- Quien mira desde la grada ve los puntos moverse
do $$ begin
  alter publication supabase_realtime add table public.marcador;
exception when duplicate_object then null; end $$;
