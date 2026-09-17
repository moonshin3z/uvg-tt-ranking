# Diseño

## Decisiones cerradas

- **Tipografía: Figtree.** Una sola familia, sin monoespaciada. Las cifras se
  alinean con `font-variant-numeric: tabular-nums`, no cambiando de fuente.
  Vive en `src/fonts/` como fuente variable de 12 KB, versionada en el repo y
  cargada con `next/font/local`, así que el build no depende de la red ni de
  `node_modules`. Licencia SIL OFL 1.1, incluida al lado del archivo.
- **Un solo modo de color, claro.** Hecho: `globals.css` ya no tiene el bloque
  `@media (prefers-color-scheme: dark)` ni el `@custom-variant dark`.
- **El verde institucional de la UVG se queda**, pero nunca con texto encima ni
  como texto: `#0b9e51` con blanco encima da 3.49:1, y como texto sobre el
  fondo, 3.11:1. AA pide 4.50. Vive en el token `--uvg` y se usa solo como
  relleno: el punto del encabezado, las barras de zona, un borde.

  Donde hay letras va `#0a7d40`, el mismo verde un paso más oscuro. Ese número
  salió de medirlo en los tres sitios donde aparece, no de estimarlo: 4.71:1
  como texto sobre el fondo, 5.22:1 con blanco encima, 4.67:1 sobre el verde
  lavado. El primer candidato fue `#098645`, que pasaba con blanco encima
  (4.66:1) pero no como texto sobre el fondo (4.20:1).
- **Un solo acento y un solo rojo.** Verde para lo bueno (premio y ascenso),
  rojo `#ab3f2b` para el descenso y para los avisos. No hay un tercer color.
- **Las zonas de la tabla se marcan con una barra de 3px en el borde**, sin
  fondo de color. Pintar la fila entera hacía que seis de diez filas tuvieran
  color y el código dejaba de señalar nada.
- **La tabla de posiciones es la pantalla que abre la app.**
- **Tres pestañas: Tabla, Partidos, Perfil.** El coordinador ve una cuarta.
- **El torneo en curso aparece arriba de la tabla y solo mientras existe.**
  Sin torneo no deja hueco ni un mensaje: no está.
- **Rankings y torneos anteriores viven en el perfil**, no en la tabla.
- **Una sola forma de fila** para todo lo que es un partido, venga del ranking
  o de un torneo. Una acción por fila; el resto vive en el detalle.
- **Sin tarjetas para separar secciones**, sin rótulos en mayúsculas
  espaciadas, sin botón flotante, sin etiquetas de color para clasificar.
- **El marcador tiene la mitad de arriba girada 180°** para que se lea desde el
  otro lado de la mesa, con un botón para desactivarlo.
- **Anotar solo los sets es el camino corto.** Los puntos por set son
  opcionales y se llenan solos si se usa el marcador en vivo.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `v1-direcciones-paleta.html` | Cuatro direcciones de paleta: Marcador, Cancha, Planilla, Aire. Sin usar |
| `v2-estructura.html` | Cuatro estructuras posibles, de antes de que existieran torneos y marcador |
| `v3-estructura-definitiva.html` | La estructura elegida, con el mapa de URLs |
| `v4-prototipo.html` | **El prototipo navegable.** Es la referencia viva del diseño |
| `responsive.md` | Cómo se verifica que todo se adapte, y el resultado de las corridas |

El prototipo trae interruptores para probar tipografías, estados de datos
(con datos, cargando, sin ranking, sin conexión), estado del club (con torneo
o sin torneo) y rol (jugador o coordinador).

## Lo que falta llevar al código real

El motor está completo y el prototipo también. Falta que la app se vea como el
prototipo:

1. Borrar el bloque de modo oscuro de `globals.css` y reemplazar la paleta
   (azul y naranja) por la definitiva.
2. Reemplazar las `Card` apiladas por la fila única y las reglas.
3. La tabla de posiciones con las barras de zona y como `<table>` semántica.
4. Las tres pestañas y el mapa de URLs de `v3-estructura-definitiva.html`.
5. Pantallas nuevas: torneos, cuadro, marcador, anotar solo sets, y el admin de
   torneos.
6. Estados vacío, de carga y de error en cada pantalla.

## Hallazgos del audit, ya corregidos en el prototipo

Corrido con `redesign-skill`, `taste-skill`, `emil-design-eng` y
`mobile-native` desde `.claude/skills/`:

- Contraste: botón primario 3.49 → 4.66, gris claro 3.10 → 4.51.
- Dos rojos distintos unificados en uno.
- Baseline móvil completo: `touch-action`, `user-select` solo en controles,
  `-webkit-text-size-adjust`, `overscroll-behavior` en la raíz.
- `:hover` detrás de `@media (hover:hover) and (pointer:fine)`.
- `:active` con `scale(.96)` en todo lo presionable.
- Cero guiones largos; los marcadores dicen "3-1".
- La escala de radios bajó de 14 valores sueltos a seis nombrados.
- La tabla pasó de divs a `<table>` con `caption`, `thead` y `th scope`.
- Estados vacío, de carga y de error, que no existían.
- Cero chevrones sin destino.

Dos cosas que no se pueden arreglar en el prototipo y quedan para el código
real: `interactive-widget=resizes-content` en el viewport de `layout.tsx`, y
probar el marcador girado en un teléfono de verdad apoyado en una mesa.
