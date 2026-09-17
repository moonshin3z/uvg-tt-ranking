/**
 * Corre las pruebas SQL de supabase/pruebas/ contra la base local.
 *
 * No usa `psql` del sistema: en Windows no viene instalado. Usa el que ya está
 * dentro del contenedor de Postgres que levanta `supabase start`, así que lo
 * único que hace falta es tener la base local corriendo.
 *
 *   npm run test:sql              todas
 *   npm run test:sql permisos     solo una
 *
 * Cada archivo corre entero dentro de una transacción que se revierte, así que
 * no deja nada en la base.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/pruebas";

function contenedor() {
  let salida;
  try {
    salida = execFileSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fallar(
      "No pude hablar con Docker.",
      "Las pruebas SQL corren dentro del contenedor de Postgres de Supabase,",
      "así que hace falta Docker Desktop abierto y la base local levantada:",
      "",
      "    npm run db:start",
    );
  }
  const nombre = salida.trim().split("\n").filter(Boolean)[0];
  if (!nombre) {
    fallar(
      "La base local de Supabase no está corriendo.",
      "",
      "    npm run db:start",
    );
  }
  return nombre;
}

function fallar(...lineas) {
  console.error("\n" + lineas.join("\n") + "\n");
  process.exit(1);
}

const filtro = process.argv[2];
const archivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !filtro || f.includes(filtro))
  .sort();

if (archivos.length === 0) fallar(`No encontré pruebas en ${DIR}` + (filtro ? ` que coincidan con "${filtro}"` : ""));

const db = contenedor();
let fallaron = 0;
let pasaron = 0;

for (const archivo of archivos) {
  const sql = readFileSync(join(DIR, archivo), "utf8");
  const r = spawnSync(
    "docker",
    ["exec", "-i", db, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: sql, encoding: "utf8" },
  );

  const salida = (r.stdout ?? "") + (r.stderr ?? "");
  // psql manda los `raise notice` a stderr, que es donde vienen los "ok ·".
  const oks = salida.split("\n").filter((l) => l.includes("ok · "));
  const errores = salida.split("\n").filter((l) => /ERROR:/.test(l));

  if (r.status === 0 && errores.length === 0) {
    pasaron += oks.length;
    console.log(`\n${archivo}`);
    for (const l of oks) console.log("  " + l.replace(/^.*ok · /, "ok · "));
  } else {
    fallaron += 1;
    console.log(`\n${archivo}  ← FALLÓ`);
    for (const l of oks) console.log("  " + l.replace(/^.*ok · /, "ok · "));
    for (const l of errores) console.log("  " + l.replace(/^psql:[^ ]* /, ""));
  }
}

console.log(
  `\n${pasaron} comprobaciones pasaron` + (fallaron ? `, ${fallaron} archivo(s) con fallas` : "") + "\n",
);
process.exit(fallaron ? 1 : 0);
