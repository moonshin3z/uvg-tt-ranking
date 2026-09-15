"use server";

import { revalidatePath } from "next/cache";
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
