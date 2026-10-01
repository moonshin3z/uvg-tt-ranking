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

test.describe("bitácora de partidos", () => {
  test.describe.configure({ timeout: 120_000 });
  let semestre = "";
  let ranking = "";
  let partido = "";

  test.beforeEach(async ({ page, baseURL }) => {
    const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (!baseURL || !local(baseURL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")) {
      throw new Error("Estas pruebas crean datos temporales exclusivamente en la aplicación y Supabase locales.");
    }

    semestre = randomUUID();
    ranking = randomUUID();
    partido = randomUUID();
    sql(`begin;
      insert into public.semestre(id,nombre,inicio,fin)
        values ('${semestre}','E2E bitácora ${semestre}',current_date,current_date+90);
      insert into public.ranking(id,semestre_id,numero,nombre,fecha_limite,estado)
        values ('${ranking}','${semestre}',1,'Ranking bitácora E2E',current_date+30,'cerrado');
      insert into public.division(ranking_id,tipo) values ('${ranking}','primera');
      insert into public.partido(id,division_id,tipo,jugador_a,jugador_b)
        select '${partido}',d.id,'regular',least(a.id,b.id),greatest(a.id,b.id)
        from public.division d, public.usuario a, public.usuario b
        where d.ranking_id='${ranking}' and d.tipo='primera'
          and a.carnet='20002' and b.carnet='20003';
      insert into public.partido_evento(partido_id,actor,accion,antes,despues)
        select '${partido}',a.id,'registro',
          '{"estado":"pendiente"}'::jsonb,
          '{"estado":"jugado","sets_a":2,"sets_b":1}'::jsonb
        from public.usuario a where a.carnet='20002';
      commit;`);
    await ingresar(page, "20002", "123456");
  });

  test.afterEach(() => {
    if (!semestre) return;
    sql(`delete from public.ranking where id='${ranking}'; delete from public.semestre where id='${semestre}';`);
  });

  test("muestra el evento, el actor, el cambio y la fecha", async ({ page }) => {
    await page.goto(`/partidos/${partido}`);
    await exigirQueCargue(page, `/partidos/${partido}`);
    const bitacora = page.locator("summary").filter({ hasText: "Bitácora del partido" });
    await expect(bitacora).toHaveText(/Bitácora del partido\s*1$/);
    await bitacora.click();
    await expect(page.getByText("Registró el resultado", { exact: true })).toBeVisible();
    await expect(page.getByText("Ana López (20002)", { exact: true })).toBeVisible();
    await expect(page.getByText("pendiente → jugado · sets 2-1", { exact: true })).toBeVisible();
  });
});
