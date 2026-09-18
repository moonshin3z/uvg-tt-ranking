"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";

export type EstadoBaja = { error?: string; ok?: string };

const esquema = z.object({
  tipo: z.enum(["ranking", "torneo"]),
  id: z.string().uuid(),
  motivo: z.string().trim().max(300, "El motivo es muy largo"),
  confirmacion: z.string().trim().default(""),
});

function mensaje(e: { message: string } | null | undefined, porDefecto: string) {
  return e?.message?.replace(/^.*?:\s*/, "") || porDefecto;
}

/**
 * El nombre escrito a mano tiene que coincidir con el real.
 *
 * La comprobación también vive en el cliente para que el botón se habilite
 * solo cuando corresponde, pero esa es de cortesía: la que cuenta es esta,
 * porque cualquiera puede mandar el formulario sin pasar por la pantalla.
 */
async function nombreReal(tipo: "ranking" | "torneo", id: string): Promise<string | null> {
  const supabase = await createClient();
  const respuesta =
    tipo === "ranking"
      ? await supabase.from("ranking").select("nombre").eq("id", id).maybeSingle()
      : await supabase.from("torneo").select("nombre").eq("id", id).maybeSingle();
  return respuesta.data?.nombre ?? null;
}

export async function eliminar(_prev: EstadoBaja, formData: FormData): Promise<EstadoBaja> {
  await requerirCoordinador();
  const parsed = esquema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tipo, id, motivo, confirmacion } = parsed.data;

  const nombre = await nombreReal(tipo, id);
  if (nombre === null) return { error: `Ese ${tipo} ya no existe` };
  if (confirmacion !== nombre) {
    return { error: `Para borrarlo escribí el nombre exacto: ${nombre}` };
  }

  const supabase = await createClient();
  const { error } =
    tipo === "ranking"
      ? await supabase.rpc("eliminar_ranking", { p_ranking_id: id, p_motivo: motivo || undefined })
      : await supabase.rpc("eliminar_torneo", { p_torneo_id: id, p_motivo: motivo || undefined });
  if (error) return { error: mensaje(error, "No se pudo borrar") };

  revalidatePath("/");
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/torneos");
  revalidatePath("/partidos");
  redirect(tipo === "ranking" ? "/admin/ranking" : "/admin/torneos");
}

export async function cancelar(_prev: EstadoBaja, formData: FormData): Promise<EstadoBaja> {
  await requerirCoordinador();
  const parsed = esquema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tipo, id, motivo } = parsed.data;

  if (motivo === "") return { error: "Escribí por qué lo cancelás: queda en el registro" };

  const supabase = await createClient();
  const { error } =
    tipo === "ranking"
      ? await supabase.rpc("cancelar_ranking", { p_ranking_id: id, p_motivo: motivo })
      : await supabase.rpc("cancelar_torneo", { p_torneo_id: id, p_motivo: motivo });
  if (error) return { error: mensaje(error, "No se pudo cancelar") };

  revalidatePath("/");
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/torneos");
  revalidatePath("/partidos");
  redirect(tipo === "ranking" ? "/admin/ranking" : "/admin/torneos");
}
