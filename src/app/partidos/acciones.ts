"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";

export type EstadoResultado = { error?: string; ok?: string };

function limpiar(msg: string | undefined, porDefecto: string) {
  return msg?.replace(/^.*?:\s*/, "") || porDefecto;
}

function revalidar(partidoId: string) {
  revalidatePath("/");
  revalidatePath("/partidos");
  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/admin/partidos");
}

function entero(valor: FormDataEntryValue | null): number | null {
  const s = String(valor ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

/**
 * Lee los puntos por set (opcionales). Devuelve null si no se llenó ninguno,
 * o un error si están a medias. Los nombres vienen en orden canónico (a, b).
 */
function leerPuntos(formData: FormData, totalSets: number): [number, number][] | null | { error: string } {
  const puntos: [number, number][] = [];
  for (let i = 1; i <= totalSets; i++) {
    const a = entero(formData.get(`set${i}a`));
    const b = entero(formData.get(`set${i}b`));
    const vacioA = String(formData.get(`set${i}a`) ?? "").trim() === "";
    const vacioB = String(formData.get(`set${i}b`) ?? "").trim() === "";
    if (vacioA && vacioB) continue;
    if (a === null || b === null) return { error: `Revisá los puntos del set ${i}` };
    if (a === b) return { error: `El set ${i} no puede quedar empatado` };
    puntos.push([a, b]);
  }
  if (puntos.length === 0) return null;
  if (puntos.length !== totalSets) return { error: "Completá los puntos de todos los sets, o dejalos todos vacíos" };
  return puntos;
}

export async function registrarResultado(_prev: EstadoResultado, formData: FormData): Promise<EstadoResultado> {
  await requerirSesion();
  const partidoId = String(formData.get("partido_id") ?? "");
  const setsA = entero(formData.get("sets_a"));
  const setsB = entero(formData.get("sets_b"));

  if (!partidoId) return { error: "Partido inválido" };
  if (setsA === null || setsB === null) return { error: "Poné cuántos sets ganó cada uno" };
  if (setsA === setsB) return { error: "Un partido no puede terminar empatado en sets" };

  const puntos = leerPuntos(formData, setsA + setsB);
  if (puntos && !Array.isArray(puntos)) return { error: puntos.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_resultado", {
    p_partido_id: partidoId,
    p_sets_a: setsA,
    p_sets_b: setsB,
    p_puntos: puntos ?? undefined,
  });
  if (error) return { error: limpiar(error.message, "No se pudo registrar") };

  revalidar(partidoId);
  redirect("/partidos?registrado=1");
}

export async function confirmarResultado(_prev: EstadoResultado, formData: FormData): Promise<EstadoResultado> {
  await requerirSesion();
  const partidoId = String(formData.get("partido_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_resultado", { p_partido_id: partidoId });
  if (error) return { error: limpiar(error.message, "No se pudo confirmar") };
  revalidar(partidoId);
  return { ok: "Resultado confirmado" };
}

export async function disputarResultado(_prev: EstadoResultado, formData: FormData): Promise<EstadoResultado> {
  await requerirSesion();
  const partidoId = String(formData.get("partido_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { error: "Explicá brevemente qué pasó" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("disputar_resultado", { p_partido_id: partidoId, p_motivo: motivo });
  if (error) return { error: limpiar(error.message, "No se pudo disputar") };
  revalidar(partidoId);
  return { ok: "Disputa enviada al coordinador" };
}

// ---------------------------------------------------------------------------
// Marcador en vivo
// ---------------------------------------------------------------------------

/**
 * Abre el marcador de un partido y manda a la pantalla del marcador.
 *
 * Si ya hay uno en juego para ese partido, la base devuelve el mismo en vez de
 * crear otro, así que entrar dos veces no duplica nada.
 */
export async function abrirMarcador(formData: FormData): Promise<void> {
  await requerirSesion();
  const partidoId = String(formData.get("partido_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_marcador_de_partido", { p_partido_id: partidoId });
  if (error || !data) redirect(`/partidos/${partidoId}?marcador=no`);
  redirect(`/marcador/${data.id}`);
}

export type EstadoMarcadorLibre = { error?: string };

/**
 * Abre un marcador para un partido que no es del ranking.
 *
 * No exige que el rival tenga cuenta: son dos nombres escritos a mano. Lo que
 * se anote acá no toca la tabla ni queda como partido; es la aplicación usada
 * solo como marcador, que era una de las cosas que tenía que hacer desde el
 * principio.
 */
export async function abrirMarcadorLibre(
  _prev: EstadoMarcadorLibre,
  formData: FormData,
): Promise<EstadoMarcadorLibre> {
  await requerirSesion();
  const nombreA = String(formData.get("nombre_a") ?? "").trim();
  const nombreB = String(formData.get("nombre_b") ?? "").trim();
  if (!nombreA || !nombreB) return { error: "Poné los dos nombres." };

  const sets = Number(formData.get("sets_para_ganar") ?? 2);
  const puntos = Number(formData.get("puntos_por_set") ?? 11);
  if (!Number.isInteger(sets) || sets < 1 || sets > 5) return { error: "Formato inválido." };
  if (!Number.isInteger(puntos) || puntos < 5 || puntos > 21) return { error: "Puntos por set inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_marcador_libre", {
    p_nombre_a: nombreA,
    p_nombre_b: nombreB,
    p_sets_para_ganar: sets,
    p_puntos_por_set: puntos,
  });
  if (error || !data) return { error: error?.message.replace(/^.*?:\s*/, "") ?? "No se pudo abrir el marcador." };

  redirect(`/marcador/${data.id}` as Route);
}

/**
 * Manda una foto del marcador.
 *
 * El protocolo es de foto completa con versión: el teléfono que anota lleva su
 * propio contador y manda el estado entero. El servidor descarta las fotos
 * viejas, así que si una llega tarde no retrocede el marcador. Por eso acá no
 * se hace nada si falla: el punto siguiente manda una foto más nueva y se
 * pone al día solo.
 */
export async function sincronizarMarcador(entrada: {
  marcadorId: string;
  version: number;
  puntosA: number;
  puntosB: number;
  setsA: number;
  setsB: number;
  historial: [number, number][];
  saca: "a" | "b";
  estado: "en_juego" | "terminado";
}): Promise<{ error?: string; aviso?: string | null }> {
  await requerirSesion();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sincronizar_marcador", {
    p_marcador_id: entrada.marcadorId,
    p_version: entrada.version,
    p_puntos_a: entrada.puntosA,
    p_puntos_b: entrada.puntosB,
    p_sets_a: entrada.setsA,
    p_sets_b: entrada.setsB,
    p_historial: entrada.historial,
    p_saca: entrada.saca,
    p_estado: entrada.estado,
  });
  if (error) return { error: error.message };
  return { aviso: data?.aviso ?? null };
}
