import type { Page } from "@playwright/test";

/**
 * Todas las páginas de esta app llevan `data-app="uvgtt"` en el <html>
 * (plantilla de `layout.tsx`). Sirve para comprobar que lo que hay del otro
 * lado de la URL es esta aplicación y no otro proyecto corriendo en el mismo
 * puerto.
 *
 * Antes esto se comprobaba con el título. No servía: mientras una página
 * redirige, el navegador reemplaza el título por "Loading http://..." y la
 * comprobación acusaba de impostora a la app correcta. Una marca en el DOM no
 * tiene estados intermedios. `identidad.spec.ts` cubre justamente ese caso.
 */
export const MARCA = "uvgtt";

export function comoArreglarlo(url: string) {
  return [
    ``,
    `La URL ${url} no está sirviendo esta aplicación.`,
    `(no se encontró <html data-app="${MARCA}"> en esa página)`,
    ``,
    `Casi siempre es que el puerto 3000 ya estaba ocupado por otro proyecto,`,
    `así que Next levantó este en el 3001 o el 3002. Mirá qué puerto dice`,
    `"npm run dev" y corré la auditoría apuntando ahí:`,
    ``,
    `    set E2E_URL=http://localhost:3002`,
    `    npm run test:responsive`,
    ``,
    `(en PowerShell: $env:E2E_URL="http://localhost:3002")`,
    ``,
  ].join("\n");
}

/**
 * Espera a que la página se asiente y confirma que es esta app. Espera en vez
 * de mirar una sola vez porque puede haber una redirección en vuelo.
 */
export async function confirmarQueEsLaApp(page: Page, timeout = 10_000) {
  await page
    .locator(`html[data-app="${MARCA}"]`)
    .waitFor({ state: "attached", timeout })
    .catch(() => {
      throw new Error(comoArreglarlo(page.url()));
    });
}
