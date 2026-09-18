# Traspaso — Sistema del club de tenis de mesa UVG

## Actualización: base de fluidez visual

Iván quiere que el diseño sea una parte central del producto: fácil, simple,
limpio y fluido. La primera pasada crea una base común sin sumar opciones ni
información a las pantallas.

- Las rutas entran con un movimiento corto de 180 ms; botones, filas y
  selectores responden al toque. Todo se desactiva con `prefers-reduced-motion`.
- La navegación inferior usa iconos consistentes de Lucide y una transición
  sutil para la sección activa. El encabezado y la barra inferior conservan
  el fondo claro con desenfoque leve al pasar contenido detrás.
- La flecha de regreso, los campos y los botones comparten la misma respuesta
  visual. No se agregaron tarjetas, menús ni texto.
- Se revisó visualmente a 390 px. Pasaron las 44 pruebas responsive en 320,
  390 y 1440 px, además de tipos, lint, formato, 55 unitarias y build.

## Actualización: eliminación simple de torneos

Esta decisión de Iván reemplaza las restricciones históricas de borrado de
torneos descritas más abajo. La app debe ser simple, limpia y conservar su
estilo visual. Eliminar un torneo se resuelve con un solo botón.

- En el detalle administrativo aparece **Eliminar torneo**, con el estilo de
  botón existente. Se quitaron el panel de peligro, la elección entre borrar
  y cancelar, el nombre de confirmación y el motivo.
- La migración `20261009000000_eliminar_torneo_simple.sql` permite al
  coordinador eliminar torneos en cualquier estado, también con resultados
  o marcadores con puntos. Borra los datos asociados en cascada y no crea
  registros en `baja`. Conserva la firma del RPC por compatibilidad.
- La acción valida la sesión de coordinador y el identificador; después de
  eliminar vuelve a la lista. Las reglas de rankings siguen como estaban.
- Pruebas: eliminación desde el navegador en los cinco estados; SQL verifica
  permisos, borrado en cascada y conservación de partidos ajenos. Las pruebas
  nuevas detectaron el formulario y la bitácora anteriores antes del cambio.
- Verificación local: 6 pruebas de navegador, 55 comprobaciones SQL, 55
  pruebas unitarias, tipos de base, lint, formato y build pasaron. Se aplicaron
  en la base remota las migraciones 20261008 (pendiente) y 20261009, sin reset.

## Actualización del 18 de septiembre de 2026: etapa 2

Esta sección prevalece sobre las anteriores para los temas de partidos.

- `misPartidos` usa una unión interna con la división. El filtro por ranking
  ya descarta partidos de otros rankings, en lugar de devolverlos con división
  nula. La consulta general de un partido conserva la unión externa para
  admitir los de torneo, que no tienen división.
- `/partidos` muestra torneos y marcadores independientemente de que exista
  un ranking activo o de que el jugador participe en él. El aviso después de
  registrar ya no toma el plazo del ranking para un partido de torneo. El
  detalle del partido usa el plazo de su propia competencia.
- Los torneos cancelados salen de la lista de pendientes. Los marcadores de
  rankings o torneos cancelados salen de la lista para retomar; los libres
  siguen disponibles. Un enlace directo al partido muestra la cancelación
  sin acciones, y el enlace al marcador redirige a ese detalle.
- La migración `20261008000000_partidos_cancelados.sql` agrega el rechazo de
  cancelaciones a `exigir_partido_jugable`, `exigir_partido_editable`,
  `reabrir_marcador` y `sincronizar_marcador`. Se partió de sus definiciones
  actuales y se comprobó que el único cambio en los cuerpos fueran las guardas.
  El comportamiento de guardar un marcador cuyo ranking cerró se conserva.
- La base LOCAL tiene ahora 25 migraciones. Se reconstruyó desde cero y se
  regeneraron y verificaron los tipos. La migración nueva no cambia firmas.
- `npm run test:partidos` ejecuta tres pruebas reales de navegador a 320 px:
  torneo sin ranking activo, registro y confirmación sin inscripción en el
  ranking, y cancelación con enlaces directos. Las tres fallaron antes del
  arreglo y pasaron después. Junto con las 13 de humo, pasaron 16 pruebas.
- `supabase/pruebas/partidos-cancelados.sql` agrega 14 comprobaciones: siete
  operaciones sobre ranking cancelado y siete sobre torneo cancelado. Exigen
  que el error mencione la cancelación. Fallaron antes de la migración y
  pasaron después; la suite completa pasó 50 comprobaciones.
- Las consultas de marcadores y de reglas del detalle ahora manejan el error
  de Supabase con `datos()`, en lugar de ocultarlo como vacío o valor por defecto.
- Cambios locales sin commit ni push; producción sigue pendiente de recibir
  la migración y la aplicación juntas. La etapa 3 cerró el bucle del PIN y la
  revisión inicial de errores de datos; queda continuar con los pendientes de
  producto en la sección 9.

## Actualización del 18 de septiembre de 2026: etapa 3

- Se reprodujo el cambio de PIN del primer ingreso con el usuario de semilla.
  El SQL sí ponía `debe_cambiar_pin = false`; el bucle venía de que la acción
  seguía usando la sesión memoizada antes del RPC y volvía a decidir con el
  valor viejo. Los jugadores ahora van directamente a `/partidos?bienvenida=1`
  después de cambiarlo. El caso está cubierto por `e2e/pin.spec.ts` y pasó en
  12 segundos.
- La revisión de lecturas corrigió consultas que descartaban errores en el
  cuadro de torneos, el conteo de partidos e inscripciones, el perfil de
  ingreso, el semestre del ranking y las exportaciones del panel. Las lecturas
  ahora usan `datos()` o devuelven un error explícito en una acción.
- `npm run test:pin` ejecuta la prueba del cambio de PIN contra la base local.

## Actualización del 18 de septiembre de 2026: etapa 4

- El coordinador puede elegir entre sorteo automático y siembra manual al
  armar un torneo. La lista manual usa botones de subir y bajar, con objetivos
  táctiles, para funcionar también en teléfono.
- La acción valida que el orden incluya una sola vez a cada inscrito. En modo
  manual manda `p_semilla = 'manual'`; la función existente guarda el orden
  completo en `torneo_sorteo.resultado` junto con quién lo ejecutó. El panel
  muestra `Siembra manual guardada.` después de armarlo.
- `e2e/torneos.spec.ts` comprueba el flujo completo y
  `npm run test:torneos` lo ejecuta contra la base local.

## Actualización del 18 de septiembre de 2026: etapa 5

- La lista de jugadores ahora ofrece `Hacer coordinador` a los jugadores
  activos que no son la sesión actual. La acción llama a la función SQL
  `asignar_rol`, que exige coordinador y mantiene la guarda del último
  coordinador activo.
- `e2e/jugadores.spec.ts` comprueba el ascenso desde el panel y deja el
  usuario de semilla como jugador al terminar. Se agregó `npm run
test:jugadores`.

## Actualización del 18 de septiembre de 2026: etapa 6

- `/admin/bajas` muestra la bitácora permanente de rankings y torneos borrados
  o cancelados: acción, tipo, estado anterior, fecha, quién lo hizo, motivo y
  resumen del contenido capturado.
- La pantalla usa la política existente de `public.baja`; además de esa
  protección, el servidor exige coordinador antes de consultar. Se agregó al
  panel principal y se corrigió el texto de exportación para no prometer una
  bitácora CSV que todavía no existe.
- `e2e/bajas.spec.ts` comprueba la lectura de un registro y que un jugador no
  pueda entrar. Se agregó `npm run test:bajas`.

## Actualización del 18 de septiembre de 2026: etapa 7

- El detalle de cada partido muestra una bitácora desplegable con la acción,
  quién la hizo, el cambio de estado, el marcador cuando existe y la hora en
  Guatemala. La consulta usa la política existente de `partido_evento`, así
  que solo la ven los dos jugadores y el coordinador.
- `e2e/eventos.spec.ts` comprueba el flujo con un partido y un evento
  temporales. Se agregó `npm run test:eventos` y su fila en el README.

Al ejecutar `next dev`, Next.js generó `AGENTS.md` y `CLAUDE.md` en el repo.
El código que los genera está en
`node_modules/next/dist/server/lib/generate-agent-files.js`.

---

## Actualización del 18 de septiembre de 2026: etapa 1

Esta actualización prevalece sobre el estado histórico descrito más abajo.

- El commit `a896be1` ya está en `origin/main`, comprobado contra GitHub.
- La base local tenía 21 migraciones. Se respaldó antes de reconstruirla con
  `npm run db:reset`: ahora tiene las 24 migraciones y la semilla. El respaldo
  está fuera del repo, en `../respaldos-locales/antes-etapa1-20260918.dump`.
- Los tipos se regeneraron desde esa base completa. Faltaba la tabla `baja`
  en el parche anterior; ahora está incluida.
- `db:types` usa `scripts/tipos-db.mjs`: comprueba las migraciones locales y
  solo reemplaza el archivo después de generar una salida válida. Una base
  atrasada o un error de CLI conserva intacto el archivo anterior.
- `db:types:check` compara sin escribir. El job `migraciones` de CI ejecuta
  la misma comprobación después del reset. Supabase CLI está fijado en 2.117.0
  en el proyecto y en el workflow. Se ignoran únicamente diferencias CRLF/LF.
- `npm run verify` incluye ahora `format:check`, igual que el job `verify`.
- Verificación local: tipos, lint, formato, 55 pruebas unitarias, build y
  36 comprobaciones SQL pasaron. Las dos suites SQL que fallaban antes del
  reset (`bajas` y `divisiones`) pasaron después.
- El control de tipos falló con el archivo del commit anterior y pasó con el
  regenerado. Se comprobó también sin `node_modules`, usando la CLI global,
  como el job de CI. Con la base atrasada y con una CLI que falla se verificó
  que el archivo de tipos conserva exactamente su contenido.
- El primer intento de build durante la revisión falló al resolver un módulo
  interno de Next que sí existía. Los dos intentos posteriores pasaron sin
  cambios en Next; la causa no quedó confirmada. No se atribuyó a un arreglo.
- Estos cambios de la etapa 1 quedan locales, sin commit ni push. El workflow
  nuevo todavía no se ejecutó en GitHub. No se modificó producción.

Siguiente etapa acordada: corregir la consulta que mezcla partidos de rankings
distintos y separar los torneos del ranking en la pantalla de partidos. La
revisión reprodujo que un filtro por ranking inexistente devolvía tres partidos
del jugador de prueba; usando una unión interna devolvió cero. El código de
esas funciones todavía no se modificó.

Otra corrección al traspaso histórico: `asignar_rol` ya existe desde la
migración `20260925000000`, incluida la protección del último coordinador
activo. Para promover jugadores existentes hay que aprovechar esa función
desde la interfaz, no crear otra equivalente.

---

Documento para el agente que continúa. Lo escribió el agente anterior el 18 de septiembre de 2026, con el repo delante. Todo lo que dice acá está verificado contra el código, no recordado.

Si vas a leer una sola sección antes de tocar nada, que sea **§4 (cómo se verifica acá)**. Es la regla que hace que este proyecto no se rompa.

---

## 1. Qué es esto y para quién

Iván (estudiante de ciencias de la computación en la Universidad del Valle de Guatemala) está construyendo el sistema digital del club de tenis de mesa de su universidad. El club acaba de anunciar un ranking con dos divisiones jugado como liga, y él propuso centralizarlo todo en una aplicación.

El sistema cubre tres cosas:

1. **Ranking por divisiones.** Dos divisiones, Mayor y Menor. Round robin dentro de cada una: todos contra todos. Dos rankings por semestre. Al cerrar uno, los primeros de Menor ascienden y los últimos de Mayor descienden, y de ahí nace el siguiente.
2. **Torneos.** Llave directa o grupos + llave. Con BYE cuando el número no es potencia de dos.
3. **Marcador en vivo.** Se puede llevar punto por punto desde el teléfono, o no usarlo y anotar el resultado a mano. Registrar el marcador nunca es obligatorio.

**Esto no es un proyecto de clase. Va a correr en producción con gente real.** Iván lo repite y tiene razón: el ranking real arranca alrededor del 1 de octubre de 2026, con unas 25 personas, casi todas desde el teléfono.

Sus requisitos permanentes, en sus palabras:

> "que no tenga ningún problema de entrada, que se pueda visualizar de manera correcta en cualquier dispositivo y que funcione con un tiempo de respuesta razonable"

> "vamos a tener que documentar todo"

> "vamos con partes, como con todo" — quiere avanzar por partes, no de un solo golpe

> "no te inventes cosas, pregunta antes de"

---

## 2. Cómo trabajar con él

Esto importa tanto como el código.

### Regla de oro de producto

La aplicación debe ser fácil y tener solo las opciones necesarias. Menos
opciones significa menos saturación. Si Iván pide una acción simple, como
eliminar un torneo, la interfaz debe hacer esa acción directamente. Para esas
acciones no se agregan bitácoras, confirmaciones especiales ni pasos extra por
costumbre o por miedo, salvo que Iván los pida explícitamente o sean
indispensables para que la aplicación funcione.

- **Habla en español de Guatemala, voseo, directo y sin rodeos.** Nada de "¡Excelente pregunta!". Sin guiones largos (—) en el texto; él los pidió fuera explícitamente.
- **Quiere opiniones honestas, no validación.** Si algo que propone está mal, hay que decírselo y explicar por qué.
- **Preguntá antes de decidir algo que no te dijo.** Para decisiones con más de una salida razonable, preguntale. Le gusta que se le pregunte con opciones concretas, "en una ventanita".
- **Verificá vos, no le pidas que verifique él.** Esta es la corrección más importante que te va a ahorrar tiempo. Su frase textual:

  > "y porque no lo verificas tu? yo te estoy diciendo lo que vi"

  Si podés abrir la base, correr la consulta, leer el log o reproducir el caso, hacelo. Él reporta lo que ve desde su teléfono; el trabajo de confirmar de dónde viene es tuyo.

- **Los comentarios del código están en español** y explican _por qué_, no _qué_. Varios cuentan el error concreto que motivó la línea. Seguí ese estilo: es lo que hace que el código se entienda meses después.
- **Los mensajes de commit también van en español**, con cuerpo que explica el razonamiento.

---

## 3. Stack, entorno y las restricciones que te van a morder

### Stack

| Pieza      | Versión / detalle                                           |
| ---------- | ----------------------------------------------------------- |
| Next.js    | 16.3.5, App Router, Turbopack, `typedRoutes: true`          |
| React      | 19.2.8                                                      |
| TypeScript | 5.x, strict                                                 |
| Tailwind   | 4, con componentes estilo shadcn/ui en `src/components/ui/` |
| Supabase   | Postgres 17, Auth, RLS, Realtime                            |
| Zod        | 4.6.5 (validación de formularios y de env)                  |
| Vitest     | 5.0 (unitarios)                                             |
| Playwright | 1.63 (humo y responsive)                                    |
| Despliegue | Vercel + Supabase, planes gratuitos                         |

`typedRoutes` está encendido: un `href` construido con template literal necesita `as Route`. Es la causa más común de que falle `typecheck` en un cambio de UI.

### Restricciones del entorno (esto es lo que te va a morder)

1. **Iván trabaja en Windows.** Su `node_modules` es nativo de Windows. Si el agente corre en un VM Linux con la carpeta montada, `next build` y `next typegen` **no corren desde ahí**: el binario de SWC revienta. Solo funcionan herramientas de JS puro (prettier, eslint, tsc). Para compilar de verdad hay que hacerlo en un contenedor propio con su propio `npm install`, o pedirle a él que lo corra.

2. **Las pruebas SQL necesitan Docker.** `npm run test:sql` usa el `psql` que vive dentro del contenedor de Postgres de Supabase. Si tu entorno no tiene Docker, no podés correr `supabase start` ni `npm run db:types`. La salida que usó el agente anterior fue levantar un **Postgres local suelto** y aplicar las migraciones a mano con un archivo de andamio que finge el esquema `auth` (ver §4).

3. **`npm run db:types` reescribe un archivo versionado.** Sin la base local con TODAS las migraciones aplicadas, genera basura o un archivo vacío. **Nunca lo corras sin Docker.** Esto ya rompió CI dos veces (§7).

### Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL          # pública
NEXT_PUBLIC_SUPABASE_ANON_KEY     # pública, mínimo 20 caracteres (lo valida zod)
SUPABASE_SERVICE_ROLE_KEY         # SOLO servidor, nunca con prefijo NEXT_PUBLIC_
```

`src/lib/env.ts` las valida con zod al arrancar. La service role key se usa para crear cuentas de jugadores desde el panel del coordinador.

Cuidado con una trampa de Windows: `process.env.X ?? "default"` **no** cae al default cuando la variable está puesta en cadena vacía, y `setx VAR ""` deja exactamente eso. Usá `(process.env.X ?? "").trim() || "default"`.

---

## 4. Cómo se verifica acá (la regla que no se rompe)

**Toda comprobación tiene que fallar contra una base sin el arreglo y pasar con el arreglo.** Las dos direcciones, siempre. Una prueba que solo se corrió en verde no prueba nada.

Esto no es teoría. Pasó de verdad: un archivo de `supabase/pruebas/` estuvo dando verde contra una base con el agujero abierto, porque el `raise` que declaraba el fallo estaba dentro del bloque que atrapaba excepciones y se atrapaba a sí mismo. Y en otra ocasión un caso pasaba porque la preparación de la prueba dejaba una división vacía y el `when others` se tragaba el error real en vez del que se buscaba.

Por eso las pruebas nuevas usan un ayudante que **exige que el mensaje de error contenga cierto texto**, no solo que falle:

```sql
create or replace function pg_temp.exige_error(p_sql text, p_texto text, p_que text)
returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if p_texto <> '' and position(lower(p_texto) in lower(v_msg)) = 0 then
      raise exception 'MAL: falló por otra razón (%), se esperaba algo sobre "%" · %', v_msg, p_texto, p_que;
    end if;
    return;
  end;
  raise exception 'AGUJERO: no falló y debía fallar: %', p_que;
end; $$;
```

Está en `supabase/pruebas/bajas.sql`. Copialo para pruebas nuevas.

### Cómo probar SQL sin Docker

El agente anterior armó esto y funciona. Postgres 16 local, más un archivo de andamio `stub.sql` que crea lo que Supabase da por hecho:

- el esquema `auth` con la tabla `auth.users`
- `auth.uid()` leyendo `current_setting('request.jwt.claim.sub')`
- los roles `anon` y `authenticated`

Después se aplican las migraciones en orden y `supabase/seed.sql`. Para probar "sin el arreglo" se salta la migración en cuestión, o se aplica una variante con el guarda desactivado. Ejemplo real usado para validar `bajas.sql`: se generaron tres bases rotas a propósito (sin las migraciones nuevas; sin el guarda del marcador; con `baja.objeto_id` como llave foránea con cascade) y se confirmó que cada una hace fallar la comprobación correspondiente.

Detalle que cuesta encontrar: `set local role` y `set_config(..., true)` **solo funcionan dentro de un bloque de transacción explícito**.

### Comandos

| Comando                   | Qué hace                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `npm run verify`          | typecheck + lint + tests + build. Lo mismo que corre CI     |
| `npm run typecheck`       | `next typegen && tsc --noEmit`                              |
| `npm run lint`            | eslint                                                      |
| `npm run format:check`    | prettier                                                    |
| `npm test`                | vitest, 55 pruebas unitarias                                |
| `npm run test:sql`        | las comprobaciones de `supabase/pruebas/` (necesita Docker) |
| `npm run test:humo`       | 13 pruebas de navegador: que cada pantalla cargue           |
| `npm run test:responsive` | auditoría de layout en tres anchos                          |
| `npm run db:reset`        | recrea la base local con migraciones + semilla              |
| `npm run db:types`        | regenera `database.types.ts` (necesita Docker)              |

Usuarios de la semilla, PIN `123456` para todos: `20001` coordinador, `20002` jugador de Mayor, `20005` jugador de Menor.

### Por qué existe `test:humo`

Vale la pena entenderlo. La auditoría de responsive mide layout, y **la pantalla de error de la aplicación tiene un layout impecable**. Con eso, `/admin/jugadores` estuvo reventando con "permission denied" durante varias migraciones y ninguna corrida lo dijo. La prueba de humo no mira cómo se ve nada: solo que la aplicación no haya mostrado su pantalla de error. Los componentes de error emiten `data-uvgtt-error="1"` y la prueba lo busca.

Un detalle sutil ahí: hay que buscarlo con `page.evaluate` y `document.querySelector`, **no** con `page.locator`. Los selectores de Playwright atraviesan el shadow DOM por defecto, y el overlay de desarrollo de Next trae dentro del suyo un `<div data-error="false">` que produce falsos positivos.

---

## 5. Invariantes del sistema

Estas son las reglas que el diseño da por ciertas. Romperlas abre agujeros.

### 5.1 PostgREST expone todo lo que RLS y los GRANTs permitan

La interfaz de usuario **no es una defensa**. Cualquiera con la anon key puede pegarle directo a PostgREST. Si una tabla tiene `grant insert` a `authenticated` y una política permisiva, cualquier jugador puede escribir ahí desde la consola del navegador, aunque en la pantalla no haya ningún botón.

Corolario práctico: **antes de dar por segura una operación, mirá el `grant`, no solo la política.** Ejemplo real: `ranking` y `torneo` tienen política `for all` para coordinador, pero el grant a `authenticated` es solo `select`. Por eso, hasta la migración 24, borrar un ranking era literalmente imposible desde la aplicación.

### 5.2 Toda transición de estado pasa por una función SQL `security definer`

Nada de cambiar estados con un `update` desde el cliente. Las funciones validan el estado de origen, el rol y las reglas del reglamento, y al final hacen el cambio. El patrón es siempre:

```sql
create or replace function public.lo_que_sea(...)
returns ...
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_coordinador();   -- o la comprobación que toque
  ...
end; $$;
```

Y al final del archivo, siempre:

```sql
grant execute on function public.lo_que_sea(...) to authenticated;
revoke execute on function public.lo_que_sea(...) from public, anon;
```

`set search_path = public` no es decorativo: sin él, una función `security definer` es un vector de escalada de privilegios.

### 5.3 Identidad

- Se entra con **carnet + PIN de 6 dígitos**. No hay correo de verdad.
- Internamente se usa un correo sintético: `{carnet}@uvgtt.local`.
- El registro abierto está deshabilitado. Las cuentas las crea el coordinador.
- `usuario.id` **es** `auth.users.id`, o sea `auth.uid()`. Todo el modelo de permisos depende de eso.
- Todo perfil nace como `jugador`. El primer coordinador se nombra a mano en la base.
- Todos nacen con `debe_cambiar_pin = true`.

### 5.4 Reglas del juego que ya están codificadas

- Cada pareja se enfrenta **una sola vez por ranking y por tipo** (índice único sobre `division_id, jugador_a, jugador_b, tipo`). Puede haber un regular y un desempate.
- Los jugadores de un partido se guardan en orden canónico `jugador_a < jugador_b`, para que el índice único detecte `(a,b)` y `(b,a)` como el mismo partido.
- Un jugador no puede estar en las dos divisiones del mismo ranking (lo valida un trigger).
- `ranking.numero` solo puede ser 1 o 2, único por semestre.
- Los sorteos guardan su **semilla** con el objeto. Con ella cualquiera puede rehacer el sorteo y comprobar que no se acomodó a nadie. Es deliberado y hay que mantenerlo.
- El retiro de un jugador a mitad de ranking **anula todos sus partidos**, jugados y pendientes, aunque eso baje puntos de otros. El razonamiento: no alcanzó a jugar contra todos, así que los puntos que repartió son desiguales. El coordinador ve antes cuántos partidos se anulan y quiénes pierden puntos, y puede cancelar.

### 5.5 Errores de datos

Ninguna consulta debe ignorar el campo `error` de Supabase. Hubo un momento en que ninguna lo revisaba, y una caída de la base se veía idéntica a una tabla vacía ("todavía no hay jugadores inscritos"). Ahora todo pasa por `datos()` en `src/lib/supabase/errores.ts`, que lanza `ErrorDeDatos` y lo recoge el error boundary. **Usá `datos()` siempre.**

---

## 6. Mapa del repo

```
src/
  app/
    (auth)/ingresar, (auth)/cambiar-pin
    page.tsx                    portada pública: ranking vigente, franja de torneo
    partidos/                   lo mío: pendientes, por confirmar, marcadores abiertos
    partidos/[id]/              un partido: registrar resultado o abrir marcador en vivo
    rankings/, rankings/[id]    historial y tabla + calendario
    jugador/[carnet]/           perfil público
    torneos/[id]/               cuadro público del torneo
    marcador/[id]/              marcador en vivo
    marcador/nuevo/             marcador libre, sin partido detrás
    reglas/                     números tomados del ranking en curso, no escritos a mano
    admin/
      page.tsx                  panel
      gestion.tsx               envoltorio común de las pantallas del panel
      ranking/                  crear semestre, crear ranking, divisiones, calendario, cierre
      torneos/, torneos/[id]/   crear, inscribir, armar cuadro, cerrar
      jugadores/                alta individual, alta masiva por lote, retiro, mensaje al grupo
      partidos/                 resolver disputas, anular
      bajas.tsx                 zona de peligro: borrar / cancelar (compartida)
      bajas-acciones.ts
      exportar/route.ts         exportación
  lib/
    auth/                       carnet, pin, sesión, guarda de coordinador
    supabase/                   cliente, servidor, admin, proxy, tipos, errores
    ranking/                    consultas, sorteo, tabla de posiciones
    torneos/                    consultas, sorteo (siembra y byes)
    partidos/consultas.ts
    jugadores/                  consultas, lote (parser del pegado de Excel)
    fechas.ts, env.ts
  components/                   ui/ + compartidos (fila, aviso, pestañas, tope, sin-red)

supabase/
  migrations/    24 archivos, en orden cronológico
  pruebas/       10 archivos de comprobaciones SQL
  seed.sql

e2e/             humo, responsive, auditoría, identidad (Playwright)
scripts/pruebas-sql.mjs
docs/despliegue.md
.github/workflows/ci.yml
```

Los archivos con pruebas unitarias: `auth/carnet`, `fechas`, `ranking/sorteo`, `ranking/tabla`, `torneos/sorteo`, `jugadores/lote`. 55 pruebas en total.

### Las 24 migraciones

```
20260914 nucleo_ranking            tablas base, enums, RLS, es_coordinador()
20260915 fase2_armar_ranking       crear_ranking, armar_divisiones, generar_calendario, abrir_ranking
20260916 fase3_partidos            registrar/confirmar/disputar/resolver resultado
20260917 fase3b_sets_obligatorios  sets obligatorios, anular_partido
20260918 fase4_cierre              cerrar_fase_regular, generar_desempates, cerrar_ranking, crear_ranking_siguiente
20260919 retiro_y_cron             retiro de un jugador, autoconfirmación con pg_cron
20260920 perfiles                  historial_jugador, mi_perfil
20260921 torneos_cimientos         tablas de torneo, ranking_de_partido
20260922 marcador                  marcador en vivo, sincronizar_marcador
20260923 contenedor_y_mensajes
20260924 torneos_funciones         crear/inscribir/armar/cerrar torneo, orden_siembra, construir_llave
20260925 permisos_y_guardas        cambiar_mi_pin, grants por columna sobre usuario
20260926 reglas_y_cierres
20260927 orden_y_retiro
20260928 desempate_final           desempate_manual
20260929 marcador_y_resultado
20260930 quitar_overload_crear_ranking
20261001 crear_ranking_completo    repara dos cosas que perdió la migración 27
20261002 origen_nuevo              enum 'nuevo', ranking.anterior_id
20261003 sin_sorteo_heredado
20261004 lista_de_jugadores        jugadores_del_club()
20261005 reparar_divisiones        rankings que nacieron sin divisiones + auto reparación
20261006 estado_cancelado          agrega 'cancelado' a los dos enums de estado
20261007 borrar_y_cancelar         eliminar/cancelar ranking y torneo, tabla baja
```

---

## 7. Errores caros que ya se cometieron (no los repitas)

Esta sección vale más que cualquier otra. Todos pasaron de verdad en este proyecto.

**1. Regenerar `database.types.ts` sin la base local completa.** Rompió CI **tres** veces. `db:types` corre con `--local`: si la base local no tiene aplicadas todas las migraciones, la regeneración **borra** tipos en vez de agregarlos. Siempre `npm run db:reset` antes. Una vez el agente corrió `npm run db:types` sin Docker y escribió un mensaje de error JSON dentro del archivo de tipos. Otra vez el agente parchó el archivo a mano, Iván lo regeneró, y el parche se perdió. **Regla: el archivo regenerado por él manda siempre.** Si hay que parchar a mano por falta de Docker, se avisa explícitamente y se le pide que lo regenere y lo commitee.

**2. Commitear el código pero no los tipos.** El fallo de CI más reciente fue exactamente esto: se agregó una pantalla que llama `supabase.rpc("jugadores_del_club")`, se regeneró `database.types.ts`, y el archivo quedó sin commitear. GitHub compiló la versión vieja de los tipos, donde esa función no existe, y `typecheck` murió con un mensaje que no decía nada. **Antes de dar por resuelto un fallo de CI, corré `git status` y mirá si lo que falla está commiteado.**

**3. Reescribir una función SQL entera en vez de extenderla.** La migración 27 reescribió `crear_ranking` de cero para agregarle los sets, y en el camino perdió dos cosas: el `insert` que crea las divisiones, y el guarda de "ya hay un ranking en curso". Lo primero producía rankings rotos que fallaban después, al armar divisiones, con un error incomprensible (`null value in column division_id`). Lo segundo permitía crear dos rankings abiertos a la vez. **Cuando toques una función existente, partí de su cuerpo actual y comparalo línea por línea.**

**4. Dos overloads de la misma función.** Dejar `crear_ranking` con 10 y con 12 parámetros hizo que PostgREST devolviera **300 Multiple Choices**. Si cambiás la firma de una función, hay que hacer `drop` de la anterior.

**5. Confiar en `partido.estado` como única señal de actividad.** Un marcador en vivo con puntos anotados es gente jugando ahorita, aunque el partido siga `pendiente`. Cualquier guarda de "todavía no ha pasado nada" tiene que mirar las dos cosas.

**6. Poner una llave foránea en una tabla de bitácora.** Si `baja.objeto_id` fuera una FK con cascade, borrar el ranking borraría el registro de que se borró. Una bitácora no es una relación.

**7. Correr prettier sobre todo el repo sin `.prettierignore` al día.** Reformateó 73 archivos de `.claude/` y destrozó un `prototipo.html`. Hay tres entradas en `.prettierignore` que existen por eso.

**8. Decir "reproducido" sin haber reproducido.** Le pasó al agente anterior con un cuadro de 5 jugadores: afirmó que estaba mal y resultó que estaba bien (5 jugadores, 3 byes, el sembrado 1 esperando). Corregirse solo es mejor que sostenerlo, pero es mejor no afirmarlo antes de comprobarlo.

**9. Proponer una solución sobre una premisa falsa.** Se llegó a diseñar un flujo completo para un caso del marcador que resultó imposible, porque `sincronizar_marcador` ya rechazaba ese estado. Antes de diseñar alrededor de un caso, comprobá que el caso puede ocurrir.

**10. Decirle "borralo y rehacelo" sin darle cómo borrarlo.** Le pasó con un ranking roto, cuando borrar no existía. Con razón lo rechazó. Si la salida que proponés requiere una capacidad que el sistema no tiene, la capacidad es parte del trabajo.

---

## 8. Estado del despliegue

- **Repo:** GitHub, handle `moonshin3z`. Rama `main`.
- **CI:** dos jobs. `verify` (typecheck, lint, format:check, test, build) y `migraciones` (levanta Supabase, aplica todo y corre `scripts/pruebas-sql.mjs`).
- **Supabase:** proyecto en la nube ya creado y con las migraciones aplicadas. Postgres 17.
- **Vercel:** conectado al repo, con las variables puestas. Hubo un momento con **dos proyectos de Vercel desplegando el mismo repo**; ya se borró el sobrante. Si ves despliegues duplicados, revisá eso primero.
- **Pendiente de despliegue:** habilitar `pg_cron` también en el proyecto de producción (la autoconfirmación de resultados depende de eso).

Al momento de escribir esto, en la carpeta de Iván hay dos commits que **todavía no están en GitHub**:

```
df8b16a  Borrar y cancelar rankings y torneos
1dbf691  Los tipos de jugadores_del_club, que se quedaron sin subir
```

Lo primero que hay que hacer es que él corra:

```
npx supabase db push        # sube las migraciones a la NUBE
npm run db:reset            # aplica las migraciones en la base LOCAL (Docker)
npm run db:types            # lee la LOCAL; sin el paso anterior borra tipos
git add -A && git commit -m "Tipos regenerados"
git push origin main
```

**El `db:reset` del medio no es opcional.** `db:types` corre con `--local`: lee
la base local, no la de la nube. Saltárselo hace que la regeneración _quite_
del archivo de tipos las funciones que la base local todavía no tiene, en vez
de agregarlas. Pasó exactamente así el 18 de septiembre: un commit llamado
"Tipos regenerados" borró 39 líneas y CI murió en `typecheck` sin decir por
qué.

El `db:types` importa: los tipos de las funciones nuevas (`eliminar_ranking`, `cancelar_ranking`, `eliminar_torneo`, `cancelar_torneo`, `contenido_del_ranking`, `contenido_del_torneo`) y los valores `cancelado` de los enums están **parchados a mano** porque el agente anterior no tenía Docker. La regeneración de él es la autoridad.

---

## 9. Lo que falta, en orden

### A. Pedido explícito por Iván, sin empezar

**A.1 — Arrastrar jugadores para sembrar el cuadro de un torneo. Resuelto en etapa 4.**
Pedido textual: _"la opción cuando se hacen torneo que el coordinador pueda arrastrar jugadores para posicionarlo"_.

`armar_torneo(p_torneo_id uuid, p_semilla text, p_orden uuid[], p_cant_grupos smallint)` ya recibía el orden de siembra como arreglo. Ahora `src/app/admin/torneos/formularios.tsx` permite ordenarlo con botones y `src/app/admin/torneos/acciones.ts` manda el orden completo con la marca `manual`.

Consideraciones:

- Tiene que funcionar con el dedo en un teléfono, no solo con mouse. Se resolvió con botones de subir y bajar, que también son accesibles con teclado.
- `torneo_inscripcion.siembra` ya existe (smallint, único por torneo cuando no es null) y `armar_torneo` la escribe.
- Cuando el coordinador siembra a mano se guarda `semilla = 'manual'` y el orden queda en `torneo_sorteo.resultado`; el panel muestra que fue una siembra manual.

**A.2 — Botón de "hacer coordinador" a un jugador existente. Resuelto en etapa 5.**
`/admin/jugadores` llama a la función SQL `asignar_rol`, que ya existía como `security definer`, exige un coordinador y evita dejar al club sin ningún coordinador activo.

### B. Bugs reportados sin cerrar

**B.1 — El cambio de PIN se repite en bucle. Resuelto en etapa 3.**
Reporte: _"cuando hice un usuario llamado prueba 3 y lo puse como coordinador, la pantalla que le pedía el pin se repetía constantemente a pesar de ponerlo"_.

Lo que ya se descartó, verificado contra la base: `cambiar_mi_pin` es `security definer`, cambia el PIN y pone `debe_cambiar_pin = false` correctamente. La causa era que la acción usaba la sesión memoizada antes del RPC y decidía el destino con el valor viejo. Ahora redirige directamente a `/partidos?bienvenida=1` después de cambiarlo, y `e2e/pin.spec.ts` cubre el caso.

**B.2 — Confirmar en un teléfono real que el marcador en vivo de torneos funciona.**
Él reportó que no había marcador en vivo para torneos. La causa era que **los torneos eran de solo lectura para los jugadores**: `misPartidos` filtraba por `division.ranking_id` y `partidoPorId` usaba `division!inner`, así que un partido de torneo (que no cuelga de ninguna división) desaparecía. Ya está arreglado: existe `misPartidosDeTorneo`, los partidos de torneo aparecen en `/partidos` con su rótulo, y `/partidos/[id]` ofrece "Llevar el marcador en vivo". **Falta que él lo confirme desde el teléfono**, porque el reporte original es anterior al arreglo.

### C. Mejoras de infraestructura

**C.1 — Un paso de CI que detecte tipos desactualizados.** El fallo del punto 7.2 volvería a pasar. La idea: regenerar `database.types.ts` en CI contra la base recién migrada y fallar si difiere del versionado. El job `migraciones` ya levanta Supabase, así que el paso cabe ahí. Esto lo tenía propuesto el agente anterior y Iván no alcanzó a decidirlo.

**C.2 — Pantalla que muestre la bitácora de bajas. Resuelto en etapa 6.** `/admin/bajas` muestra qué se borró o canceló, quién, cuándo, por qué y qué había adentro.

**C.3 — Detalle de un partido con su bitácora.** Resuelto en etapa 7. El detalle de cada partido muestra una bitácora desplegable con la acción, quién la hizo, el cambio de estado, el marcador cuando existe y la hora en Guatemala. La consulta respeta la política existente: solo la ven los dos jugadores y el coordinador. `e2e/eventos.spec.ts` comprueba el flujo con un registro temporal y `npm run test:eventos` lo ejecuta contra la base local.

### D. Diseño

Lo revisa él. Pendientes: paleta y tipografía definitivas, estados vacíos con más carácter, revisión en pantallas chicas reales.

### E. Reglamento todavía abierto con el club

Estas no son decisiones técnicas: **son preguntas que Iván tiene que hacerle al club.** No las inventes.

- Cuántos sets se juegan (2 de 3, o 3 de 5). El sistema lo soporta configurable por ranking, pero nadie confirmó el número real.
- Puntos para el fondo de la tabla.
- Qué pasa con un jugador que se suma a mitad de ranking (el retiro ya está resuelto, el alta no).
- Qué pasa si una división queda con menos de 6 jugadores o desbalanceada.

---

## 10. Lo último que se hizo, con detalle

Por si el agente que sigue necesita entender el estado más reciente.

**Borrar y cancelar rankings y torneos** (migraciones 20261006 y 20261007, commit `df8b16a`).

El problema: un ranking o torneo creado por equivocación no tenía salida. No estaba escondida, no existía. Ninguna función los borraba y el grant a `authenticated` sobre esas tablas es solo `select`. La única forma era el SQL editor de Supabase con el service role.

Iván eligió el alcance con dos preguntas explícitas. Quedó así:

|              | Cuándo                                                                                                                                 | Qué hace                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **borrar**   | Ranking en `borrador` o `abierto`; torneo en `borrador`, `inscripcion` o `en_juego`. En ambos, **solo si nadie registró un resultado** | Desaparece la fila y todo lo que cuelga por `on delete cascade`  |
| **cancelar** | Cualquier estado salvo `cerrado`                                                                                                       | Estado `cancelado`, sale de todas las vistas. Motivo obligatorio |

Decisiones del diseño:

- "Sin resultados" mira `partido.estado` **y** marcadores en vivo con puntos, retiros registrados, y que ningún otro ranking herede de este.
- La bitácora `public.baja` no tiene FK al objeto, a propósito.
- Para borrar hay que escribir el nombre completo. Se comprueba en el cliente (para habilitar el botón) y **otra vez en el servidor**, porque el formulario se puede mandar sin pasar por la pantalla.
- Se restauró el guarda de "ya hay un ranking en curso" perdido por la migración 27. Un ranking `cancelado` no bloquea.

Verificación: `supabase/pruebas/bajas.sql`, 10 comprobaciones, corridas contra tres bases rotas a propósito para confirmar que fallan cuando deben. `typecheck`, `lint`, `format:check`, 55 pruebas unitarias y `build`: todo en verde.

Lo que cambió en la aplicación: `src/app/admin/bajas.tsx` y `bajas-acciones.ts` (nuevos, compartidos), más ajustes en `admin/ranking/page.tsx`, `admin/torneos/page.tsx`, `admin/torneos/[id]/page.tsx`, `admin/jugadores/page.tsx` y `lib/ranking/consultas.ts` para que un ranking `cancelado` no cuente como vigente, no salga en el historial del jugador y no bloquee la creación del siguiente.

---

## 11. Documentos del proyecto

Iván tiene doce documentos en su Project de Claude que cubren el diseño desde el principio. Si podés leerlos, valen la pena; si no, lo esencial está acá arriba.

```
claude/modelo-del-problema-v1.md
claude/reglamento-ranking-y-modelo-v2.md
claude/modelo-de-datos-er.md
claude/stack-y-plataforma.md
claude/modelo-de-confianza-y-permisos.md
claude/pantallas-por-rol.md
claude/roadmap-y-fase-0.md
claude/fase-4-cierre.md
claude/estado-y-plan.md
claude/auditoria-seguridad-e-invariantes.md
claude/diseno-audit-y-direcciones.md
claude/pendientes-y-mejoras.md
```

El más útil para retomar es `pendientes-y-mejoras.md`, que está al día hasta el 18 de septiembre de 2026.

En el repo: `README.md` (arranque, comandos, estructura) y `docs/despliegue.md`.
