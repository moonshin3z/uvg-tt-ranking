-- Verificación de una base en la nube recién creada.
--
-- Se pega entera en el SQL Editor de Supabase, después de `db push` y antes de
-- crear el primer coordinador. Solo lee: no escribe nada, no borra nada.
--
-- Cada fila dice OK o MAL. Si todas dicen OK, la nube quedó igual que la local.
-- Las de seguridad son las que importan de verdad: una base con RLS apagada o
-- con `debe_cambiar_pin` legible desde el navegador está abierta, aunque la
-- aplicación se vea bien.

with c as (

  select 1 as n, 'Las 21 migraciones' as que,
         count(*)::text || ' de 21' as valor, count(*) = 21 as bien
    from supabase_migrations.schema_migrations

  union all
  select 2, 'RLS en todas las tablas',
         coalesce(string_agg(t.tablename, ', '), 'todas con RLS'),
         count(*) = 0
    from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where t.schemaname = 'public' and not c.relrowsecurity

  union all
  -- Solo SELECT. INSERT y UPDATE también aparecen concedidos sobre esa columna,
  -- pero es la postura por omisión de Supabase (`grant all` sobre todo el
  -- esquema public) y quien decide ahí es RLS: escribir en `usuario` exige
  -- es_coordinador(). Lo que no puede pasar es que la columna se pueda LEER,
  -- porque eso sí llega al navegador con la llave publicable.
  select 3, 'debe_cambiar_pin no se puede leer',
         count(*)::text || ' permisos de lectura (debe ser 0)', count(*) = 0
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'usuario'
     and column_name = 'debe_cambiar_pin'
     and privilege_type = 'SELECT'
     and grantee in ('anon', 'authenticated')

  union all
  select 4, 'carnet y nombre sí legibles',
         count(*)::text || ' permisos (debe ser 2+)', count(*) >= 2
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'usuario'
     and column_name in ('carnet', 'nombre')
     and grantee = 'anon' and privilege_type = 'SELECT'

  union all
  select 5, 'Sin usuarios de prueba',
         count(*)::text || ' usuarios (debe ser 0)', count(*) = 0
    from public.usuario

  union all
  select 6, 'Funciones del sistema',
         count(*)::text || ' de 12', count(*) = 12
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where p.proname in ('cambiar_mi_pin', 'asignar_rol', 'mi_perfil', 'reglas_de_partido',
                       'registrar_resultado', 'confirmar_resultado', 'disputar_resultado',
                       'orden_division', 'decidir_empate', 'generar_desempates',
                       'sincronizar_marcador', 'autoconfirmar_vencidos')

  union all
  select 7, 'Vista de posiciones',
         coalesce(to_regclass('public.tabla_posiciones')::text, 'no existe'),
         to_regclass('public.tabla_posiciones') is not null

  union all
  select 8, 'Sets por defecto del ranking',
         coalesce((select column_default from information_schema.columns
                    where table_schema = 'public' and table_name = 'ranking'
                      and column_name = 'sets_para_ganar'), 'sin default'),
         (select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'ranking'
             and column_name = 'sets_para_ganar') like '2%'

  union all
  -- Dos versiones de una misma función hacen que PostgREST responda 300 y no
  -- llame a ninguna. Pasó con crear_ranking y solo se ve desde la aplicación,
  -- porque una llamada por SQL con todos los argumentos resuelve sin ambigüedad.
  select 9, 'Ninguna función duplicada',
         coalesce((select string_agg(proname, ', ')
                     from (select p.proname from pg_proc p
                             join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                            group by p.proname having count(*) > 1) d),
                  'ninguna'),
         not exists (select 1 from pg_proc p
                       join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public'
                      group by p.proname having count(*) > 1)

  union all
  select 10, 'pg_cron habilitado',
         case when exists (select 1 from pg_extension where extname = 'pg_cron')
              then 'sí' else 'NO — habilitalo en Database > Extensions' end,
         exists (select 1 from pg_extension where extname = 'pg_cron')

)
select n as "#",
       case when bien then 'OK ' else 'MAL' end as estado,
       que as revisión,
       valor as detalle
  from c
 order by n;

-- La autoconfirmación va aparte porque `cron.job` solo existe si `pg_cron`
-- está habilitado, y Postgres revisa que las tablas existan antes de correr la
-- consulta: si se mezcla con lo de arriba, sin pg_cron falla todo el bloque en
-- vez de dar MAL en una fila. Correla solo si la revisión 10 dijo OK.

select jobname, schedule, active
  from cron.job
 where jobname = 'autoconfirmar-partidos';
