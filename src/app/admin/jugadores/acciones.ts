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
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: emailDesdeCarnet(carnet),
    password: pin,
    email_confirm: true,
    user_metadata: { carnet, nombre },
  });

  if (error) {
    const yaExiste = /already|exists|registered/i.test(error.message);
    return {
      error: yaExiste ? `El carnet ${carnet} ya tiene cuenta.` : `No se pudo crear la cuenta: ${error.message}`,
    };
  }

  // El rol ya no viaja en el metadata de auth. Ese metadata es lo que manda
  // quien se registra, así que con el registro abierto alcanzaba para darse de
  // alta como coordinador. Ahora todo perfil nace jugador y el ascenso pasa
  // por una función que exige ser coordinador.
  if (rol === "coordinador" && creado.user) {
    const supabase = await createClient();
    const { error: errorRol } = await supabase.rpc("asignar_rol", {
      p_usuario_id: creado.user.id,
      p_rol: "coordinador",
    });
    if (errorRol) {
      return {
        error: `La cuenta de ${carnet} quedó creada como jugador; no se pudo nombrarla coordinadora: ${errorRol.message}`,
      };
    }
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

  // Son dos escrituras y la segunda puede fallar sola. Sin mirar su error se
  // mostraba un PIN nuevo con la bandera sin levantar: el jugador entraba con
  // ese PIN y nadie le pedía cambiarlo.
  const supabase = await createClient();
  const { error: eBandera } = await supabase.from("usuario").update({ debe_cambiar_pin: true }).eq("id", id);
  if (eBandera) {
    return {
      error: `El PIN nuevo es ${pin}, pero no se pudo marcar que tiene que cambiarlo: ${eBandera.message}`,
      pin,
      carnet,
    };
  }

  revalidatePath("/admin/jugadores");
  return { pin, carnet };
}

export async function cambiarActivo(formData: FormData): Promise<void> {
  const sesion = await requerirCoordinador();
  const id = String(formData.get("id") ?? "");
  const activo = formData.get("activo") === "true";
  if (!id || id === sesion.authId) return; // el coordinador no se desactiva a sí mismo

  const supabase = await createClient();
  const { error } = await supabase.from("usuario").update({ activo }).eq("id", id);
  // No devuelve estado, así que lo único honesto es no callarlo: sin esto, dar
  // de baja a alguien podía no pasar y la pantalla se veía igual.
  if (error) throw new Error(`No se pudo cambiar el estado del jugador: ${error.message}`);
  revalidatePath("/admin/jugadores");
}

// ---------------------------------------------------------------------------
// Retiro de un jugador del ranking en curso
// ---------------------------------------------------------------------------
export type ImpactoRetiro = {
  rival: string;
  estado: string;
  gano_el_rival: boolean;
  puntos_que_pierde: number;
};

export type EstadoRetiro = {
  error?: string;
  ok?: string;
  /** Paso 1: lo que se va a anular, para que el coordinador lo confirme. */
  impacto?: { usuarioId: string; nombre: string; rankingId: string; filas: ImpactoRetiro[] };
};

/** Paso 1: no cambia nada, solo calcula y muestra las consecuencias. */
export async function consultarImpacto(_prev: EstadoRetiro, formData: FormData): Promise<EstadoRetiro> {
  await requerirCoordinador();
  const usuarioId = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const rankingId = String(formData.get("ranking_id") ?? "");
  if (!usuarioId || !rankingId) return { error: "Falta información del jugador o del ranking" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("impacto_retiro", {
    p_ranking_id: rankingId,
    p_usuario_id: usuarioId,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  return { impacto: { usuarioId, nombre, rankingId, filas: (data ?? []) as ImpactoRetiro[] } };
}

/**
 * Deshace un retiro: lo vuelve a inscribir y repone sus partidos anulados tal
 * como estaban antes, leyendo la bitácora.
 *
 * Va en un solo paso, al revés que el retiro. Retirar destruye resultados y por
 * eso se confirma; esto los devuelve, y el peor caso de apretarlo por error es
 * volver a retirar a alguien.
 */
export async function deshacerRetiro(_prev: EstadoRetiro, formData: FormData): Promise<EstadoRetiro> {
  await requerirCoordinador();
  const usuarioId = String(formData.get("id") ?? "");
  const rankingId = String(formData.get("ranking_id") ?? "");
  if (!usuarioId || !rankingId) return { error: "Falta información del jugador o del ranking" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deshacer_retiro", {
    p_ranking_id: rankingId,
    p_usuario_id: usuarioId,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/admin/jugadores");
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/partidos");
  revalidatePath("/");
  return {
    ok:
      data === 0
        ? "Vuelve a estar en la tabla. No había partidos que reponer."
        : `Vuelve a estar en la tabla. Se repusieron ${data} partidos.`,
  };
}

/** Paso 2: ejecuta. Anula todos sus partidos y lo saca de la tabla. */
export async function retirarDelRanking(_prev: EstadoRetiro, formData: FormData): Promise<EstadoRetiro> {
  await requerirCoordinador();
  const usuarioId = String(formData.get("id") ?? "");
  const rankingId = String(formData.get("ranking_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retirar_del_ranking", {
    p_ranking_id: rankingId,
    p_usuario_id: usuarioId,
    p_motivo: motivo,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/admin/jugadores");
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/partidos");
  revalidatePath("/");
  return { ok: `Retirado. Se anularon ${data} partidos.` };
}
