"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { generarSemilla, ordenarSiembra, type Participante } from "@/lib/torneos/sorteo";

export type EstadoTorneo = { error?: string; ok?: string };

function mensaje(e: { message: string } | null | undefined, porDefecto: string) {
  return e?.message?.replace(/^.*?:\s*/, "") || porDefecto;
}

const RUTA = "/admin/torneos";

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------
const entero = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const esquemaCrear = z.object({
  semestre_id: z.string().uuid("Elegí un semestre"),
  nombre: z.string().trim().min(3, "Ponele un nombre").max(60, "Nombre muy largo"),
  formato: z.enum(["llave", "grupos_y_llave"]),
  fecha: z.string().date("Fecha inválida"),
  // Los mismos límites que el CHECK de la base, para dar un mensaje entendible
  // antes de llegar a Postgres.
  sets_para_ganar: entero(1, 5),
  puntos_por_set: entero(5, 21),
  horas_autoconfirmacion: entero(0, 720),
});

export async function crearTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const parsed = esquemaCrear.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_torneo", {
    p_semestre_id: d.semestre_id,
    p_nombre: d.nombre,
    p_formato: d.formato,
    p_fecha: d.fecha,
    p_sets_para_ganar: d.sets_para_ganar,
    p_puntos_por_set: d.puntos_por_set,
    p_horas_autoconfirmacion: d.horas_autoconfirmacion === 0 ? 72 : d.horas_autoconfirmacion,
  });
  if (error || !data) return { error: mensaje(error, "No se pudo crear el torneo") };

  revalidatePath(RUTA);
  redirect(`/admin/torneos/${data.id}` as Route);
}

// ---------------------------------------------------------------------------
// Inscripción
// ---------------------------------------------------------------------------
export async function abrirInscripcion(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_inscripcion_torneo", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudo abrir la inscripción") };
  revalidatePath(`${RUTA}/${id}`);
  return { ok: "Inscripción abierta." };
}

/**
 * Guarda la lista de inscritos de una vez.
 *
 * La pantalla manda quiénes quedan marcados, no un alta o una baja a la vez.
 * Acá se compara contra lo que ya estaba y se inscribe o se saca según haga
 * falta, para que el coordinador arme la lista completa y guarde una sola vez.
 */
export async function guardarInscritos(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const torneoId = String(formData.get("torneo_id") ?? "");
  const marcados = new Set(formData.getAll("inscrito").map(String));

  const supabase = await createClient();
  const { data: actuales, error: eLee } = await supabase
    .from("torneo_inscripcion")
    .select("usuario_id")
    .eq("torneo_id", torneoId);
  if (eLee) return { error: mensaje(eLee, "No se pudo leer la inscripción") };

  const ya = new Set((actuales ?? []).map((f) => f.usuario_id));
  const agregar = [...marcados].filter((id) => !ya.has(id));
  const quitar = [...ya].filter((id) => !marcados.has(id));

  for (const id of agregar) {
    const { error } = await supabase.rpc("inscribir_en_torneo", { p_torneo_id: torneoId, p_usuario_id: id });
    if (error) return { error: mensaje(error, "No se pudo inscribir a alguien") };
  }
  for (const id of quitar) {
    const { error } = await supabase.rpc("sacar_de_torneo", { p_torneo_id: torneoId, p_usuario_id: id });
    if (error) return { error: mensaje(error, "No se pudo sacar a alguien") };
  }

  revalidatePath(`${RUTA}/${torneoId}`);
  const n = marcados.size;
  return { ok: `${n} inscrito${n === 1 ? "" : "s"}.` };
}

// ---------------------------------------------------------------------------
// Armar el cuadro
// ---------------------------------------------------------------------------
/**
 * El sorteo se hace acá, en el servidor, y se manda ya resuelto.
 *
 * La semilla queda guardada con el torneo: con ella cualquiera puede rehacer
 * el mismo sorteo y comprobar que no se acomodó a nadie. Es la misma idea que
 * en el sorteo de divisiones del ranking.
 */
export async function armarTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const torneoId = String(formData.get("torneo_id") ?? "");
  const cantGrupos = Number(formData.get("cant_grupos") ?? 0);

  const supabase = await createClient();
  const { data: inscritos, error: eLee } = await supabase
    .from("torneo_inscripcion")
    .select("usuario_id, siembra")
    .eq("torneo_id", torneoId);
  if (eLee) return { error: mensaje(eLee, "No se pudo leer la inscripción") };
  if (!inscritos || inscritos.length < 2) return { error: "Hacen falta al menos 2 inscritos." };

  const participantes: Participante[] = inscritos.map((f) => ({
    usuario_id: f.usuario_id,
    siembra: f.siembra,
  }));

  const semilla = generarSemilla();
  const orden = ordenarSiembra(participantes, semilla);

  const { error } = await supabase.rpc("armar_torneo", {
    p_torneo_id: torneoId,
    p_semilla: semilla,
    p_orden: orden,
    // En un torneo de llave directa la base ni lo mira; el 0 es solo relleno
    // porque el parámetro no tiene valor por omisión.
    p_cant_grupos: cantGrupos > 0 ? cantGrupos : 0,
  });
  if (error) return { error: mensaje(error, "No se pudo armar el torneo") };

  revalidatePath(`${RUTA}/${torneoId}`);
  revalidatePath("/");
  return { ok: `Armado con ${orden.length} jugadores. Semilla ${semilla}.` };
}

// ---------------------------------------------------------------------------
// Cierres
// ---------------------------------------------------------------------------
export async function cerrarGrupos(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_grupos", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudieron cerrar los grupos") };
  revalidatePath(`${RUTA}/${id}`);
  revalidatePath("/");
  return { ok: `Grupos cerrados. Se armaron ${data} cruces de la llave.` };
}

export async function cerrarTorneo(_prev: EstadoTorneo, formData: FormData): Promise<EstadoTorneo> {
  await requerirCoordinador();
  const id = String(formData.get("torneo_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_torneo", { p_torneo_id: id });
  if (error) return { error: mensaje(error, "No se pudo cerrar el torneo") };
  revalidatePath(`${RUTA}/${id}`);
  revalidatePath("/");
  return { ok: "Torneo cerrado." };
}
