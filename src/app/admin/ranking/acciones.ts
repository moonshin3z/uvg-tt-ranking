"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { generarSemilla, sortearDivisiones, type Asignacion } from "@/lib/ranking/sorteo";

export type EstadoAccion = { error?: string; ok?: string };

const RUTA = "/admin/ranking";

function mensaje(e: { message: string } | null | undefined, porDefecto: string) {
  return e?.message?.replace(/^.*?:\s*/, "") || porDefecto;
}

// ---------------------------------------------------------------------------
// Semestre
// ---------------------------------------------------------------------------
const esquemaSemestre = z
  .object({
    nombre: z
      .string()
      .trim()
      .regex(/^\d{4}-[12]$/, "Formato: 2026-2"),
    inicio: z.string().date("Fecha de inicio inválida"),
    fin: z.string().date("Fecha de fin inválida"),
  })
  .refine((s) => s.fin > s.inicio, { message: "El fin debe ser después del inicio", path: ["fin"] });

export async function crearSemestre(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const parsed = esquemaSemestre.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("semestre").insert(parsed.data);
  if (error) return { error: mensaje(error, "No se pudo crear el semestre") };

  revalidatePath(RUTA);
  return { ok: `Semestre ${parsed.data.nombre} creado` };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
const entero = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const esquemaRanking = z.object({
  semestre_id: z.string().uuid("Elegí un semestre"),
  numero: entero(1, 2),
  fecha_limite: z.string().date("Fecha límite inválida"),
  pts_victoria: entero(0, 10),
  pts_derrota: entero(0, 10),
  n_premiados: entero(0, 10),
  n_ascienden: entero(0, 10),
  n_descienden: entero(0, 10),
  horas_autoconfirmacion: z.coerce.number().int().min(0).max(720),
  // Los límites son los del CHECK `ranking_reglas_juego` de la base. Acá se
  // repiten para dar un mensaje entendible antes de llegar a Postgres.
  sets_para_ganar: entero(1, 5),
  puntos_por_set: entero(5, 21),
});

export async function crearRanking(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const parsed = esquemaRanking.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: semestre } = await supabase.from("semestre").select("nombre").eq("id", d.semestre_id).maybeSingle();
  if (!semestre) return { error: "Semestre no encontrado" };

  const { error } = await supabase.rpc("crear_ranking", {
    p_semestre_id: d.semestre_id,
    p_numero: d.numero,
    p_nombre: `Ranking ${d.numero} · ${semestre.nombre}`,
    p_fecha_limite: d.fecha_limite,
    p_pts_victoria: d.pts_victoria,
    p_pts_derrota: d.pts_derrota,
    p_n_premiados: d.n_premiados,
    p_n_ascienden: d.n_ascienden,
    p_n_descienden: d.n_descienden,
    // null, no undefined. `undefined` no viaja en el JSON, PostgREST no manda
    // el parámetro, y la función aplica su valor por omisión de 72 horas: el
    // coordinador pedía «nunca» y le quedaba autoconfirmación a los 3 días.
    // `autoconfirmar_vencidos` salta los rankings con la columna en null.
    // El cast es por los tipos generados, que declaran el parámetro `number`
    // porque en SQL es `integer`. La base sí acepta null, y comprobado que lo
    // guarda como null: es lo que `autoconfirmar_vencidos` entiende por nunca.
    p_horas_autoconfirmacion: (d.horas_autoconfirmacion === 0 ? null : d.horas_autoconfirmacion) as unknown as number,
    p_sets_para_ganar: d.sets_para_ganar,
    p_puntos_por_set: d.puntos_por_set,
  });
  if (error) return { error: mensaje(error, "No se pudo crear el ranking") };

  revalidatePath(RUTA);
  return { ok: "Ranking creado en borrador" };
}

// ---------------------------------------------------------------------------
// Divisiones: sorteo o manual
// ---------------------------------------------------------------------------
function leerAsignacion(formData: FormData): { ranking_id: string; filas: { id: string; division: string }[] } {
  const ranking_id = String(formData.get("ranking_id") ?? "");
  const participa = formData.getAll("participa").map(String);
  const filas = participa.map((id) => ({ id, division: String(formData.get(`division:${id}`) ?? "") }));
  return { ranking_id, filas };
}

async function guardarAsignacion(ranking_id: string, asignacion: Asignacion[], semilla: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("armar_divisiones", {
    p_ranking_id: ranking_id,
    p_asignacion: asignacion,
    p_semilla: semilla ?? undefined,
  });
  if (error) return { error: mensaje(error, "No se pudo guardar la asignación") };
  revalidatePath(RUTA);
  return { ok: `${data} jugadores inscritos${semilla ? ` (semilla ${semilla})` : ""}` };
}

export async function sortear(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const { ranking_id, filas } = leerAsignacion(formData);
  if (filas.length < 4) return { error: "Marcá al menos 4 jugadores para sortear" };

  const semilla = generarSemilla();
  const asignacion = sortearDivisiones(
    filas.map((f) => f.id),
    semilla,
  );
  return guardarAsignacion(ranking_id, asignacion, semilla);
}

export async function asignarManual(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const { ranking_id, filas } = leerAsignacion(formData);
  if (filas.length < 4) return { error: "Marcá al menos 4 jugadores" };
  const sinDivision = filas.filter((f) => f.division !== "mayor" && f.division !== "menor");
  if (sinDivision.length > 0) return { error: "Asigná división a todos los marcados (o usá Sortear)" };

  const asignacion: Asignacion[] = filas.map((f) => ({
    usuario_id: f.id,
    division: f.division as "mayor" | "menor",
  }));
  return guardarAsignacion(ranking_id, asignacion, null);
}

// ---------------------------------------------------------------------------
// Calendario y apertura
// ---------------------------------------------------------------------------
export async function generarCalendario(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_calendario", {
    p_ranking_id: String(formData.get("ranking_id") ?? ""),
  });
  if (error) return { error: mensaje(error, "No se pudo generar el calendario") };
  revalidatePath(RUTA);
  return { ok: `${data} partidos generados` };
}

export async function abrirRanking(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_ranking", { p_ranking_id: String(formData.get("ranking_id") ?? "") });
  if (error) return { error: mensaje(error, "No se pudo abrir el ranking") };
  revalidatePath(RUTA);
  revalidatePath("/");
  return { ok: "Ranking abierto. Ya aparece en la portada." };
}

// ---------------------------------------------------------------------------
// Cierre del ranking (fase 4)
// ---------------------------------------------------------------------------
export async function cerrarFaseRegular(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_fase_regular", {
    p_ranking_id: String(formData.get("ranking_id") ?? ""),
  });
  if (error) return { error: mensaje(error, "No se pudo cerrar la fase regular") };
  revalidatePath(RUTA);
  revalidatePath("/");
  return {
    ok:
      data && data > 0
        ? `Fase regular cerrada. Hay ${data} empate${data === 1 ? "" : "s"} que romper.`
        : "Fase regular cerrada, sin empates. Ya podés cerrar el ranking.",
  };
}

export async function generarDesempates(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_desempates", {
    p_ranking_id: String(formData.get("ranking_id") ?? ""),
  });
  if (error) return { error: mensaje(error, "No se pudieron generar los desempates") };
  revalidatePath(RUTA);
  revalidatePath("/partidos");
  return { ok: `${data} partidos de desempate creados. Ya les aparecen a los jugadores.` };
}

export async function cerrarRanking(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_ranking", {
    p_ranking_id: String(formData.get("ranking_id") ?? ""),
  });
  if (error) return { error: mensaje(error, "No se pudo cerrar el ranking") };
  revalidatePath(RUTA);
  revalidatePath("/");
  return { ok: "Ranking cerrado. Abajo está la propuesta para el siguiente." };
}

const esquemaSiguiente = z.object({
  ranking_anterior: z.string().uuid(),
  semestre_id: z.string().uuid("Elegí un semestre"),
  numero: entero(1, 2),
  fecha_limite: z.string().date("Fecha límite inválida"),
});

export async function crearRankingSiguiente(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const parsed = esquemaSiguiente.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_ranking_siguiente", {
    p_ranking_anterior: d.ranking_anterior,
    p_semestre_id: d.semestre_id,
    p_numero: d.numero,
    p_fecha_limite: d.fecha_limite,
  });
  if (error) return { error: mensaje(error, "No se pudo crear el ranking siguiente") };
  revalidatePath(RUTA);
  revalidatePath("/");
  return { ok: "Ranking siguiente creado en borrador con los ascensos y descensos aplicados." };
}

/**
 * Último recurso de un desempate: el coordinador ordena a mano.
 *
 * Solo se puede usar cuando ya se jugaron los partidos de desempate y ni el
 * resultado, ni la diferencia de sets, ni el enfrentamiento directo separaron
 * a los empatados. La base lo verifica; esto solo pasa el orden y el motivo.
 */
export async function decidirEmpate(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await requerirCoordinador();
  const divisionId = String(formData.get("division_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const orden = formData
    .getAll("orden")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (orden.length < 2) return { error: "Faltan los jugadores en el orden que quedan." };
  if (new Set(orden).size !== orden.length) return { error: "Hay un jugador repetido en el orden." };
  if (motivo.length < 10) return { error: "Escribí por qué se decidió así; esto reparte premios y descensos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decidir_empate", {
    p_division_id: divisionId,
    p_orden: orden,
    p_motivo: motivo,
  });
  if (error) return { error: mensaje(error, "No se pudo registrar la decisión") };
  revalidatePath(RUTA);
  return { ok: "Empate decidido. Queda anotado quién lo decidió y por qué." };
}
