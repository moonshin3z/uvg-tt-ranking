"use server";

import { revalidatePath } from "next/cache";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { emailDesdeCarnet, esCarnetValido, normalizarCarnet } from "@/lib/auth/carnet";
import { generarPin } from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EstadoAlta = { error?: string; creado?: { carnet: string; nombre: string; pin: string } };

export async function crearJugador(_prev: EstadoAlta, formData: FormData): Promise<EstadoAlta> {
  await requerirCoordinador();

  const carnet = normalizarCarnet(String(formData.get("carnet") ?? ""));
  const nombre = String(formData.get("nombre") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const rol = formData.get("rol") === "coordinador" ? "coordinador" : "jugador";

  if (!esCarnetValido(carnet)) return { error: "Carnet inválido. Usá el número de carnet o EXT-XX para externos." };
  if (nombre.length < 2 || nombre.length > 80) return { error: "Escribí el nombre completo." };

  const pin = generarPin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: emailDesdeCarnet(carnet),
    password: pin,
    email_confirm: true,
    user_metadata: { carnet, nombre, rol },
  });

  if (error) {
    const yaExiste = /already|exists|registered/i.test(error.message);
    return {
      error: yaExiste ? `El carnet ${carnet} ya tiene cuenta.` : `No se pudo crear la cuenta: ${error.message}`,
    };
  }

  revalidatePath("/admin/jugadores");
  return { creado: { carnet, nombre, pin } };
}

export type EstadoReset = { error?: string; pin?: string; carnet?: string };

export async function reiniciarPin(_prev: EstadoReset, formData: FormData): Promise<EstadoReset> {
  await requerirCoordinador();
  const id = String(formData.get("id") ?? "");
  const carnet = String(formData.get("carnet") ?? "");
  if (!id) return { error: "Jugador inválido" };

  const pin = generarPin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: pin });
  if (error) return { error: `No se pudo reiniciar: ${error.message}` };

  const supabase = await createClient();
  await supabase.from("usuario").update({ debe_cambiar_pin: true }).eq("id", id);

  return { pin, carnet };
}

export async function cambiarActivo(formData: FormData): Promise<void> {
  const sesion = await requerirCoordinador();
  const id = String(formData.get("id") ?? "");
  const activo = formData.get("activo") === "true";
  if (!id || id === sesion.authId) return; // el coordinador no se desactiva a sí mismo

  const supabase = await createClient();
  await supabase.from("usuario").update({ activo }).eq("id", id);
  revalidatePath("/admin/jugadores");
}
