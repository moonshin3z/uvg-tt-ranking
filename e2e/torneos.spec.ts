import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

test.describe("siembra manual de torneos", () => {
  test.describe.configure({ timeout: 120_000 });

  let semestre = "";
  let torneo = "";

  test.beforeEach(async ({ page, baseURL }) => {
    const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (!baseURL || !local(baseURL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")) {
      throw new Error("Estas pruebas crean datos temporales exclusivamente en la aplicación y Supabase locales.");
    }

    semestre = randomUUID();
    torneo = randomUUID();
    sql(`begin;
      insert into public.semestre(id,nombre,inicio,fin)
        values ('${semestre}','E2E siembra ${semestre}',current_date,current_date+90);
      insert into public.torneo(
        id,semestre_id,nombre,formato,estado,fecha,sets_para_ganar,puntos_por_set,horas_autoconfirmacion,creado_por
      )
        select '${torneo}','${semestre}','Copa siembra E2E','llave','inscripcion',current_date+1,2,11,24,id
        from public.usuario where carnet='20001';
      insert into public.torneo_inscripcion(torneo_id,usuario_id)
        select '${torneo}',id from public.usuario where carnet in ('20002','20003','20004','20005');
      commit;`);

    await ingresar(page, "20001", "123456");
  });

  test.afterEach(() => {
    if (!semestre) return;
    sql(`begin;
      delete from public.torneo where id='${torneo}';
      delete from public.semestre where id='${semestre}';
      commit;`);
  });

  test("guarda el orden manual como manual", async ({ page }) => {
    await page.goto(`/admin/torneos/${torneo}`);
    await exigirQueCargue(page, `/admin/torneos/${torneo}`);
    await page.getByRole("radio", { name: "Elegir el orden manualmente" }).check();
    await page.getByRole("button", { name: "Bajar Ana López" }).click();
    await page.getByRole("button", { name: "Armar con esta siembra" }).click();
    await expect(page.getByText("Siembra manual guardada.", { exact: true })).toBeVisible();
    await expect
      .poll(() => sql(`select semilla from public.torneo_sorteo where torneo_id='${torneo}'`))
      .toBe("manual");
    await expect
      .poll(() =>
        sql(`select string_agg(u.carnet, ',' order by ti.siembra)
        from public.torneo_inscripcion ti join public.usuario u on u.id=ti.usuario_id
        where ti.torneo_id='${torneo}'`),
      )
      .toBe("20003,20002,20004,20005");
  });
});
