import { execFileSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";
import { ingresar, salir } from "./sesion";

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

test("el primer cambio de PIN no vuelve a pedirlo", async ({ page }) => {
  test.setTimeout(120_000);
  sql(`update public.usuario set debe_cambiar_pin = true where carnet = '20002';`);

  try {
    await ingresar(page, "20002", "123456");
    await expect(page).toHaveURL(/\/cambiar-pin$/);
    await page.getByLabel("PIN nuevo").fill("483920");
    await page.getByLabel("Repetí el PIN").fill("483920");
    await page.getByRole("button", { name: "Guardar PIN" }).click();
    await expect(page).toHaveURL(/\/partidos\?bienvenida=1$/);
    await expect(page).not.toHaveURL(/\/cambiar-pin/);
    await expect(page.getByText("Listo, ya estás adentro")).toBeVisible();
  } finally {
    await salir(page).catch(() => undefined);
    sql(`update auth.users
           set encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf'))
         where email = '20002@uvgtt.local';
         update public.usuario set debe_cambiar_pin = false where carnet = '20002';`);
  }
});
