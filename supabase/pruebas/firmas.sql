-- =============================================================================
-- Pruebas de las firmas de las funciones.
--
-- Una sola invariante, pero cierra una clase entera de fallas: en el esquema
-- `public` ninguna función puede tener dos versiones.
--
-- Por qué importa. La aplicación no llama a estas funciones por SQL sino por
-- PostgREST, que manda un cuerpo JSON y elige la función según qué claves
-- trae. Si hay dos con el mismo nombre y los parámetros de más tienen valor
-- por omisión, el mismo cuerpo encaja en las dos, PostgREST no elige ninguna y
-- responde 300. La pantalla muestra las dos firmas en rojo y no pasa nada.
--
-- Cómo aparece una segunda versión sin que uno se dé cuenta: agregándole un
-- parámetro a una función con `create or replace`. Eso no reemplaza nada,
-- porque para Postgres dos listas de argumentos distintas son dos funciones
-- distintas. Pasó con `crear_ranking` en la migración 27 y se descubrió recién
-- en producción, creando un ranking desde un teléfono.
--
-- Las pruebas por SQL no lo habrían encontrado nunca: llamando con la lista
-- completa de argumentos, la resolución de Postgres es exacta y no hay
-- ambigüedad. Por eso esta prueba mira el catálogo y no hace una llamada.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

do $$
declare v_dup text;
begin
  select string_agg(proname, ', ') into v_dup
    from (
      select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
       group by p.proname
      having count(*) > 1
    ) d;

  if v_dup is not null then
    raise exception
      'AGUJERO: estas funciones tienen más de una versión y PostgREST no va a poder elegir: %', v_dup;
  end if;

  raise notice 'ok · ninguna función de public está duplicada';
end $$;

rollback;
