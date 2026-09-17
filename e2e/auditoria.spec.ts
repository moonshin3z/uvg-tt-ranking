import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { auditar, LETRA_MIN, TACTIL_MIN, REGLAS, type Hallazgo } from "./auditoria";

/**
 * El auditor se revisa a sí mismo.
 *
 * Una prueba que nunca falla no prueba nada. Estas dos páginas existen para
 * comprobar que el auditor sigue detectando lo que dice detectar: una está
 * rota a propósito y la otra es la versión arreglada del mismo contenido.
 * Si alguien rompe el auditor, esto se da cuenta antes que las pantallas.
 */

async function auditarArchivo(page: import("@playwright/test").Page, nombre: string) {
  const url = pathToFileURL(resolve(__dirname, "fixtures", nombre)).href;
  await page.goto(url);
  return page.evaluate(
    ([fn, tactil, letra]) => {
      const f = new Function(`return (${fn})`)() as (t: number, l: number) => Hallazgo[];
      return f(tactil as number, letra as number);
    },
    [auditar.toString(), TACTIL_MIN, LETRA_MIN] as const,
  );
}

test.use({ viewport: { width: 320, height: 568 } });

test("detecta los cinco problemas en una página rota a propósito", async ({ page }) => {
  const hallazgos = await auditarArchivo(page, "rota.html");
  const reglas = new Set(hallazgos.map((h) => h.regla));
  expect(reglas).toContain(REGLAS.SIN_SCROLL_HORIZONTAL);
  expect(reglas).toContain(REGLAS.NADA_SE_SALE);
  expect(reglas).toContain(REGLAS.TEXTO_CORTADO);
  expect(reglas).toContain(REGLAS.LETRA_MINIMA);
  expect(reglas).toContain(REGLAS.AREA_TACTIL);
});

test("no marca nada en la versión arreglada del mismo contenido", async ({ page }) => {
  const hallazgos = await auditarArchivo(page, "buena.html");
  expect(hallazgos, JSON.stringify(hallazgos, null, 2)).toEqual([]);
});
