-- Quita la versión vieja de crear_ranking.
--
-- La migración 27 le agregó `p_sets_para_ganar` y `p_puntos_por_set`. Con
-- `create or replace` eso no reemplaza nada: en Postgres dos funciones con el
-- mismo nombre y distinta lista de argumentos son dos funciones distintas. Así
-- que quedaron las dos, la de 10 parámetros y la de 12.
--
-- En SQL no molesta, porque una llamada con los 12 argumentos resuelve sola.
-- Por PostgREST sí: como todos los parámetros de la mitad para atrás tienen
-- default, un cuerpo JSON con 10 claves encaja en las dos y el servidor
-- responde 300 sin llamar a ninguna:
--
--   Could not choose the best candidate function between:
--   public.crear_ranking(... p_horas_autoconfirmacion => integer),
--   public.crear_ranking(... p_sets_para_ganar => smallint, p_puntos_por_set => smallint)
--
-- Se descubrió creando un ranking desde el teléfono contra producción. No
-- salió antes porque la semilla inserta los rankings con INSERT directo y las
-- pruebas SQL llaman a la función con la lista completa de argumentos: ninguno
-- de los dos caminos pasa por la resolución de sobrecarga de PostgREST.
drop function if exists public.crear_ranking(
  uuid, smallint, text, date, smallint, smallint, smallint, smallint, smallint, integer
);
