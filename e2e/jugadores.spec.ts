import { execFileSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { exigirQueCargue, ingresar } from "./sesion";

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

test.describe("roles de jugadores", () => {
  test("un coordinador puede nombrar coordinador a un jugador", async ({ page, baseURL }) => {
    const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (!baseURL || !local(baseURL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")) {
      throw new Error("Estas pruebas cambian datos exclusivamente en la aplicación y Supabase locales.");
    }

    await ingresar(page, "20001", "123456");
    await page.goto("/admin/jugadores");
    await exigirQueCargue(page, "/admin/jugadores");

    const fila = page.locator("li").filter({ hasText: "Ana López" });
    await fila.getByRole("button", { name: "Hacer coordinador" }).click();
    await expect(fila.getByText("coordinador", { exact: true })).toBeVisible();
    await expect.poll(() => sql("select rol from public.usuario where carnet='20002'")).toBe("coordinador");

    sql("update public.usuario set rol='jugador' where carnet='20002';");
  });
});
