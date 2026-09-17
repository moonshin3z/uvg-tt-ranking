# Que se vea bien en cualquier pantalla

No es una promesa, es una prueba que corre y falla sola. `npm run test:responsive`
abre cada pantalla en siete tamaños distintos y revisa cinco cosas en el DOM ya
renderizado, que es la única forma de saber de verdad si algo se sale.

## Cómo correrla

```
npx playwright install chromium   # una sola vez
npm run dev                       # queda en el puerto 3100
npm run test:responsive           # en otra terminal
```

No hace falta exportar nada. **La aplicación corre en el 3100 y la auditoría
apunta ahí sola.** El puerto no es el 3000 a propósito: en la máquina donde se
desarrolla, el 3000 lo ocupa otro proyecto, y cuando eso pasaba la auditoría
medía esa otra aplicación y reportaba sus defectos como si fueran de acá.
Cuatro corridas se perdieron así.

La primera prueba de la suite comprueba que la URL sirve esta app buscando
`<html data-app="uvgtt">`, que pone `layout.tsx`. No mira el título: mientras
una página redirige, el navegador lo reemplaza por `Loading http://...` y la
guarda terminaba acusando de impostora a la app correcta.
`e2e/identidad.spec.ts` deja ese error clavado con dos páginas de prueba.

Las credenciales de las pantallas con sesión salen de `supabase/seed.sql` por
omisión (20002 y 20001, PIN 123456), así que tampoco hay que exportarlas. Antes,
si uno se olvidaba, las 15 pruebas con sesión se saltaban en silencio y la
corrida decía "4 passed" como si todo estuviera bien. Se pueden cambiar con
`E2E_CARNET`, `E2E_PIN`, `E2E_CARNET_COORD` y `E2E_PIN_COORD`, y la URL con
`E2E_URL`.

## Los tres tamaños

| Ancho | Qué es                                           | Por qué está                                                                                                                                                                                   |
| ----- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320   | iPhone SE de primera generación, Android baratos | El piso real. En el club va a haber teléfonos viejos, y quien tenga uno no va a reportar que la app no le sirve: va a dejar de usarla. Es el único ancho donde aparecieron defectos de verdad. |
| 390   | El teléfono de casi todos                        | Lo que va a ver la mayoría.                                                                                                                                                                    |
| 1440  | Laptop                                           | El coordinador arma el ranking y resuelve disputas desde una computadora, no desde el celular.                                                                                                 |

Antes eran siete: 320, 360, 390, 430, 768, 1024 y 1440. Se bajaron a tres porque
entre 320 y 430 casi nunca se rompe algo en un ancho y no en los otros, y los
cuatro sobrantes le costaban unos tres minutos a cada corrida sin encontrar nada
que 320 no hubiera encontrado antes. La corrida pasó de unas 94 pruebas a unas 42.

Si algún día aparece un defecto que solo se ve en un ancho intermedio, se agrega
ese ancho con el defecto anotado al lado. Así la lista crece por una razón y no
por precaución.

## Las cinco reglas que se revisan

| Regla                   | Qué falla                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sin-scroll-horizontal` | La página entera se puede desplazar a los lados. Casi siempre es un ancho fijo en px que alguien dejó.                                                                                       |
| `nada-se-sale`          | Un elemento llega más a la derecha que el borde de la pantalla. No cuenta si vive dentro de algo con `overflow-x: auto`, porque eso se hizo a propósito (el cuadro del torneo, por ejemplo). |
| `area-tactil`           | Algo que se toca mide menos de 40px de alto o de ancho. Los enlaces sueltos dentro de un párrafo no cuentan: son texto, no botones.                                                          |
| `texto-cortado`         | El texto no cabe en su caja, la caja lo recorta y no hay puntos suspensivos. El usuario pierde información sin enterarse.                                                                    |
| `letra-minima`          | Texto por debajo de 12px.                                                                                                                                                                    |

## Por qué no hay comparación contra capturas

Las pruebas de captura de referencia fallan cada vez que se cambia un color o
un espaciado, y el equipo termina aprobando las diferencias sin mirarlas. Estas
revisan propiedades que tienen que valer siempre, sin importar cómo se vea la
app, así que solo fallan cuando algo está de verdad roto.

## La prueba se revisa a sí misma

`e2e/auditoria.spec.ts` corre el auditor contra dos páginas de
`e2e/fixtures/`: una rota a propósito (ancho fijo de 520px, texto recortado sin
puntos suspensivos, letra de 9px y un botón de 24x24) y la versión arreglada del
mismo contenido. Si alguien rompe el auditor, esto se da cuenta antes que las
pantallas. Una prueba que nunca falla no prueba nada.

## Reglas para escribir las pantallas

Lo que hay que hacer para que la auditoría pase sin pelearse con ella.

- **Ningún ancho fijo en px.** Usar `%`, `rem`, `max-width` o grid.
- **`min-w-0` en todo hijo de flex que contenga texto.** Sin eso el hijo no se
  encoge y empuja la fila fuera de la pantalla. Es la causa número uno de
  scroll horizontal en layouts con flex.
- **Texto que puede ser largo lleva `truncate`** (que es `overflow: hidden` más
  `text-overflow: ellipsis` más `white-space: nowrap`). Los nombres completos de
  los jugadores son largos.
- **Botones y filas tocables con `min-h-11`** (44px), que es lo que recomiendan
  tanto Apple como Google.
- **Tablas anchas no se encogen, se desplazan.** El contenedor lleva
  `overflow-x: auto` y la tabla adentro su ancho natural. Encoger una tabla
  hasta que las columnas se amontonan es peor que dejarla desplazar.
- **`dvh` y no `vh`** para altos de pantalla completa, por la barra del
  navegador en iOS.
- **Los números de la tabla en `tabular-nums`**, si no bailan al actualizarse en
  vivo.

## Resultado de la primera corrida

Corrida el 16 de septiembre de 2026 contra la app real con datos del seed, en
los siete tamaños, sobre las 15 rutas (públicas, de jugador y de coordinador).

**Lo que salió bien sin tocar nada:** cero fallos de `sin-scroll-horizontal` y
cero de `nada-se-sale`, incluso a 320px. El layout ya aguantaba; el problema
estaba en otro lado.

**Lo que hubo que arreglar**, todo por área táctil:

| Qué                                | Medía                         | Ahora  |
| ---------------------------------- | ----------------------------- | ------ |
| Link del logo en el encabezado     | 115x24                        | 115x44 |
| Botones `size="sm"` de shadcn      | 36px de alto                  | 40px   |
| Pestañas del panel del coordinador | 36px de alto                  | 40px   |
| Links de navegación de la portada  | 20px de alto                  | 40px   |
| Nombre del jugador en la tabla     | 20px de alto                  | 40px   |
| Casillas de verificación           | la etiqueta no llegaba a 40px | 40px   |
| Campos de puntos por set           | 32px de ancho                 | 40px   |

El arreglo del botón `sm` es el que más rindió: una línea en
`src/components/ui/button.tsx` resolvió la mitad de los hallazgos, porque el
problema era del componente y no de cada pantalla.

**Dos errores del auditor** que la corrida destapó y que ya están corregidos:

1. Marcaba los `span.sr-only` como texto cortado. Miden 1x1px con overflow
   oculto a propósito, que es el patrón estándar para texto de lector de
   pantalla. No es un defecto, es accesibilidad bien hecha.
2. Marcaba las casillas de 16px aunque estuvieran dentro de una etiqueta
   grande. Lo que el dedo toca es la etiqueta, no el cuadrito.
3. Marcaba como "se sale de la pantalla" cualquier elemento dentro de un
   contenedor con `overflow: hidden`, cuando eso es justo lo que hace
   `truncate`: recortar un nombre largo con puntos suspensivos. Apareció al
   cambiar de tipografía, porque Figtree es un poco más ancha que Geist.
   El texto recortado SIN puntos suspensivos lo sigue agarrando la otra regla.

Estado actual: **72 pruebas, todas pasan**, ya con Figtree.

## Qué falta

- Las rutas nuevas (`/torneos`, `/torneos/[id]`, `/marcador`, `/marcador/[codigo]`,
  `/hoy`, `/yo`) hay que agregarlas a `e2e/pantallas.ts` a medida que se escriban.
- El cuadro del torneo es el caso más difícil: una llave de 16 en 320px. Va a
  necesitar `overflow-x: auto` y la auditoría lo va a dejar pasar por eso, así
  que ahí hay que mirar con los ojos además de correr la prueba.
