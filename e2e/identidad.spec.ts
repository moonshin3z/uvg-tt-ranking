import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { confirmarQueEsLaApp } from "./identidad";

/**
 * El guardia de identidad se revisa a sí mismo.
 *
 * Existe porque la primera versión miraba el título de la página y acusaba de
 * impostora a la app correcta cada vez que una ruta redirigía. Estas dos
 * páginas dejan ese error clavado: si alguien vuelve a atar la comprobación al
 * título, la primera falla; si la afloja hasta que no detecte nada, falla la
 * segunda.
 */

function url(nombre: string) {
  return pathToFileURL(resolve(__dirname, "fixtures", nombre)).href;
}

test("acepta una página de esta app aunque el título sea el de una redirección en vuelo", async ({
  page,
}) => {
  await page.goto(url("redirigiendo.html"));
  await expect(confirmarQueEsLaApp(page, 2_000)).resolves.toBeUndefined();
});

test("rechaza otra app aunque su título se parezca al nuestro", async ({ page }) => {
  await page.goto(url("ajena.html"));
  await expect(confirmarQueEsLaApp(page, 2_000)).rejects.toThrow(/no está sirviendo esta aplicación/);
});
