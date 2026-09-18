import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const raiz = fileURLToPath(new URL("../", import.meta.url));
const archivo = join(raiz, "src/lib/supabase/database.types.ts");
const temporal = `${archivo}.${process.pid}.tmp`;
const soloComprobar = process.argv.includes("--check");
const cliLocal = join(raiz, "node_modules/supabase/dist/supabase.js");

function supabase(args) {
  // npm instala un lanzador JS; invocarlo directamente también funciona en
  // Windows, donde spawnSync no puede ejecutar el .cmd sin un shell.
  const local = existsSync(cliLocal);
  const resultado = spawnSync(local ? process.execPath : "supabase", local ? [cliLocal, ...args] : args, {
    cwd: raiz,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (resultado.error || resultado.status !== 0) {
    throw new Error(resultado.error?.message || resultado.stderr?.trim() || "Falló Supabase CLI.");
  }
  return resultado.stdout;
}

try {
  // --local también en la lista: el campo remote de esta respuesta representa
  // lo aplicado en la base LOCAL, no el proyecto de producción.
  const { migrations } = JSON.parse(supabase(["migration", "list", "--local", "--output-format", "json"]));
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error("No se pudo verificar el estado de las migraciones locales.");
  }
  if (migrations.some((m) => !m.local || m.local !== m.remote)) {
    throw new Error(
      "La base local no coincide con las migraciones. Corré npm run db:reset antes de regenerar tipos.",
    );
  }

  const tipos = supabase(["gen", "types", "typescript", "--local", "--schema", "public"]);
  if (!tipos.includes("export type Database = {") || !tipos.includes("export type Json =")) {
    throw new Error("Supabase no devolvió tipos válidos; se conserva el archivo anterior.");
  }

  // Git puede convertir LF a CRLF en Windows. Eso no cambia el esquema.
  const normalizar = (texto) => texto.replace(/\r\n/g, "\n");
  if (soloComprobar) {
    if (normalizar(readFileSync(archivo, "utf8")) !== normalizar(tipos)) {
      throw new Error("Los tipos están desactualizados. Corré npm run db:types y guardá el archivo generado en Git.");
    }
    console.log("Los tipos coinciden con la base local y sus migraciones.");
  } else {
    // La redirección de shell truncaba el archivo incluso si Supabase fallaba.
    // Reemplazamos solo después de generar y validar la salida completa.
    writeFileSync(temporal, tipos, "utf8");
    renameSync(temporal, archivo);
    console.log("Tipos regenerados desde la base local completa.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(temporal, { force: true });
}
