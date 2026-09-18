"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerirSesion } from "@/lib/auth/sesion";
import { esPinValido } from "@/lib/auth/carnet";

export type EstadoCambioPin = { error?: string };

/** La base valida lo mismo que el formulario; si igual rebota, se muestra tal cual. */
function mensajeDeCambioDePin(mensaje: string): string {
  if (/menos obvio/i.test(mensaje)) return "Elegí un PIN menos obvio.";
  if (/6 d/i.test(mensaje)) return "El PIN nuevo debe tener 6 dígitos.";
  return "No se pudo cambiar el PIN. Intentá de nuevo.";
}

export async function cambiarPin(_prev: EstadoCambioPin, formData: FormData): Promise<EstadoCambioPin> {
  const sesion = await requerirSesion();
  const pin = String(formData.get("pin") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();

  if (!esPinValido(pin)) return { error: "El PIN nuevo debe tener 6 dígitos." };
  if (pin !== confirmacion) return { error: "Los dos PIN no coinciden." };
  if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "000000") {
    return { error: "Elegí un PIN menos obvio." };
  }

  // Un solo paso, del lado del servidor. Antes eran dos (cambiar la
  // contraseña y después bajar la bandera), y al ser dos el segundo se podía
  // hacer sin el primero: un jugador se quitaba la obligación de cambiar el
  // PIN y seguía con el que el coordinador le había dictado.
  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_mi_pin", { p_nuevo: pin });
  if (error) return { error: mensajeDeCambioDePin(error.message) };

  // Primer ingreso: al jugador le mostramos qué hacer ahora; al coordinador,
  // su panel.
  if (sesion.usuario.rol === "coordinador") redirect("/admin/ranking");
  // La consulta de la sesión que se hizo antes de la RPC está memoizada en
  // este request y todavía puede traer la bandera vieja. La RPC ya terminó y
  // dejó `debe_cambiar_pin = false`; decidir el destino con ese dato viejo
  // hacía que el primer ingreso volviera a `/cambiar-pin` en un bucle.
  redirect("/partidos?bienvenida=1");
}
