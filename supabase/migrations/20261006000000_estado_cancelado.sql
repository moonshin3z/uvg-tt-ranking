-- Un ranking o un torneo creado por equivocación no tenía salida. No es que
-- estuviera escondida: no existía. No hay función que borre, y el `grant` a
-- `authenticated` sobre `ranking` y `torneo` es solo `select`, así que ni desde
-- la app ni pegándole directo a PostgREST se podía hacer un DELETE. La única
-- forma era entrar al SQL editor de Supabase con el service role.
--
-- A partir de acá hay dos salidas, y cuál aplica depende de qué tanto pasó
-- adentro:
--
--   borrar     desaparece la fila y todo lo que cuelga de ella. Solo mientras
--              nadie haya registrado un resultado. En el momento en que alguien
--              jugó y anotó un marcador, eso dejó de ser un error del
--              coordinador y pasó a ser historia de un jugador.
--
--   cancelar   la fila se queda, con estado 'cancelado', y sale de todas las
--              vistas públicas. No se pierde nada.
--
-- Este archivo solo agrega el valor al enum, y va solo. Postgres deja hacer
-- `alter type ... add value` dentro de una transacción pero no deja *usar* el
-- valor nuevo en esa misma transacción, y las migraciones de Supabase corren
-- cada una en una transacción. Por eso las funciones que escriben 'cancelado'
-- viven en la migración siguiente y no acá.

alter type public.ranking_estado add value if not exists 'cancelado';
alter type public.torneo_estado  add value if not exists 'cancelado';
