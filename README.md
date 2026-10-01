# Club de Tenis de Mesa UVG

Sistema del club: ranking por divisiones (Mayor y Menor, round robin, dos rankings por semestre), registro y confirmación de resultados, torneos y marcador en vivo. PWA móvil primero.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack) + Tailwind 4 + componentes estilo shadcn/ui
- Supabase: Postgres, Auth (carnet + PIN), RLS, Realtime
- Vercel + Supabase, plan gratuito

## Requisitos

- Node 20.9+ y npm
- Docker Desktop (para Supabase local)

## Arrancar en local

```bash
npm install
npm run db:start          # levanta Supabase local (Postgres, Auth, Studio) y aplica migraciones + seed
cp .env.example .env.local
# pegar en .env.local la URL y la anon key que imprime `npm run db:start`
npm run dev               # http://localhost:3100
```

Studio local: http://127.0.0.1:54323

Usuarios del seed (PIN `123456` para todos):

| Carnet | Rol         | División |
| ------ | ----------- | -------- |
| 20001  | coordinador | primera  |
| 20002  | jugador     | primera  |
| 20005  | jugador     | segunda  |

## Comandos

| Comando                     | Qué hace                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| `npm run verify`            | typecheck + lint + formato + tests + build (job verify de CI)       |
| `npm test`                  | tests unitarios (vitest)                                            |
| `npm run db:reset`          | recrea la BD local con migraciones + seed                           |
| `npm run db:types`          | regenera `src/lib/supabase/database.types.ts` (ver aviso)           |
| `npm run db:types:check`    | comprueba que los tipos coincidan con la base local, sin escribir   |
| `npm run db:diff -- nombre` | genera una migración a partir de cambios hechos en Studio           |
| `npm run test:sql`          | las comprobaciones de `supabase/pruebas/` contra la BD local        |
| `npm run test:humo`         | que cada pantalla cargue, con y sin sesión (navegador)              |
| `npm run test:partidos`     | independencia de torneos, filtro de ranking y cancelaciones (local) |
| `npm run test:pin`          | cambio de PIN en el primer ingreso, sin bucle (local)               |
| `npm run test:torneos`      | siembra manual y eliminación directa de torneos (local)             |
| `npm run test:jugadores`    | nombrar coordinador desde la lista de jugadores (local)             |
| `npm run test:bajas`        | bitácora de rankings y torneos borrados o cancelados (local)        |
| `npm run test:eventos`      | bitácora de eventos de un partido (local)                           |
| `npm run test:responsive`   | auditoría de layout en tres anchos (navegador)                      |

**Aviso sobre `db:types`.** Lee la base **local**, no la de la nube. Si acabás
de escribir una migración, primero hay que aplicarla en local:

```bash
npm run db:reset      # aplica TODAS las migraciones + semilla en la base local
npm run db:types      # recién ahora los tipos salen completos
```

`db:reset` recrea la base local y sus datos de demostración: respaldá antes
cualquier dato local que quieras conservar. Nunca apunta a la nube.

`db:types` ahora verifica que todas las migraciones estén aplicadas antes de
generar. Si la base está atrasada o Supabase falla, conserva el archivo anterior.
La versión anterior usaba una redirección que podía borrar tipos o sustituirlos
por una salida inválida. `supabase db push` actualiza la nube y no reemplaza el
reset local.

El job `migraciones` de CI reconstruye la base y ejecuta `db:types:check`
(mediante `node scripts/tipos-db.mjs --check`): falla si el archivo versionado
no coincide con el esquema. Solo ignora la diferencia de saltos de línea entre
Windows y Linux. Supabase CLI está fijado en 2.117.0 tanto en el proyecto como
en CI; al actualizarlo, hay que actualizar ambos y regenerar los tipos.

Las pruebas de navegador necesitan la base local con la semilla
(`npm run db:reset`) y levantan el servidor de desarrollo solas.
`test:partidos` exige aplicación y Supabase locales: crea competencias propias
de la prueba y las limpia al terminar, sin cambiar los datos de la semilla.
Comprueba a 320 px que los torneos y marcadores no dependan del ranking,
registra y confirma un resultado y verifica las cancelaciones, incluso por
enlace directo. Las RPC de cancelación se comprueban además con `test:sql`.

`test:humo` existe por una razón concreta: la auditoría de responsive mide
layout, y la pantalla de error de la aplicación tiene un layout impecable. Con
eso, `/admin/jugadores` estuvo reventando con «permission denied» desde la
migración de permisos y ninguna corrida lo dijo. La de humo no mira cómo se ve
nada, solo que la aplicación no haya mostrado su pantalla de error.

## Estructura

```
supabase/
  migrations/     esquema versionado (fuente de verdad de la BD)
  seed.sql        datos de desarrollo (nunca en producción)
  config.toml     configuración de Supabase local
src/
  app/            rutas (App Router)
  components/ui/  componentes base
  lib/
    supabase/     clientes (browser, server, proxy) y tipos
    ranking/      lógica pura del reglamento, con tests
    env.ts        variables de entorno validadas
  proxy.ts        refresca la sesión en cada request
```

## Reglas que viven en la base de datos

- Cada pareja se enfrenta una sola vez por ranking (índice único).
- Un jugador no puede estar en las dos divisiones del mismo ranking (trigger).
- Un partido solo suma en la tabla cuando está `confirmado` o `resuelto`.
- La tabla de posiciones es la vista `tabla_posiciones`; nunca se persisten puntos.
- Lectura pública de todo lo que aparece en la tabla; escritura directa solo del coordinador. Los jugadores registran y confirman a través de funciones RPC (fase 3).

## Roadmap

| Fase | Entrega                                                            | Estado    |
| ---- | ------------------------------------------------------------------ | --------- |
| 0    | Repo, esquema del ranking, RLS, tipos, CI                          | listo     |
| 1    | Ingreso con carnet + PIN, tabla pública                            | listo     |
| 2    | Coordinador: crear ranking, inscribir, sortear, generar calendario | listo     |
| 3    | Jugadores: registrar, confirmar, disputar; autoconfirmación a 72 h | listo     |
| 4    | Cierre: desempates, ascensos y descensos, exportar CSV             | en prueba |
| 5    | Torneos (eliminación, grupos + llave)                              |           |
| 6    | Marcador en vivo, offline, push                                    |           |

## Producción

1. Crear proyecto en supabase.com y enlazar: `npx supabase link --project-ref <ref>`
2. Aplicar migraciones: `npx supabase db push` (el seed NO se aplica en producción)
3. Vercel: importar el repo y definir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
4. En Supabase > Authentication > URL Configuration, poner el dominio de Vercel como Site URL
