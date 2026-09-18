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

// Los datos pertenecen a un semestre exclusivo de cada prueba; se retiran al
// terminar sin borrar ni cambiar el ranking o torneo que ya estaba en la base.
test.describe("partidos independientes del ranking", () => {
  test.describe.configure({ timeout: 120_000 });
  let semestre: string;
  let ranking: string;
  let torneo: string;
  let partido: string;
  let marcador: string;
  let libre: string;

  test.beforeEach(async ({ page, baseURL }) => {
    semestre = "";
    const local = (url: string) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (!baseURL || !local(baseURL) || !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid")) {
      throw new Error("Estas pruebas crean datos temporales exclusivamente en la aplicación y Supabase locales.");
    }
    semestre = randomUUID();
    ranking = randomUUID();
    torneo = randomUUID();
    partido = randomUUID();
    marcador = randomUUID();
    libre = randomUUID();
    sql(`begin;
      insert into public.semestre(id,nombre,inicio,fin) values ('${semestre}','E2E ${semestre}',current_date,current_date+90);
      insert into public.ranking(id,semestre_id,numero,nombre,fecha_limite,estado)
        values ('${ranking}','${semestre}',1,'Ranking de otra inscripción',current_date+30,'cerrado');
      insert into public.division(ranking_id,tipo) values ('${ranking}','mayor'),('${ranking}','menor');
      insert into public.torneo(id,semestre_id,nombre,formato,estado,sets_para_ganar,horas_autoconfirmacion,tam_llave)
        values ('${torneo}','${semestre}','Copa independiente E2E','llave','en_juego',2,null,2);
      insert into public.torneo_inscripcion(torneo_id,usuario_id)
        select '${torneo}',id from public.usuario where carnet in ('20002','20003');
      insert into public.partido(id,torneo_id,tipo,jugador_a,jugador_b)
        select '${partido}','${torneo}','llave',a.id,b.id from public.usuario a, public.usuario b
        where a.carnet='20002' and b.carnet='20003';
      insert into public.torneo_llave(torneo_id,ronda,posicion,jugador_a,jugador_b,partido_id)
        select '${torneo}',1,1,jugador_a,jugador_b,id from public.partido where id='${partido}';
      insert into public.marcador(id,codigo,partido_id,nombre_a,nombre_b,dueno,sets_para_ganar)
        select '${marcador}',public.codigo_marcador(),'${partido}','Ana Copa E2E','Bruno Copa E2E',id,2
        from public.usuario where carnet='20002';
      insert into public.marcador(id,codigo,nombre_a,nombre_b,dueno)
        select '${libre}',public.codigo_marcador(),'Libre E2E A','Libre E2E B',id from public.usuario where carnet='20002';
      commit;`);
    await page.setViewportSize({ width: 320, height: 700 });
    await ingresar(page, "20002", "123456");
  });

  test.afterEach(() => {
    if (!semestre) return;
    sql(`begin;
      delete from public.baja where objeto_id in ('${ranking}','${torneo}');
      delete from public.marcador where id='${libre}';
      delete from public.ranking where semestre_id='${semestre}';
      delete from public.semestre where id='${semestre}';
      commit;`);
  });

  test("sin ranking activo aparecen los marcadores y se puede eliminar el que está en curso", async ({ page }) => {
    await page.goto("/partidos");
    await exigirQueCargue(page, "/partidos");
    await expect(page.locator(`a[href='/partidos/${partido}']`)).toBeVisible();
    await expect(page.locator(`a[href='/marcador/${marcador}']`)).toBeVisible();
    await expect(page.locator(`a[href='/marcador/${libre}']`)).toBeVisible();
    await expect(page.getByRole("link", { name: /Marcador libre/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(`a[href='/partidos/${partido}']`).click();
    await page.getByRole("button", { name: "Llevar el marcador en vivo" }).click();
    await expect(page).toHaveURL(new RegExp(`/marcador/${marcador}$`));
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Eliminar partido" }).click();
    await expect(page).toHaveURL(/\/partidos$/);
    await expect.poll(() => sql(`select count(*) from public.marcador where id='${marcador}'`)).toBe("0");
    expect(sql(`select estado from public.partido where id='${partido}'`)).toBe("pendiente");
  });

  test("no mezcla rankings y permite registrar y confirmar un torneo sin estar inscrito en el ranking", async ({
    page,
  }) => {
    sql(`update public.ranking set estado='abierto' where id='${ranking}';`);
    await page.goto("/partidos");
    await exigirQueCargue(page, "/partidos");
    await expect(page.getByText("No estás inscrito en este ranking. Hablá con el coordinador.")).toBeVisible();
    await expect(page.getByText("Jugados", { exact: true })).toHaveCount(0);
    await page.locator(`a[href='/partidos/${partido}']`).click();
    await page.getByRole("button", { name: "Sumar un set a Ana López", exact: true }).click({ clickCount: 2 });
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page).toHaveURL(/\/partidos\?registrado=1$/);
    await expect(page.getByText(/Resultado registrado/)).toBeVisible();
    await salir(page);
    await ingresar(page, "20003", "123456");
    await page.goto(`/partidos/${partido}`);
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect.poll(() => sql(`select estado from public.partido where id='${partido}'`)).toBe("confirmado");
  });

  test("al cancelar desaparecen los pendientes y se bloquean los enlaces directos", async ({ page }) => {
    sql(`update public.ranking set estado='abierto' where id='${ranking}';
      insert into public.partido(division_id,tipo,jugador_a,jugador_b)
        select d.id,'regular',least(a.id,b.id),greatest(a.id,b.id)
        from public.division d,public.usuario a,public.usuario b
        where d.ranking_id='${ranking}' and d.tipo='mayor' and a.carnet='20002' and b.carnet='20003';
      begin;
      select set_config('request.jwt.claim.sub',(select id::text from public.usuario where carnet='20001'),true);
      set local role authenticated;
      select public.cancelar_torneo('${torneo}','Cancelación de prueba');
      commit;`);
    await page.goto("/partidos");
    await exigirQueCargue(page, "/partidos");
    await expect(page.locator(`a[href='/partidos/${partido}']`)).toHaveCount(0);
    await expect(page.locator(`a[href='/marcador/${marcador}']`)).toHaveCount(0);
    await expect(page.locator(`a[href='/marcador/${libre}']`)).toBeVisible();
    await page.goto(`/partidos/${partido}`);
    await expect(page.getByText("Este torneo está cancelado.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Llevar el marcador en vivo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Registrar", exact: true })).toHaveCount(0);
    await page.goto(`/marcador/${marcador}`);
    await expect(page).toHaveURL(new RegExp(`/partidos/${partido}$`));
  });
});
