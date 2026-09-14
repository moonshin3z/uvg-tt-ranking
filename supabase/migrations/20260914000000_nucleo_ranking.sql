-- =============================================================================
-- UVG Tenis de Mesa · Migración 1: núcleo del ranking
-- Fuente: reglamento del club (dos divisiones, round robin, 2 rankings por
-- semestre, 3 suben / 3 bajan) y modelo v2 acordado en el proyecto.
--
-- Principios:
--   * La tabla de posiciones NUNCA se persiste: es una vista sobre partidos
--     confirmados (ver tabla_posiciones).
--   * Los jugadores no escriben directamente en partido; lo hacen a través de
--     funciones RPC (fase 3) que validan la transición de estado. Aquí solo
--     se define el esquema, RLS de lectura y escritura del coordinador.
--   * Todo cambio a un partido queda en partido_evento (bitácora).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.rol as enum ('jugador', 'coordinador');
create type public.division_tipo as enum ('mayor', 'menor');
create type public.ranking_estado as enum ('borrador', 'abierto', 'fase_regular_cerrada', 'en_desempates', 'cerrado');
create type public.inscripcion_origen as enum ('sorteo', 'ascenso', 'descenso', 'permanece', 'manual');
create type public.partido_tipo as enum ('regular', 'desempate');
create type public.partido_estado as enum ('pendiente', 'jugado', 'confirmado', 'disputado', 'resuelto', 'anulado');
create type public.evento_accion as enum ('registro', 'confirmo', 'disputo', 'edito', 'resolvio', 'autoconfirmo', 'anulo', 'creo');

-- -----------------------------------------------------------------------------
-- Usuario (perfil público de auth.users)
-- El identificador humano es el carnet; el técnico es el uid de Supabase Auth.
-- Email interno de auth: {carnet}@uvgtt.local · contraseña: PIN.
-- -----------------------------------------------------------------------------
create table public.usuario (
  id          uuid primary key references auth.users (id) on delete cascade,
  carnet      text not null unique,
  nombre      text not null,
  rol         public.rol not null default 'jugador',
  activo      boolean not null default true,
  debe_cambiar_pin boolean not null default true,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint usuario_carnet_formato check (carnet ~ '^([0-9]{4,8}|EXT-[A-Z0-9]{2,12})$'),
  constraint usuario_nombre_no_vacio check (length(trim(nombre)) between 2 and 80)
);

comment on table public.usuario is 'Perfil del miembro del club. carnet = carnet UVG o EXT-xxx para externos.';

-- Al crear un usuario en auth (API admin, con user_metadata {carnet, nombre, rol})
-- se crea automáticamente su perfil.
create or replace function public.crear_perfil_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuario (id, carnet, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'carnet', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre'),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol, 'jugador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_desde_auth();

-- -----------------------------------------------------------------------------
-- Helpers de autorización (usados en RLS)
-- -----------------------------------------------------------------------------
create or replace function public.es_coordinador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario
    where id = auth.uid() and rol = 'coordinador' and activo
  );
$$;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger usuario_actualizado before update on public.usuario
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Semestre > Ranking > División > Inscripción
-- -----------------------------------------------------------------------------
create table public.semestre (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,          -- "2026-2"
  inicio  date not null,
  fin     date not null,
  constraint semestre_fechas check (fin > inicio)
);

create table public.ranking (
  id                     uuid primary key default gen_random_uuid(),
  semestre_id            uuid not null references public.semestre (id) on delete restrict,
  numero                 smallint not null,                  -- 1 | 2
  nombre                 text not null,                      -- "Ranking 1 · 2026-2"
  fecha_limite           date not null,
  estado                 public.ranking_estado not null default 'borrador',
  -- Parámetros del reglamento (configurables por ranking)
  pts_victoria           smallint not null default 1,
  pts_derrota            smallint not null default 0,
  n_ascienden            smallint not null default 3,
  n_descienden           smallint not null default 3,
  n_premiados            smallint not null default 3,
  horas_autoconfirmacion integer default 72,                 -- null = nunca
  creado_en              timestamptz not null default now(),
  cerrado_en             timestamptz,
  constraint ranking_numero check (numero in (1, 2)),
  constraint ranking_unico_por_semestre unique (semestre_id, numero),
  constraint ranking_params_no_negativos check (
    pts_victoria >= 0 and pts_derrota >= 0 and n_ascienden >= 0
    and n_descienden >= 0 and n_premiados >= 0
    and (horas_autoconfirmacion is null or horas_autoconfirmacion > 0)
  )
);

create index ranking_semestre_idx on public.ranking (semestre_id);

create table public.division (
  id          uuid primary key default gen_random_uuid(),
  ranking_id  uuid not null references public.ranking (id) on delete cascade,
  tipo        public.division_tipo not null,
  cupo        smallint,                                      -- null = sin límite
  constraint division_unica_por_ranking unique (ranking_id, tipo),
  constraint division_cupo check (cupo is null or cupo >= 2)
);

create table public.inscripcion (
  id          uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.division (id) on delete cascade,
  usuario_id  uuid not null references public.usuario (id) on delete restrict,
  origen      public.inscripcion_origen not null,
  creado_en   timestamptz not null default now(),
  constraint inscripcion_unica unique (division_id, usuario_id)
);

create index inscripcion_usuario_idx on public.inscripcion (usuario_id);

-- Un jugador no puede estar en las dos divisiones del mismo ranking.
create or replace function public.validar_inscripcion_unica_en_ranking()
returns trigger
language plpgsql
as $$
declare
  v_ranking uuid;
begin
  select ranking_id into v_ranking from public.division where id = new.division_id;
  if exists (
    select 1
    from public.inscripcion i
    join public.division d on d.id = i.division_id
    where d.ranking_id = v_ranking
      and i.usuario_id = new.usuario_id
      and i.id <> new.id
  ) then
    raise exception 'El jugador ya está inscrito en otra división de este ranking';
  end if;
  return new;
end;
$$;

create trigger inscripcion_unica_en_ranking
  before insert or update on public.inscripcion
  for each row execute function public.validar_inscripcion_unica_en_ranking();

-- Sorteo inicial auditable (solo ranking 1 de la vida del club, o cuando se decida)
create table public.sorteo (
  id            uuid primary key default gen_random_uuid(),
  ranking_id    uuid not null unique references public.ranking (id) on delete cascade,
  semilla       text not null,
  ejecutado_por uuid not null references public.usuario (id),
  ejecutado_en  timestamptz not null default now(),
  resultado     jsonb not null          -- { mayor: [usuario_id...], menor: [usuario_id...] }
);

-- -----------------------------------------------------------------------------
-- Partido y sets
-- -----------------------------------------------------------------------------
create table public.partido (
  id             uuid primary key default gen_random_uuid(),
  division_id    uuid not null references public.division (id) on delete cascade,
  tipo           public.partido_tipo not null default 'regular',
  estado         public.partido_estado not null default 'pendiente',
  jugador_a      uuid not null references public.usuario (id) on delete restrict,
  jugador_b      uuid not null references public.usuario (id) on delete restrict,
  ganador        uuid references public.usuario (id),
  sets_a         smallint,
  sets_b         smallint,
  registrado_por uuid references public.usuario (id),
  registrado_en  timestamptz,
  confirmado_por uuid references public.usuario (id),   -- null si confirmó el sistema
  confirmado_en  timestamptz,
  resolucion     text,                                   -- nota del coordinador
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Canónico: a < b para que el UNIQUE detecte (a,b) y (b,a) como el mismo partido
  constraint partido_jugadores_distintos check (jugador_a <> jugador_b),
  constraint partido_orden_canonico check (jugador_a < jugador_b),
  constraint partido_ganador_es_jugador check (ganador is null or ganador in (jugador_a, jugador_b)),
  constraint partido_sets_coherentes check (
    (sets_a is null and sets_b is null)
    or (sets_a >= 0 and sets_b >= 0 and sets_a <> sets_b)
  ),
  -- Un resultado que suma debe tener ganador
  constraint partido_resultado_completo check (
    estado in ('pendiente', 'anulado') or ganador is not null
  )
);

-- Regla del reglamento: cada pareja se enfrenta UNA sola vez por ranking
-- (por tipo: puede existir un regular y un desempate).
create unique index partido_unico_por_pareja on public.partido (division_id, jugador_a, jugador_b, tipo);
create index partido_division_estado_idx on public.partido (division_id, estado);
create index partido_jugador_a_idx on public.partido (jugador_a);
create index partido_jugador_b_idx on public.partido (jugador_b);

create trigger partido_actualizado before update on public.partido
  for each row execute function public.tocar_actualizado_en();

create table public.set_partido (
  id         uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partido (id) on delete cascade,
  numero     smallint not null,
  puntos_a   smallint not null,
  puntos_b   smallint not null,
  constraint set_unico unique (partido_id, numero),
  constraint set_numero check (numero between 1 and 7),
  constraint set_puntos check (puntos_a >= 0 and puntos_b >= 0 and puntos_a <> puntos_b)
);

-- Bitácora
create table public.partido_evento (
  id         bigint generated always as identity primary key,
  partido_id uuid not null references public.partido (id) on delete cascade,
  actor      uuid references public.usuario (id),        -- null = sistema
  accion     public.evento_accion not null,
  antes      jsonb,
  despues    jsonb,
  creado_en  timestamptz not null default now()
);

create index partido_evento_partido_idx on public.partido_evento (partido_id, creado_en);

-- -----------------------------------------------------------------------------
-- Vista: tabla de posiciones (calculada, nunca persistida)
-- Cuentan solo partidos regulares en estado confirmado o resuelto.
-- Los desempates no suman puntos; se exponen como pg_desempate para ordenar.
-- El orden final (pts, desempate, enfrentamiento directo, nombre) lo aplica
-- src/lib/ranking/tabla.ts para poder testearlo sin base de datos.
-- -----------------------------------------------------------------------------
create or replace view public.tabla_posiciones
with (security_invoker = true)
as
with regulares as (
  select p.division_id, p.jugador_a, p.jugador_b, p.ganador
  from public.partido p
  where p.tipo = 'regular' and p.estado in ('confirmado', 'resuelto')
),
desempates as (
  select p.division_id, p.ganador
  from public.partido p
  where p.tipo = 'desempate' and p.estado in ('confirmado', 'resuelto')
),
por_jugador as (
  select division_id, jugador_a as usuario_id, (ganador = jugador_a)::int as gano from regulares
  union all
  select division_id, jugador_b as usuario_id, (ganador = jugador_b)::int as gano from regulares
)
select
  i.division_id,
  d.ranking_id,
  d.tipo as division,
  i.usuario_id,
  u.carnet,
  u.nombre,
  count(pj.usuario_id)::int                                   as pj,
  coalesce(sum(pj.gano), 0)::int                              as pg,
  (count(pj.usuario_id) - coalesce(sum(pj.gano), 0))::int     as pp,
  (coalesce(sum(pj.gano), 0) * r.pts_victoria
   + (count(pj.usuario_id) - coalesce(sum(pj.gano), 0)) * r.pts_derrota)::int as pts,
  (select count(*) from desempates de
     where de.division_id = i.division_id and de.ganador = i.usuario_id)::int as pg_desempate
from public.inscripcion i
join public.division d on d.id = i.division_id
join public.ranking r  on r.id = d.ranking_id
join public.usuario u  on u.id = i.usuario_id
left join por_jugador pj on pj.division_id = i.division_id and pj.usuario_id = i.usuario_id
group by i.division_id, d.ranking_id, d.tipo, i.usuario_id, u.carnet, u.nombre, r.pts_victoria, r.pts_derrota;

-- -----------------------------------------------------------------------------
-- RLS
-- Lectura pública de todo lo que aparece en la tabla (la portada no requiere
-- login). Escritura directa solo para el coordinador; los jugadores usarán
-- funciones RPC en la fase 3.
-- -----------------------------------------------------------------------------
alter table public.usuario        enable row level security;
alter table public.semestre       enable row level security;
alter table public.ranking        enable row level security;
alter table public.division       enable row level security;
alter table public.inscripcion    enable row level security;
alter table public.sorteo         enable row level security;
alter table public.partido        enable row level security;
alter table public.set_partido    enable row level security;
alter table public.partido_evento enable row level security;

-- usuario: cualquiera ve nombre/carnet/rol (necesario para la tabla pública);
-- cada quien edita solo su propio nombre; el coordinador todo.
create policy usuario_lectura_publica on public.usuario
  for select using (true);
create policy usuario_edita_su_perfil on public.usuario
  for update using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.usuario where id = auth.uid()));
create policy usuario_coordinador_todo on public.usuario
  for all using (public.es_coordinador()) with check (public.es_coordinador());

-- Tablas de estructura: lectura pública, escritura del coordinador.
create policy semestre_lectura on public.semestre for select using (true);
create policy semestre_coordinador on public.semestre for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy ranking_lectura on public.ranking for select using (true);
create policy ranking_coordinador on public.ranking for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy division_lectura on public.division for select using (true);
create policy division_coordinador on public.division for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy inscripcion_lectura on public.inscripcion for select using (true);
create policy inscripcion_coordinador on public.inscripcion for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy sorteo_lectura on public.sorteo for select using (true);
create policy sorteo_coordinador on public.sorteo for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy partido_lectura on public.partido for select using (true);
create policy partido_coordinador on public.partido for all
  using (public.es_coordinador()) with check (public.es_coordinador());

create policy set_lectura on public.set_partido for select using (true);
create policy set_coordinador on public.set_partido for all
  using (public.es_coordinador()) with check (public.es_coordinador());

-- Bitácora: la ven los dos jugadores del partido y el coordinador. Nadie la
-- edita ni borra; solo se inserta desde funciones security definer.
create policy evento_lectura on public.partido_evento
  for select using (
    public.es_coordinador()
    or exists (
      select 1 from public.partido p
      where p.id = partido_id and auth.uid() in (p.jugador_a, p.jugador_b)
    )
  );

-- Realtime para la tabla en vivo (fase 3 la consume)
alter publication supabase_realtime add table public.partido;
