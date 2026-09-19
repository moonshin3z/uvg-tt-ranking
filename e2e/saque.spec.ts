import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect as baseExpect, test } from "@playwright/test";
import { exigirQueCargue, ingresar } from "./sesion";

loadEnvConfig(process.cwd());
const expect = baseExpect.configure({ timeout: 5_000 });

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

function tanteo(id: string) {
  return sql(`select concat_ws('|',primer_saque,saca,puntos_a,puntos_b,sets_a,sets_b)
    from public.marcador where id='${id}'`);
}

test.describe("primer saque del marcador", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ actionTimeout: 8_000 });
  let semestre: string;
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
    torneo = randomUUID();
    partido = randomUUID();
    marcador = randomUUID();
    libre = randomUUID();
    sql(`begin;
      insert into public.semestre(id,nombre,inicio,fin)
        values ('${semestre}','Saque E2E ${semestre}',current_date,current_date+90);
      insert into public.torneo(id,semestre_id,nombre,formato,estado,sets_para_ganar,horas_autoconfirmacion,tam_llave)
        values ('${torneo}','${semestre}','Copa saque E2E','llave','en_juego',2,null,2);
      insert into public.torneo_inscripcion(torneo_id,usuario_id)
        select '${torneo}',id from public.usuario where carnet in ('20002','20003');
      insert into public.partido(id,torneo_id,tipo,jugador_a,jugador_b)
        select '${partido}','${torneo}','llave',a.id,b.id from public.usuario a,public.usuario b
        where a.carnet='20002' and b.carnet='20003';
      insert into public.torneo_llave(torneo_id,ronda,posicion,jugador_a,jugador_b,partido_id)
        select '${torneo}',1,1,jugador_a,jugador_b,id from public.partido where id='${partido}';
      insert into public.marcador(id,codigo,partido_id,nombre_a,nombre_b,dueno,sets_para_ganar)
        select '${marcador}',public.codigo_marcador(),'${partido}','Ana Copa','Bruno Copa',id,2
        from public.usuario where carnet='20002';
      insert into public.marcador(id,codigo,nombre_a,nombre_b,dueno,sets_para_ganar)
        select '${libre}',public.codigo_marcador(),'Ana Libre','Bruno Libre',id,2
        from public.usuario where carnet='20002';
      commit;`);
    await page.setViewportSize({ width: 320, height: 700 });
    await ingresar(page, "20002", "123456");
  });

  test.afterEach(() => {
    if (!semestre) return;
    sql(`begin;
      delete from public.marcador where id in ('${libre}','${marcador}');
      delete from public.semestre where id='${semestre}';
      commit;`);
  });

  test("elegir al segundo jugador se conserva y alterna por puntos y sets", async ({ page }, testInfo) => {
    await page.goto(`/marcador/${marcador}`);
    await exigirQueCargue(page, `/marcador/${marcador}`);
    const pregunta = page.getByRole("heading", { name: "¿Quién saca primero?", exact: true });
    await expect(pregunta).toBeVisible();
    await expect(page.getByRole("button", { name: "Saca primero Ana Copa", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sortear", exact: true })).toBeVisible();
    expect(sql(`select primer_saque is null from public.marcador where id='${marcador}'`)).toBe("t");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("saque-eleccion-320.png") });

    await page.getByRole("button", { name: "Saca primero Bruno Copa", exact: true }).click();
    await expect(pregunta).toHaveCount(0);
    await expect(page.getByText("saca Bruno", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(marcador)).toBe("b|b|0|0|0|0");
    await page.reload();
    await expect(pregunta).toHaveCount(0);
    await expect(page.getByText("saca Bruno", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("saque-jugando-320.png") });

    const puntoA = page.getByRole("button", { name: "Sumar un punto a Ana Copa", exact: true });
    await puntoA.click();
    await expect(puntoA.getByText("1", { exact: true })).toBeVisible();
    await puntoA.click();
    await expect(page.getByText("saca Ana", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(marcador)).toBe("b|a|2|0|0|0");
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect(page.getByText("saca Bruno", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(marcador)).toBe("b|b|1|0|0|0");

    // Se gana el primer set en pantalla; el segundo lo empieza el otro jugador.
    for (let puntos = 2; puntos <= 11; puntos += 1) {
      await puntoA.click();
      await expect(puntoA.getByText(String(puntos === 11 ? 0 : puntos), { exact: true })).toBeVisible();
    }
    await expect(page.getByText("saca Ana", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(marcador)).toBe("b|a|0|0|1|0");
    expect(sql(`select historial::text from public.marcador where id='${marcador}'`)).toBe("[[11, 0]]");
  });

  test("sortear en un marcador libre guarda una única elección incluso sin puntos", async ({ page }) => {
    await page.goto(`/marcador/${libre}`);
    await exigirQueCargue(page, `/marcador/${libre}`);
    const pregunta = page.getByRole("heading", { name: "¿Quién saca primero?", exact: true });
    await expect(pregunta).toBeVisible();
    await page.getByRole("button", { name: "Sortear", exact: true }).click();
    await expect(pregunta).toHaveCount(0);
    await expect.poll(() => sql(`select primer_saque from public.marcador where id='${libre}'`)).toMatch(/^[ab]$/);
    const primero = sql(`select primer_saque from public.marcador where id='${libre}'`);
    const nombre = primero === "a" ? "Ana" : "Bruno";
    await expect(page.getByText(`saca ${nombre}`, { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(libre)).toBe(`${primero}|${primero}|0|0|0|0`);

    await page.reload();
    await expect(page.getByRole("button", { name: "Sumar un punto a Ana Libre", exact: true })).toBeVisible();
    await expect(pregunta).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sortear", exact: true })).toHaveCount(0);
    await expect(page.getByText(`saca ${nombre}`, { exact: true })).toBeVisible();
    expect(tanteo(libre)).toBe(`${primero}|${primero}|0|0|0|0`);
  });

  test("desde diez iguales el saque cambia con cada punto y deshacer lo restaura", async ({ page }) => {
    // Solo se adelanta nuestro marcador local; los puntos siguientes pasan por la UI.
    sql(`update public.marcador set primer_saque='a',saca='a',puntos_a=10,puntos_b=10,version=1
      where id='${libre}'`);
    await page.goto(`/marcador/${libre}`);
    await exigirQueCargue(page, `/marcador/${libre}`);
    await expect(page.getByText("saca Ana", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sumar un punto a Ana Libre", exact: true }).click();
    await expect(page.getByText("saca Bruno", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(libre)).toBe("a|b|11|10|0|0");
    await page.getByRole("button", { name: "Sumar un punto a Bruno Libre", exact: true }).click();
    await expect(page.getByText("saca Ana", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(libre)).toBe("a|a|11|11|0|0");
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect(page.getByText("saca Bruno", { exact: true })).toBeVisible();
    await expect.poll(() => tanteo(libre)).toBe("a|b|11|10|0|0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
