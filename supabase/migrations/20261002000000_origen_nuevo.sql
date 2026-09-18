-- Prepara lo que la migración siguiente necesita.
--
-- Va en su propio archivo porque Postgres no deja usar un valor de enum recién
-- agregado dentro de la misma transacción que lo agregó, y el CLI corre cada
-- archivo de migración en una transacción.

-- Para el jugador que entra al club después del primer ranking, o el que se
-- había retirado y vuelve. No es sorteo, ni ascenso, ni descenso, ni permanece:
-- no venía de ningún lado.
alter type public.inscripcion_origen add value if not exists 'nuevo';

-- De qué ranking hereda este sus divisiones. Null solo en el primero de todos,
-- que es el único que se sortea.
alter table public.ranking
  add column if not exists anterior_id uuid references public.ranking(id) on delete set null;

comment on column public.ranking.anterior_id is
  'El ranking del que salieron estas divisiones. Con esto puesto, sortear está prohibido: los lugares vienen de la tabla anterior.';
