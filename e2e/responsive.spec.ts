import { expect, test, type Page } from "@playwright/test";
import { auditar, LETRA_MIN, TACTIL_MIN, type Hallazgo } from "./auditoria";
import { confirmarQueEsLaApp } from "./identidad";
import { PANTALLAS, RUTAS_COORDINADOR, RUTAS_JUGADOR, RUTAS_PUBLICAS } from "./pantallas";

/**
 * Se comprueba una sola vez y antes que nada. Sin esto, la auditoría mide
 * alegremente la app equivocada y reporta sus defectos como si fueran de este
 * proyecto, que es peor que no tener prueba. El guardia vive en `identidad.ts`
 * y se prueba a sí mismo en `identidad.spec.ts`.
 */
test("la URL auditada sirve esta aplicación", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await confirmarQueEsLaApp(page);
});

/**
 * Auditoría de responsive.
 *
 * No compara contra capturas de referencia a propósito: esas pruebas fallan
 * cada vez que se cambia un color y terminan ignorándose. Estas revisan
 * propiedades que siempre tienen que valer, sin importar cómo se vea la app:
 * que nada se salga de la pantalla, que lo que se toca se pueda tocar, y que
 * el texto no quede cortado.
 */

async function revisar(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: "load" });
  await asentar(page);
  await confirmarQueEsLaApp(page);
  exigirQueNoSeaCambiarPin(page, ruta);
  return medir(page);
}

/**
 * Espera a que la página deje de moverse.
 *
 * Varias rutas redirigen después de cargar: `/admin` manda a `/admin/ranking`,
 * y una sesión vencida manda a `/ingresar`. Medir en medio del salto daba dos
 * cosas, las dos falsas: o el navegador destruía el contexto, o se medía la
 * página nueva con el CSS a medio aplicar y salían botones de 21px de alto que
 * en pantalla miden 40.
 */
async function asentar(page: Page) {
  let antes = page.url();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    const ahora = page.url();
    if (ahora === antes) break;
    antes = ahora;
  }
  await page.waitForLoadState("load");
}

function rutaDe(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

/**
 * El usuario recién creado tiene que cambiar el PIN, así que todas las rutas
 * con sesión rebotan a /cambiar-pin. Si eso pasa, la auditoría estaría midiendo
 * siete veces la misma pantalla y diciendo que las demás están bien. Mejor
 * fallar de una y decir cómo arreglarlo.
 */
function exigirQueNoSeaCambiarPin(page: Page, ruta: string) {
  if (ruta.startsWith("/cambiar-pin") || !rutaDe(page.url()).startsWith("/cambiar-pin")) return;
  throw new Error(
    [
      ``,
      `${ruta} rebotó a /cambiar-pin.`,
      ``,
      `El usuario de prueba todavía tiene el PIN inicial, así que la app lo`,
      `obliga a cambiarlo antes de dejarlo ver nada. Con eso, la auditoría`,
      `mediría /cambiar-pin y no ${ruta}.`,
      ``,
      `El seed de desarrollo ya los deja con el PIN cambiado, así que casi`,
      `siempre alcanza con volver a sembrar la base:`,
      ``,
      `    npx supabase db reset`,
      ``,
      `Si no, marcalo a mano:`,
      ``,
      `    update public.usuario set debe_cambiar_pin = false;`,
      ``,
    ].join("\n"),
  );
}

/**
 * Mide, y si la página se movió justo en ese momento vuelve a intentarlo una
 * vez sobre la página ya asentada. La espera de las fuentes y de las hojas de
 * estilo va acá adentro a propósito: si quedara afuera del reintento, una
 * redirección la tumbaría igual.
 */
async function medir(page: Page, reintento = true): Promise<Hallazgo[]> {
  try {
    // El texto no mide lo mismo sin sus hojas de estilo ni sus fuentes.
    await page.waitForFunction(
      () => document.readyState === "complete" && document.styleSheets.length > 0,
      undefined,
      { timeout: 10_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    return await evaluarAuditoria(page);
  } catch (e) {
    if (!reintento || !seMovio(e)) throw e;
    await asentar(page);
    await page.waitForTimeout(400);
    return medir(page, false);
  }
}

function seMovio(e: unknown) {
  const t = String(e);
  return t.includes("Execution context was destroyed") || t.includes("frame was detached");
}

function evaluarAuditoria(page: Page) {
  return page.evaluate(
    ([fn, tactil, letra]) => {
      // La función viaja como texto para no depender del bundler.
      const f = new Function(`return (${fn})`)() as (t: number, l: number) => Hallazgo[];
      return f(tactil as number, letra as number);
    },
    [auditar.toString(), TACTIL_MIN, LETRA_MIN] as const,
  );
}

function informe(ruta: string, pantalla: string, hallazgos: Hallazgo[], urlFinal?: string): string {
  const lineas = hallazgos.map((h) => `  · [${h.regla}] ${h.selector}\n      ${h.detalle}`);
  const donde = urlFinal && !urlFinal.endsWith(ruta) ? `${ruta} (terminó en ${urlFinal})` : ruta;
  return `${donde} en ${pantalla}\n${lineas.join("\n")}`;
}

for (const pantalla of PANTALLAS) {
  test.describe(pantalla.nombre, () => {
    test.use({ viewport: { width: pantalla.width, height: pantalla.height } });

    for (const ruta of RUTAS_PUBLICAS) {
      test(`${ruta} se adapta`, async ({ page }) => {
        const hallazgos = await revisar(page, ruta);
        expect(hallazgos, informe(ruta, pantalla.nombre, hallazgos, page.url())).toEqual([]);
      });
    }
  });
}

/**
 * Las pantallas con sesión necesitan credenciales de un usuario de prueba.
 * Sin ellas la auditoría se salta esas rutas en vez de fallar, para que la
 * prueba siga sirviendo en una máquina recién clonada.
 */
// Por omisión, los usuarios que crea `supabase/seed.sql`, que son fijos y
// están documentados ahí. Antes había que exportar cuatro variables en cada
// terminal, y si uno se olvidaba, las 15 pruebas con sesión se saltaban en
// silencio: la corrida decía "4 passed" y parecía que todo estaba bien.
const CARNET = process.env.E2E_CARNET ?? "20002";
const PIN = process.env.E2E_PIN ?? "123456";
const CARNET_COORD = process.env.E2E_CARNET_COORD ?? "20001";
const PIN_COORD = process.env.E2E_PIN_COORD ?? "123456";

async function ingresar(page: Page, carnet: string, pin: string) {
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

test.describe("con sesión de jugador", () => {
  test.skip(!CARNET || !PIN, "Falta E2E_CARNET y E2E_PIN");

  for (const pantalla of PANTALLAS) {
    test.describe(pantalla.nombre, () => {
      test.use({ viewport: { width: pantalla.width, height: pantalla.height } });
      for (const ruta of RUTAS_JUGADOR) {
        test(`${ruta} se adapta`, async ({ page }) => {
          await ingresar(page, CARNET!, PIN!);
          const hallazgos = await revisar(page, ruta);
          expect(hallazgos, informe(ruta, pantalla.nombre, hallazgos, page.url())).toEqual([]);
        });
      }
    });
  }
});

test.describe("con sesión de coordinador", () => {
  test.skip(!CARNET_COORD || !PIN_COORD, "Falta E2E_CARNET_COORD y E2E_PIN_COORD");

  for (const pantalla of PANTALLAS) {
    test.describe(pantalla.nombre, () => {
      test.use({ viewport: { width: pantalla.width, height: pantalla.height } });
      for (const ruta of RUTAS_COORDINADOR) {
        test(`${ruta} se adapta`, async ({ page }) => {
          await ingresar(page, CARNET_COORD!, PIN_COORD!);
          const hallazgos = await revisar(page, ruta);
          expect(hallazgos, informe(ruta, pantalla.nombre, hallazgos, page.url())).toEqual([]);
        });
      }
    });
  }
});
