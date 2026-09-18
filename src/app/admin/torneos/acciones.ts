"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { generarSemilla, ordenarSiembra, type Participante } from "@/lib/torneos/sorteo";

export type EstadoTorneo = { error?: string; ok?: string };

function mensaje(e: { message: string } | null | undefined, porDefecto: string) {
  return e?.message?.replace(/^.*?:\s*/, "") || porDefecto;
}

const RUTA = "/admin/torneos";

export async function eliminarTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = z.string().uuid("Ese torneo no es válido").safeParse(formData.get("torneo_id"));
  if (!id.success) return { error: id.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_torneo", { p_torneo_id: id.data });
  if (error) return { error: mensaje(error, "No se pudo eliminar el torneo") };

  revalidatePath("/", "layout");
  redirect(RUTA);
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------
const entero = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const esquemaCrear = z.object({
  semestre_id: z.string().uuid("Elegí un semestre"),
  nombre: z.string().trim().min(3, "Ponele un nombre").max(60, "Nombre muy largo"),
  formato: z.enum(["llave", "grupos_y_llave"]),
  fecha: z.string().date("Fecha inválida"),
  // Los mismos límites que el CHECK de la base, para dar un mensaje entendible
  // antes de llegar a Postgres.
  sets_para_ganar: entero(1, 5),
  puntos_por_set: entero(5, 21),
  horas_autoconfirmacion: entero(0, 720),
});

export async function crearTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const parsed = esquemaCrear.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_torneo", {
    p_semestre_id: d.semestre_id,
    p_nombre: d.nombre,
    p_formato: d.formato,
    p_fecha: d.fecha,
    p_sets_para_ganar: d.sets_para_ganar,
    p_puntos_por_set: d.puntos_por_set,
    // Mismo caso que en el ranking: null es «nunca», y omitir el parámetro
    // haría que la base aplicara su valor por omisión.
    // El cast es por los tipos generados, que declaran el parámetro `number`
    // porque en SQL es `integer`. La base sí acepta null, y comprobado que lo
    // guarda como null: es lo que `autoconfirmar_vencidos` entiende por nunca.
    p_horas_autoconfirmacion: (d.horas_autoconfirmacion === 0 ? null : d.horas_autoconfirmacion) as unknown as number,
  });
  if (error || !data) return { error: mensaje(error, "No se pudo crear el torneo") };

  revalidatePath(RUTA);
  redirect(`/admin/torneos/${data.id}` as Route);
}

// ---------------------------------------------------------------------------
// Inscripción
// ---------------------------------------------------------------------------
export async function abrirInscripcion(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_inscripcion_torneo", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudo abrir la inscripción") };
  revalidatePath(`${RUTA}/${id}`);
  return { ok: "Inscripción abierta." };
}

/**
 * Guarda la lista de inscritos de una vez.
 *
 * La pantalla manda quiénes quedan marcados, no un alta o una baja a la vez.
 * Acá se compara contra lo que ya estaba y se inscribe o se saca según haga
 * falta, para que el coordinador arme la lista completa y guarde una sola vez.
 */
export async function guardarInscritos(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const torneoId = String(formData.get("torneo_id") ?? "");
  const marcados = new Set(formData.getAll("inscrito").map(String));

  const supabase = await createClient();
  const { data: actuales, error: eLee } = await supabase
    .from("torneo_inscripcion")
    .select("usuario_id")
    .eq("torneo_id", torneoId);
  if (eLee) return { error: mensaje(eLee, "No se pudo leer la inscripción") };

  const ya = new Set((actuales ?? []).map((f) => f.usuario_id));
  const agregar = [...marcados].filter((id) => !ya.has(id));
  const quitar = [...ya].filter((id) => !marcados.has(id));

  // No se corta en el primero que falla. Antes sí, y eso dejaba la lista a
  // medias sin decir quién había quedado afuera: el coordinador armaba el
  // cuadro creyendo que estaban todos y descubría al que faltaba cuando ya
  // estaba sorteado.
  const fallaron: string[] = [];
  for (const id of agregar) {
    const { error } = await supabase.rpc("inscribir_en_torneo", { p_torneo_id: torneoId, p_usuario_id: id });
    if (error) fallaron.push(`inscribir (${mensaje(error, "falló")})`);
  }
  for (const id of quitar) {
    const { error } = await supabase.rpc("sacar_de_torneo", { p_torneo_id: torneoId, p_usuario_id: id });
    if (error) fallaron.push(`sacar (${mensaje(error, "falló")})`);
  }

  revalidatePath(`${RUTA}/${torneoId}`);

  // El número que se reporta sale de la base, no de lo que se marcó: si algo
  // falló, lo que importa es cuántos quedaron de verdad.
  const conteo = await supabase
    .from("torneo_inscripcion")
    .select("usuario_id", { count: "exact", head: true })
    .eq("torneo_id", torneoId);
  if (conteo.error) return { error: mensaje(conteo.error, "No se pudo contar la inscripción") };
  const n = conteo.count ?? 0;

  if (fallaron.length > 0) {
    return {
      error: `Quedaron ${n} inscrito${n === 1 ? "" : "s"}, pero ${fallaron.length} operación${fallaron.length === 1 ? "" : "es"} falló: ${fallaron.join("; ")}`,
    };
  }
  return { ok: `${n} inscrito${n === 1 ? "" : "s"}.` };
}

// ---------------------------------------------------------------------------
// Armar el cuadro
// ---------------------------------------------------------------------------
/**
 * El orden se decide acá, en el servidor, y se manda ya resuelto.
 *
 * En modo sorteo la semilla permite rehacer el resultado. En modo manual se
 * guarda la marca `manual` y la lista completa queda en `torneo_sorteo.resultado`.
 */
export async function armarTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const torneoId = String(formData.get("torneo_id") ?? "");
  const cantGrupos = Number(formData.get("cant_grupos") ?? 0);

  const supabase = await createClient();
  const { data: inscritos, error: eLee } = await supabase
    .from("torneo_inscripcion")
    .select("usuario_id, siembra")
    .eq("torneo_id", torneoId);
  if (eLee) return { error: mensaje(eLee, "No se pudo leer la inscripción") };
  if (!inscritos || inscritos.length < 2) return { error: "Hacen falta al menos 2 inscritos." };

  const participantes: Participante[] = inscritos.map((f) => ({
    usuario_id: f.usuario_id,
    siembra: f.siembra,
  }));

  const modo = String(formData.get("modo") ?? "sorteo");
  const esManual = modo === "manual";
  const semilla = esManual ? "manual" : generarSemilla();
  let orden: string[];

  if (esManual) {
    const ordenEnviado = formData.getAll("orden").map(String).filter(Boolean);
    const inscritosSet = new Set(inscritos.map((f) => f.usuario_id));
    const ordenSet = new Set(ordenEnviado);
    if (
      ordenEnviado.length !== inscritos.length ||
      ordenSet.size !== inscritos.length ||
      ordenEnviado.some((id) => !inscritosSet.has(id))
    ) {
      return { error: "La siembra manual tiene que incluir una sola vez a cada inscrito." };
    }
    // El helper valida la posición y deja una sola forma de construir el
    // arreglo que recibe la función SQL.
    orden = ordenarSiembra(
      ordenEnviado.map((usuario_id, i) => ({ usuario_id, siembra: i + 1 })),
      semilla,
    );
  } else {
    orden = ordenarSiembra(participantes, semilla);
  }

  const { error } = await supabase.rpc("armar_torneo", {
    p_torneo_id: torneoId,
    p_semilla: semilla,
    p_orden: orden,
    // En un torneo de llave directa la base ni lo mira; el 0 es solo relleno
    // porque el parámetro no tiene valor por omisión.
    p_cant_grupos: cantGrupos > 0 ? cantGrupos : 0,
  });
  if (error) return { error: mensaje(error, "No se pudo armar el torneo") };

  revalidatePath(`${RUTA}/${torneoId}`);
  revalidatePath("/");
  return {
    ok: esManual
      ? `Armado con ${orden.length} jugadores. Siembra manual guardada.`
      : `Armado con ${orden.length} jugadores. Semilla ${semilla}.`,
  };
}

// ---------------------------------------------------------------------------
// Cierres
// ---------------------------------------------------------------------------
export async function cerrarGrupos(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_grupos", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudieron cerrar los grupos") };
  revalidatePath(`${RUTA}/${id}`);
  revalidatePath("/");
  return { ok: `Grupos cerrados. Se armaron ${data} cruces de la llave.` };
}

export async function cerrarTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_torneo", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudo cerrar el torneo") };
  revalidatePath(`${RUTA}/${id}`);
  revalidatePath("/");
  return { ok: "Torneo cerrado." };
}
