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
npm run dev               # http://localhost:3000
```

Studio local: http://127.0.0.1:54323

Usuarios del seed (PIN `123456` para todos):

| Carnet | Rol         | División |
| ------ | ----------- | -------- |
| 20001  | coordinador | mayor    |
| 20002  | jugador     | mayor    |
| 20005  | jugador     | menor    |

## Comandos

| Comando                     | Qué hace                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `npm run verify`            | typecheck + lint + tests + build (lo mismo que corre CI)     |
| `npm test`                  | tests unitarios (vitest)                                     |
| `npm run db:reset`          | recrea la BD local con migraciones + seed                    |
| `npm run db:types`          | regenera `src/lib/supabase/database.types.ts` (ver aviso)    |
| `npm run db:diff -- nombre` | genera una migración a partir de cambios hechos en Studio    |
| `npm run test:sql`          | las comprobaciones de `supabase/pruebas/` contra la BD local |
| `npm run test:humo`         | que cada pantalla cargue, con y sin sesión (navegador)       |
| `npm run test:responsive`   | auditoría de layout en tres anchos (navegador)               |

**Aviso sobre `db:types`.** Lee la base **local**, no la de la nube. Si acabás
de escribir una migración, primero hay que aplicarla en local:

```bash
npm run db:reset      # aplica TODAS las migraciones + semilla en la base local
npm run db:types      # recién ahora los tipos salen completos
```

Correrlo al revés, o correrlo después de un `supabase db push` (que sube a la
nube y no toca la local), **borra** del archivo de tipos las funciones que la
base local todavía no tiene. El código deja de compilar y el error no dice de
dónde viene. Ya pasó dos veces.

Los dos últimos necesitan la base local con la semilla (`npm run db:reset`) y
levantan el servidor de desarrollo solos. `test:humo` no escribe nada, así que
se puede repetir sin volver a sembrar.

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
