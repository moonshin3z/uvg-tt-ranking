-- =============================================================================
-- Tres divisiones y partidos por semana: tipos y columnas.
--
-- El club pasó de dos divisiones (Mayor y Menor) a tres: Primera, Segunda y
-- Tercera. Los valores viejos se renombran en vez de crear otros, así los
-- rankings que ya existen quedan como Primera y Segunda sin tocar una fila.
--
-- Va en su propio archivo porque Postgres no deja usar un valor de enum recién
-- agregado dentro de la misma transacción, y el CLI corre cada migración en
-- una. Las funciones que usan 'tercera' están en la migración siguiente.
-- =============================================================================

alter type public.division_tipo rename value 'mayor' to 'primera';
alter type public.division_tipo rename value 'menor' to 'segunda';
alter type public.division_tipo add value if not exists 'tercera' after 'segunda';

-- -----------------------------------------------------------------------------
-- Semanas
--
-- El coordinador quiere que cada semana se jueguen unos pocos partidos (4 o 5
-- para todo el club), anunciados de antemano. Los partidos no tienen día: se
-- juegan martes, miércoles o jueves según les quede a los dos.
-- -----------------------------------------------------------------------------

alter table public.ranking
  add column if not exists partidos_por_semana smallint not null default 5,
  add column if not exists inicio_semanas date;

alter table public.ranking
  add constraint ranking_partidos_por_semana check (partidos_por_semana between 1 and 30);

comment on column public.ranking.partidos_por_semana is
  'Cuántos partidos se reparten por semana, sumando todas las divisiones.';
comment on column public.ranking.inicio_semanas is
  'El lunes de la semana 1. Se fija al abrir el ranking; null en los que no usan semanas.';

alter table public.partido
  add column if not exists semana smallint,
  add column if not exists semana_fija boolean not null default false,
  add column if not exists jornada smallint;

alter table public.partido
  add constraint partido_semana_valida check (semana is null or semana >= 1);

comment on column public.partido.semana is
  'La semana en que le toca jugarse. La reparte planificar_semanas; si se jugó antes, es la semana en que se jugó.';
comment on column public.partido.semana_fija is
  'La puso el coordinador a mano: planificar_semanas no la mueve.';
comment on column public.partido.jornada is
  'Jornada del todos contra todos (método del círculo): en una misma jornada nadie juega dos veces. planificar_semanas la usa como prioridad.';

create index if not exists partido_semana_idx on public.partido (division_id, semana);
