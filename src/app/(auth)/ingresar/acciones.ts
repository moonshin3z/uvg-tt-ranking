"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailDesdeCarnet, esCarnetValido, esPinValido, normalizarCarnet } from "@/lib/auth/carnet";
import { datos } from "@/lib/supabase/errores";

export type EstadoIngreso = { error?: string; carnet?: string };

export async function ingresar(_prev: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  const carnet = normalizarCarnet(String(formData.get("carnet") ?? ""));
  const pin = String(formData.get("pin") ?? "").trim();

  if (!esCarnetValido(carnet)) return { error: "Escribí tu carnet como aparece en tu credencial.", carnet };
  if (!esPinValido(pin)) return { error: "El PIN son 6 dígitos.", carnet };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: emailDesdeCarnet(carnet), password: pin });

  if (error) {
    // No distinguir "no existe" de "PIN incorrecto" para no filtrar carnets.
    return { error: "Carnet o PIN incorrectos. Si no tenés cuenta, pedila al coordinador.", carnet };
  }

  // `debe_cambiar_pin` solo se lee por `mi_perfil`: dejó de ser una columna
  // legible desde el cliente, y la función ya resuelve sola de quién habla.
  const perfil = datos(await supabase.rpc("mi_perfil"), "tu perfil");

  if (!perfil?.activo) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta está desactivada. Hablá con el coordinador.", carnet };
  }

  redirect(perfil.debe_cambiar_pin ? "/cambiar-pin" : "/");
}

/** Cierra la sesión en este teléfono y deja la pantalla de ingreso. */
export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
