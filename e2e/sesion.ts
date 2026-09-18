import type { Page } from "@playwright/test";
import { confirmarQueEsLaApp } from "./identidad";

/**
 * Ingresar, compartido entre la auditoría de responsive y las pruebas de flujo.
 *
 * Los usuarios por omisión son los que crea `supabase/seed.sql`, que son fijos
 * y están documentados ahí. Antes había que exportar cuatro variables en cada
 * terminal, y si uno se olvidaba, las pruebas con sesión se saltaban en
 * silencio: la corrida decía "4 passed" y parecía que todo estaba bien.
 *
 * `||` y no `??`: una variable borrada con `setx VAR ""` en Windows sigue
 * existiendo, vacía, y `??` solo cae al valor por omisión con null o undefined.
 * Con `??` una variable "borrada" dejaba el carnet en cadena vacía.
 */
const dato = (v: string | undefined, porOmision: string) => (v ?? "").trim() || porOmision;
export const COORDINADOR = {
  carnet: dato(process.env.E2E_CARNET_COORD, "20001"),
  pin: dato(process.env.E2E_PIN_COORD, "123456"),
};

export const JUGADOR = {
  carnet: dato(process.env.E2E_CARNET, "20002"),
  pin: dato(process.env.E2E_PIN, "123456"),
};

/** El rival del jugador de arriba, para probar registrar y confirmar. */
export const RIVAL = {
  carnet: dato(process.env.E2E_CARNET_RIVAL, "20003"),
  pin: dato(process.env.E2E_PIN_RIVAL, "123456"),
};

export async function ingresar(page: Page, carnet: string, pin: string) {
  await page.goto("/ingresar", { waitUntil: "load" });
  await confirmarQueEsLaApp(page);

  // 8 segundos alcanzan de sobra en local. Con el timeout por defecto, una URL
  // equivocada tardaba 45 s por prueba y la corrida entera media hora.
  const campo = page.getByLabel(/carnet/i);
  await campo.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {
    throw new Error(
      `No apareció el campo de carnet en ${page.url()}.\n` +
        `Si la app es la correcta, revisá que /ingresar cargue bien.`,
    );
  });
  await campo.fill(carnet);
  await page.getByLabel(/pin/i).fill(pin);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 15_000 });
}

export async function salir(page: Page) {
  await page.context().clearCookies();
}

/**
 * Falla si la pantalla que se está viendo es la de error de la aplicación.
 *
 * Es la comprobación más barata que existe y la que más falta hacía: una
 * pantalla que revienta se ve impecable para una auditoría de layout, así que
 * /admin/jugadores estuvo roto desde la migración de permisos sin que ninguna
 * corrida lo dijera. El error boundary sale marcado con `data-uvgtt-error`.
 */
export async function exigirQueCargue(page: Page, ruta: string) {
  // `page.evaluate` y no `page.locator`: los selectores de Playwright
  // atraviesan el shadow DOM, y el overlay de desarrollo de Next trae dentro
  // del suyo un `<div data-error="false">`. Con el locator, las trece pruebas
  // daban positivo en pantallas que habían cargado perfectas. `querySelector`
  // se queda en el DOM normal, que es donde está lo nuestro.
  const reventó = await page.evaluate(() => document.querySelector("[data-uvgtt-error]") !== null);
  if (!reventó) return;
  const titulo = await page
    .locator("h1")
    .first()
    .textContent()
    .catch(() => null);
  throw new Error(
    `${ruta} no cargó: la aplicación mostró su pantalla de error` +
      (titulo ? ` («${titulo.trim()}»)` : "") +
      `.\nEl error real queda en la consola del servidor de desarrollo; casi siempre es una consulta que la base rechaza.`,
  );
}
