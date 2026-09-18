import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { exigirQueCargue, ingresar, salir } from "./sesion";

loadEnvConfig(process.cwd());

function sql(texto: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_uvg-tt",
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: texto, encoding: "utf8" },
  ).trim();
}

test.describe("bitácora de bajas", () => {
  let baja = "";

  test.beforeEach(async ({ page, baseURL }) => {
    const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (!baseURL || !local(baseURL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")) {
      throw new Error("Estas pruebas crean datos temporales exclusivamente en la aplicación y Supabase locales.");
    }

    baja = randomUUID();
    const coordinador = sql("select id from public.usuario where carnet='20001'");
    sql(
      "insert into public.baja(id,accion,tipo,objeto_id,nombre,estado,contenido,motivo,hecho_por) " +
        "values ('" +
        baja +
        "', 'cancelado', 'torneo', gen_random_uuid(), 'Copa bitácora E2E', 'en_juego', " +
        '\'{"inscritos":4,"partidos":6,"jugados":2,"marcadores":1}\'::jsonb, ' +
        "'Se suspendió por prueba', '" +
        coordinador +
        "');",
    );
    await ingresar(page, "20001", "123456");
  });

  test.afterEach(() => {
    if (baja) sql("delete from public.baja where id='" + baja + "';");
  });

  test("muestra el detalle y solo un coordinador puede verla", async ({ page }) => {
    await page.goto("/admin/bajas");
    await exigirQueCargue(page, "/admin/bajas");
    await expect(page.getByRole("heading", { name: "Bitácora de bajas" })).toBeVisible();
    await expect(page.getByText("Copa bitácora E2E", { exact: true })).toBeVisible();
    await expect(page.getByText("4 inscritos, 6 partidos, 2 con resultado, 1 marcador con puntos")).toBeVisible();
    await expect(page.getByText(/Hecho por:.*Coordinador Demo \(20001\)/)).toBeVisible();
    await expect(page.getByText(/Motivo:.*Se suspendió por prueba/)).toBeVisible();

    await salir(page);
    await ingresar(page, "20002", "123456");
    await page.goto("/admin/bajas");
    await expect(page).toHaveURL(/\?motivo=solo-coordinador$/);
  });
});
