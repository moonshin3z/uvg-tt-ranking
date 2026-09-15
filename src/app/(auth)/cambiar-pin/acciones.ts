"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerirSesion } from "@/lib/auth/sesion";
import { esPinValido } from "@/lib/auth/carnet";

export type EstadoCambioPin = { error?: string };

export async function cambiarPin(_prev: EstadoCambioPin, formData: FormData): Promise<EstadoCambioPin> {
  const sesion = await requerirSesion();
  const pin = String(formData.get("pin") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();

  if (!esPinValido(pin)) return { error: "El PIN nuevo debe tener 6 dígitos." };
  if (pin !== confirmacion) return { error: "Los dos PIN no coinciden." };
  if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "000000") {
    return { error: "Elegí un PIN menos obvio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pin });
  if (error) return { error: "No se pudo cambiar el PIN. Intentá de nuevo." };

  const { error: errorPerfil } = await supabase
    .from("usuario")
    .update({ debe_cambiar_pin: false })
    .eq("id", sesion.authId);
  if (errorPerfil) return { error: "El PIN cambió pero no se pudo actualizar tu perfil. Avisale al coordinador." };

  redirect("/");
}
