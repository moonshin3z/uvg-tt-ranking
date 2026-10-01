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

export type EstadoSemana = { error?: string; ok?: string };

/**
 * Pasa un partido pendiente a otra semana, o lo suelta para que lo acomode la
 * app («auto»). La base no deja elegir una semana que ya pasó.
 */
export async function moverASemana(_prev: EstadoSemana, formData: FormData): Promise<EstadoSemana> {
  await requerirCoordinador();
  const partidoId = String(formData.get("partido_id") ?? "");
  const valor = String(formData.get("semana") ?? "");
  const semana = valor === "auto" ? null : Number(valor);
  if (!partidoId || (semana !== null && (!Number.isInteger(semana) || semana < 1))) {
    return { error: "Elegí una semana" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_partido_a_semana", {
    p_partido_id: partidoId,
    p_semana: semana ?? undefined,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/semana");
  revalidatePath("/partidos");
  return {
    ok:
      semana === null ? "Listo: la app lo acomoda en la próxima semana con lugar." : `Pasado a la semana ${semana}.`,
  };
}
