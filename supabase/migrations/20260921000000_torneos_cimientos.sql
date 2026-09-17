-- =============================================================================
-- Fase 5 · Cimientos de torneos
--
-- Objetivo: que un partido de torneo pueda vivir en la tabla `partido` y herede
-- gratis todo lo que ya está probado: sets, bitácora, registrar/confirmar/
-- disputar/resolver/anular y la autoconfirmación por tiempo.
--
-- Tres cosas impedían eso y se arreglan acá:
--   1. `division_id` era not null. Ahora un partido cuelga de una división
--      (ranking) O de un torneo, exactamente uno de los dos.
--   2. El orden canónico `jugador_a < jugador_b` no aplica en una llave, donde
--      A y B son posiciones del cuadro y no son intercambiables. Se sigue
--      exigiendo en ranking y en fase de grupos.
--   3. El único por pareja bloqueaba un segundo cruce. En torneo dos jugadores
--      pueden verse en grupos y otra vez en semifinales.
--
-- `tabla_posiciones` no necesita cambios: arranca desde `inscripcion` y
-- división, así que los partidos de torneo quedan fuera solos. Los torneos son
-- independientes del ranking, que es lo que se decidió.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
--
-- Los valores nuevos de `partido_tipo` se agregan acá pero se usan hasta la
-- migración siguiente: Postgres no deja usar un valor de enum en la misma
-- transacción en que se agrega.
-- -----------------------------------------------------------------------------
alter type public.partido_tipo add value if not exists 'grupo';
alter type public.partido_tipo add value if not exists 'llave';

do $$ begin
  create type public.torneo_formato as enum ('llave', 'grupos_y_llave');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.torneo_estado as enum ('borrador', 'inscripcion', 'en_juego', 'cerrado');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Torneo
--
-- `horas_autoconfirmacion` existe acá igual que en ranking para que la misma
-- rutina de autoconfirmado sirva para los dos. null = nunca se autoconfirma.
-- -----------------------------------------------------------------------------
create table if not exists public.torneo (
  id                     uuid primary key default gen_random_uuid(),
  semestre_id            uuid not null references public.semestre (id) on delete cascade,
  nombre                 text not null,
  formato                public.torneo_formato not null,
  estado                 public.torneo_estado not null default 'borrador',
  fecha                  date,
  -- Reglas de juego por defecto de este torneo (el marcador las usa)
  sets_para_ganar        smallint not null default 3,   -- 3 = al mejor de 5
  puntos_por_set         smallint not null default 11,
  horas_autoconfirmacion smallint default 72,
  -- Estructura
  tam_llave              smallint,                      -- 2,4,8,16,32,64
  cant_grupos            smallint,                      -- solo formato grupos_y_llave
  clasifican_por_grupo   smallint not null default 2,
  creado_por             uuid references public.usuario (id),
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  constraint torneo_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint torneo_sets check (sets_para_ganar between 1 and 4),
  constraint torneo_puntos check (puntos_por_set between 5 and 21),
  constraint torneo_horas check (horas_autoconfirmacion is null or horas_autoconfirmacion between 1 and 720),
  constraint torneo_tam_llave check (tam_llave is null or tam_llave in (2, 4, 8, 16, 32, 64)),
  constraint torneo_grupos_coherentes check (
    formato = 'llave' and cant_grupos is null
    or formato = 'grupos_y_llave' and (cant_grupos is null or cant_grupos between 2 and 16)
  ),
  constraint torneo_clasifican check (clasifican_por_grupo between 1 and 4)
);

create index if not exists torneo_semestre_idx on public.torneo (semestre_id, creado_en desc);

comment on table public.torneo is
  'Torneo del club. Independiente del ranking: sus partidos no suman puntos en tabla_posiciones.';

-- -----------------------------------------------------------------------------
-- Grupos (solo formato grupos_y_llave)
-- -----------------------------------------------------------------------------
create table if not exists public.torneo_grupo (
  id        uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.torneo (id) on delete cascade,
  nombre    text not null,                              -- 'A', 'B', ...
  constraint torneo_grupo_unico unique (torneo_id, nombre)
);

-- -----------------------------------------------------------------------------
-- Inscripción al torneo
--
-- Solo miembros del club: todos están en `usuario`. Si algún día hay invitados
-- externos, se agrega una columna de nombre libre acá y nada más se rompe.
-- -----------------------------------------------------------------------------
create table if not exists public.torneo_inscripcion (
  id         uuid primary key default gen_random_uuid(),
  torneo_id  uuid not null references public.torneo (id) on delete cascade,
  usuario_id uuid not null references public.usuario (id) on delete restrict,
  siembra    smallint,                                  -- cabeza de serie; null = sin sembrar
  grupo_id   uuid references public.torneo_grupo (id) on delete set null,
  creado_en  timestamptz not null default now(),
  constraint torneo_inscripcion_unica unique (torneo_id, usuario_id),
  constraint torneo_siembra check (siembra is null or siembra > 0)
);

create unique index if not exists torneo_siembra_unica
  on public.torneo_inscripcion (torneo_id, siembra) where siembra is not null;
create index if not exists torneo_inscripcion_grupo_idx
  on public.torneo_inscripcion (grupo_id);

-- -----------------------------------------------------------------------------
-- Esqueleto de la llave
--
-- Se crea completo al sortear, con los jugadores en null donde todavía no se
-- sabe quién llega. El `partido` se crea recién cuando hay dos jugadores, que
-- es cuando se puede jugar de verdad. Así el cuadro se puede dibujar entero
-- desde el primer día sin inventar partidos que no existen.
--
-- ronda 1 = primera ronda. La final es la ronda más alta.
-- posicion = 1..n dentro de la ronda, de arriba hacia abajo del cuadro.
-- El ganador de (ronda r, posicion p) va a (ronda r+1, posicion ceil(p/2)),
-- del lado A si p es impar y del lado B si es par.
-- -----------------------------------------------------------------------------
create table if not exists public.torneo_llave (
  id         uuid primary key default gen_random_uuid(),
  torneo_id  uuid not null references public.torneo (id) on delete cascade,
  ronda      smallint not null,
  posicion   smallint not null,
  jugador_a  uuid references public.usuario (id) on delete restrict,
  jugador_b  uuid references public.usuario (id) on delete restrict,
  partido_id uuid references public.partido (id) on delete set null,
  ganador    uuid references public.usuario (id) on delete restrict,
  constraint torneo_llave_unica unique (torneo_id, ronda, posicion),
  constraint torneo_llave_ronda check (ronda between 1 and 8),
  constraint torneo_llave_posicion check (posicion > 0),
  constraint torneo_llave_distintos check (
    jugador_a is null or jugador_b is null or jugador_a <> jugador_b
  ),
  constraint torneo_llave_ganador check (
    ganador is null or ganador in (jugador_a, jugador_b)
  )
);

create unique index if not exists torneo_llave_partido_unico
  on public.torneo_llave (partido_id) where partido_id is not null;
create index if not exists torneo_llave_torneo_idx
  on public.torneo_llave (torneo_id, ronda, posicion);

-- =============================================================================
-- Generalizar `partido`
-- =============================================================================

alter table public.partido alter column division_id drop not null;

alter table public.partido
  add column if not exists torneo_id uuid references public.torneo (id) on delete cascade;
alter table public.partido
  add column if not exists grupo_id uuid references public.torneo_grupo (id) on delete set null;

-- Exactamente un contenedor: o división (ranking) o torneo.
alter table public.partido drop constraint if exists partido_contenedor;
alter table public.partido add constraint partido_contenedor check (
  (division_id is not null) <> (torneo_id is not null)
);

-- Un grupo solo tiene sentido dentro de un torneo.
alter table public.partido drop constraint if exists partido_grupo_de_torneo;
alter table public.partido add constraint partido_grupo_de_torneo check (
  grupo_id is null or torneo_id is not null
);

-- Orden canónico: se sigue exigiendo en ranking y en fase de grupos, donde el
-- par (a,b) es simétrico. En la llave no, porque A y B son posiciones del
-- cuadro y cambiarlas cambiaría de qué lado juega cada uno.
alter table public.partido drop constraint if exists partido_orden_canonico;
alter table public.partido add constraint partido_orden_canonico check (
  jugador_a < jugador_b
  or (torneo_id is not null and grupo_id is null)
);

-- Dentro de un grupo la pareja sí es única (round robin).
create unique index if not exists partido_unico_por_grupo
  on public.partido (grupo_id, jugador_a, jugador_b) where grupo_id is not null;

create index if not exists partido_torneo_idx on public.partido (torneo_id, estado);
create index if not exists partido_grupo_idx on public.partido (grupo_id);

-- `partido_unico_por_pareja` sigue como está: con division_id en null Postgres
-- trata cada fila como distinta, así que no estorba a los partidos de torneo.

-- =============================================================================
-- El contenedor del partido
--
-- Las funciones de fase 3 preguntan por `ranking_de_partido()` para saber si el
-- partido se puede tocar y cuántas horas hay para autoconfirmar. En vez de
-- reescribir cinco funciones ya probadas, esta devuelve una fila equivalente
-- cuando el partido es de torneo. Los guardas siguen valiendo tal cual.
--
-- Limitación conocida: los mensajes de error de esas funciones dicen "ranking".
-- Para un partido de torneo el texto queda raro aunque la decisión sea la
-- correcta. Se corrige cuando se escriban las pantallas de torneo.
-- =============================================================================
create or replace function public.ranking_de_partido(p_partido_id uuid)
returns public.ranking
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.partido%rowtype;
  r public.ranking%rowtype;
  t public.torneo%rowtype;
begin
  select * into p from public.partido where id = p_partido_id;
  if p.id is null then return null; end if;

  if p.division_id is not null then
    select rk.* into r
      from public.ranking rk
      join public.division d on d.ranking_id = rk.id
     where d.id = p.division_id;
    return r;
  end if;

  select * into t from public.torneo where id = p.torneo_id;
  if t.id is null then return null; end if;

  -- Fila sintética. Los guardas solo leen estado y horas_autoconfirmacion.
  r.id                     := null;
  r.nombre                 := t.nombre;
  r.estado                 := case t.estado
                                when 'en_juego' then 'abierto'
                                when 'cerrado'  then 'cerrado'
                                else 'borrador'
                              end::public.ranking_estado;
  r.horas_autoconfirmacion := t.horas_autoconfirmacion;
  return r;
end;
$$;
revoke execute on function public.ranking_de_partido(uuid) from public, anon;

-- =============================================================================
-- RLS: igual que el resto del sistema. Lectura pública, escritura coordinador.
-- Todo cambio de estado real pasa por funciones security definer.
-- =============================================================================
alter table public.torneo             enable row level security;
alter table public.torneo_grupo       enable row level security;
alter table public.torneo_inscripcion enable row level security;
alter table public.torneo_llave       enable row level security;

drop policy if exists torneo_lectura on public.torneo;
create policy torneo_lectura on public.torneo for select using (true);
drop policy if exists torneo_coordinador on public.torneo;
create policy torneo_coordinador on public.torneo for all
  using (public.es_coordinador()) with check (public.es_coordinador());

drop policy if exists torneo_grupo_lectura on public.torneo_grupo;
create policy torneo_grupo_lectura on public.torneo_grupo for select using (true);
drop policy if exists torneo_grupo_coordinador on public.torneo_grupo;
create policy torneo_grupo_coordinador on public.torneo_grupo for all
  using (public.es_coordinador()) with check (public.es_coordinador());

drop policy if exists torneo_inscripcion_lectura on public.torneo_inscripcion;
create policy torneo_inscripcion_lectura on public.torneo_inscripcion for select using (true);
drop policy if exists torneo_inscripcion_coordinador on public.torneo_inscripcion;
create policy torneo_inscripcion_coordinador on public.torneo_inscripcion for all
  using (public.es_coordinador()) with check (public.es_coordinador());

drop policy if exists torneo_llave_lectura on public.torneo_llave;
create policy torneo_llave_lectura on public.torneo_llave for select using (true);
drop policy if exists torneo_llave_coordinador on public.torneo_llave;
create policy torneo_llave_coordinador on public.torneo_llave for all
  using (public.es_coordinador()) with check (public.es_coordinador());

grant select on public.torneo, public.torneo_grupo, public.torneo_inscripcion, public.torneo_llave
  to anon, authenticated;

-- El cuadro se actualiza en vivo mientras se juega.
do $$ begin
  alter publication supabase_realtime add table public.torneo_llave;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.torneo;
exception when duplicate_object then null; end $$;
