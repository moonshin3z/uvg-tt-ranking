"use server";

import { revalidatePath } from "next/cache";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";

export type EstadoResolver = { error?: string; ok?: string };

export async function resolverPartido(_prev: EstadoResolver, formData: FormData): Promise<EstadoResolver> {
  await requerirCoordinador();
  const partidoId = String(formData.get("partido_id") ?? "");
  const decision = String(formData.get("decision") ?? ""); // uuid del ganador | "anular"
  const nota = String(formData.get("nota") ?? "").trim();
  if (!partidoId || !decision) return { error: "Elegí una decisión" };

  const supabase = await createClient();
  // Dos funciones distintas: anular no lleva ganador, así ningún argumento es nulo.
  const { error } =
    decision === "anular"
      ? await supabase.rpc("anular_partido", { p_partido_id: partidoId, p_nota: nota })
      : await supabase.rpc("resolver_partido", { p_partido_id: partidoId, p_ganador: decision, p_nota: nota });

  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/");
  revalidatePath("/partidos");
  revalidatePath("/admin/partidos");
  return { ok: decision === "anular" ? "Partido anulado" : "Resuelto" };
}
