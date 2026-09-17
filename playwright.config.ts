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
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_URL ?? `http://localhost:${PUERTO}`,
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
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: "npm run dev",
        url: `http://localhost:${PUERTO}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
