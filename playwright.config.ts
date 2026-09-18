import { defineConfig } from "@playwright/test";

/**
 * Solo se usa para la auditoría de responsive. Levanta el dev server y corre
 * las páginas en varios tamaños de pantalla.
 *
 * El puerto es el 3100 y no el 3000 a propósito: el 3000 lo ocupa otro
 * proyecto de esta máquina, y cuando pasaba eso la auditoría medía esa otra
 * aplicación. Tres corridas se perdieron así antes de que hubiera un guardia
 * que lo detectara, y otra más después, porque había que acordarse de exportar
 * E2E_URL en cada terminal nueva. Con un puerto propio no hay nada que
 * recordar: `npm run dev` y la auditoría apuntan al mismo lugar solos.
 */
const PUERTO = 3100;
const LOCAL = `http://localhost:${PUERTO}`;

/**
 * `E2E_URL` sirve para apuntar a un despliegue en vez de al servidor local,
 * pero es la variable que más daño ha hecho en este proyecto.
 *
 * Dos trampas, las dos vividas:
 *
 *   · Si quedó puesta de una sesión vieja, la suite entera se va a esa URL sin
 *     decir nada. Con `E2E_URL=http://localhost:3001` colgada del entorno de
 *     Windows, las trece pruebas fallaron con «connection refused» contra un
 *     puerto donde no hay nada, y el mensaje no explicaba de dónde salía ese
 *     3001.
 *   · Borrarla con `setx E2E_URL ""` la deja existiendo pero vacía, y `??`
 *     solo cae al valor por omisión con null o undefined. Con cadena vacía
 *     quedaba peor: baseURL en "". Por eso acá va `||` y un trim.
 *
 * Y cuando está puesta se anuncia, porque una suite que apunta a otro lado en
 * silencio es peor que una que no corre.
 */
const DESDE_ENTORNO = (process.env.E2E_URL ?? "").trim();
const BASE = DESDE_ENTORNO || LOCAL;
if (DESDE_ENTORNO) {
  console.log(
    `\n  E2E_URL está puesta: las pruebas van a ${DESDE_ENTORNO} y NO se levanta el servidor local.\n` +
      `  Si no era la intención, borrala y volvé a abrir la terminal:\n` +
      `      reg delete "HKCU\\Environment" /F /V E2E_URL\n`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
      // Chrome intenta hablar con varios servicios de Google al arrancar. En una
      // red que los bloquea eso deja la página esperando para siempre.
      args: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--no-first-run",
        "--disable-features=Translate,OptimizationHints,MediaRouter,AutofillServerCommunication",
      ],
    },
  },
  webServer: DESDE_ENTORNO
    ? undefined
    : {
        command: "npm run dev",
        url: LOCAL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
