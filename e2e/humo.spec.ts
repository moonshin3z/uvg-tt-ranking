import { test } from "@playwright/test";
import { confirmarQueEsLaApp } from "./identidad";
import { COORDINADOR, JUGADOR, exigirQueCargue, ingresar, salir } from "./sesion";

/**
 * Que cada pantalla cargue. Nada más, y por eso vale.
 *
 * La auditoría de responsive ya visita estas mismas rutas, pero mide layout: un
 * título, un párrafo y dos botones centrados son un layout perfecto, así que la
 * pantalla de error pasaba en verde. Con eso, /admin/jugadores estuvo reventando
 * con «permission denied for table usuario» desde la migración de permisos y
 * ninguna corrida lo dijo.
 *
 * Esta prueba es la contraparte: no mira cómo se ve nada, solo que la aplicación
 * no haya mostrado su pantalla de error y que el contenido propio de cada
 * pantalla esté ahí.
 *
 * Necesita la base local con la semilla (`npm run db:reset`) y el servidor de
 * desarrollo. No escribe nada, así que se puede correr las veces que haga falta
 * sin volver a sembrar.
 */

const PUBLICAS = ["/", "/rankings", "/reglas", "/ingresar"] as const;

const DEL_JUGADOR = ["/partidos", "/marcador/nuevo"] as const;

const DEL_COORDINADOR = [
  "/admin",
  "/admin/ranking",
  "/admin/partidos",
  // La que estaba rota.
  "/admin/jugadores",
  "/admin/torneos",
] as const;

test.describe("sin ingresar", () => {
  for (const ruta of PUBLICAS) {
    test(`${ruta} carga`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: "load" });
      await confirmarQueEsLaApp(page);
      await exigirQueCargue(page, ruta);
    });
  }
});

test.describe("con sesión de jugador", () => {
  test.beforeEach(async ({ page }) => {
    await salir(page);
    await ingresar(page, JUGADOR.carnet, JUGADOR.pin);
  });

  for (const ruta of DEL_JUGADOR) {
    test(`${ruta} carga`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: "load" });
      await exigirQueCargue(page, ruta);
    });
  }

  test("el perfil propio carga", async ({ page }) => {
    const ruta = `/jugador/${JUGADOR.carnet}`;
    await page.goto(ruta, { waitUntil: "load" });
    await exigirQueCargue(page, ruta);
    // La fila de salir solo sale en el perfil propio: si no está, la sesión no
    // es de quien creemos y el resto de la prueba no significa nada.
    await page.getByRole("button", { name: /salir/i }).waitFor({ state: "visible", timeout: 8_000 });
  });
});

test.describe("con sesión de coordinador", () => {
  test.beforeEach(async ({ page }) => {
    await salir(page);
    await ingresar(page, COORDINADOR.carnet, COORDINADOR.pin);
  });

  for (const ruta of DEL_COORDINADOR) {
    test(`${ruta} carga`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: "load" });
      await exigirQueCargue(page, ruta);
    });
  }

  test("la lista de jugadores trae jugadores de verdad", async ({ page }) => {
    // Cargar no alcanza: si la consulta devolviera vacío, la pantalla se vería
    // bien igual. La semilla deja nueve usuarios, así que tiene que aparecer
    // alguno de ellos por carnet.
    await page.goto("/admin/jugadores", { waitUntil: "load" });
    await exigirQueCargue(page, "/admin/jugadores");
    await page.getByText(JUGADOR.carnet, { exact: false }).first().waitFor({ state: "visible", timeout: 8_000 });
  });
});
