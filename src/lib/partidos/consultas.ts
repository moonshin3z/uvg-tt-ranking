import { createClient } from "@/lib/supabase/server";
import type { PartidoEstado, PartidoTipo, DivisionTipo } from "@/lib/supabase/tipos";
import { datos } from "@/lib/supabase/errores";

/** Un partido visto desde un jugador concreto ("yo"). */
export type PartidoMio = {
  id: string;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  division: DivisionTipo;
  rival: { id: string; nombre: string; carnet: string };
  soyA: boolean;
  gane: boolean | null;
  /** marcador en sets desde mi perspectiva, "3-1" */
  sets: string | null;
  loRegistreYo: boolean;
  registradoEn: string | null;
  confirmadoEn: string | null;
  disputaMotivo: string | null;
  resolucion: string | null;
};

const SELECT_PARTIDO = `
  id, tipo, estado, jugador_a, jugador_b, ganador, sets_a, sets_b,
  registrado_por, registrado_en, confirmado_en, disputa_motivo, resolucion,
  division!inner(tipo, ranking_id),
  a:usuario!partido_jugador_a_fkey(id, nombre, carnet),
  b:usuario!partido_jugador_b_fkey(id, nombre, carnet)
`;

type FilaPartido = {
  id: string;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  jugador_a: string;
  jugador_b: string;
  ganador: string | null;
  sets_a: number | null;
  sets_b: number | null;
  registrado_por: string | null;
  registrado_en: string | null;
  confirmado_en: string | null;
  disputa_motivo: string | null;
  resolucion: string | null;
  division: { tipo: DivisionTipo; ranking_id: string };
  a: { id: string; nombre: string; carnet: string };
  b: { id: string; nombre: string; carnet: string };
};

export function desdeMiPerspectiva(p: FilaPartido, yo: string): PartidoMio {
  const soyA = p.jugador_a === yo;
  const rival = soyA ? p.b : p.a;
  const gane = p.ganador ? p.ganador === yo : null;
  const sets =
    p.sets_a != null && p.sets_b != null ? (soyA ? `${p.sets_a}-${p.sets_b}` : `${p.sets_b}-${p.sets_a}`) : null;
  return {
    id: p.id,
    tipo: p.tipo,
    estado: p.estado,
    division: p.division.tipo,
    rival,
    soyA,
    gane,
    sets,
    loRegistreYo: p.registrado_por === yo,
    registradoEn: p.registrado_en,
    confirmadoEn: p.confirmado_en,
    disputaMotivo: p.disputa_motivo,
    resolucion: p.resolucion,
  };
}

export type MisPartidos = {
  porConfirmar: PartidoMio[];
  pendientes: PartidoMio[];
  esperandoRival: PartidoMio[];
  enDisputa: PartidoMio[];
  historial: PartidoMio[];
};

export async function misPartidos(yo: string, rankingId: string): Promise<MisPartidos> {
  const supabase = await createClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(SELECT_PARTIDO)
      .eq("division.ranking_id", rankingId)
      .or(`jugador_a.eq.${yo},jugador_b.eq.${yo}`)
      .order("registrado_en", { ascending: false, nullsFirst: false }),
    "tus partidos",
  );

  const todos = ((data ?? []) as unknown as FilaPartido[]).map((p) => desdeMiPerspectiva(p, yo));
  return {
    porConfirmar: todos.filter((p) => p.estado === "jugado" && !p.loRegistreYo),
    // Los desempates tienen plazo corto y definen premios: van primero.
    pendientes: todos
      .filter((p) => p.estado === "pendiente")
      .sort(
        (x, y) =>
          Number(y.tipo === "desempate") - Number(x.tipo === "desempate") ||
          x.rival.nombre.localeCompare(y.rival.nombre),
      ),
    esperandoRival: todos.filter((p) => p.estado === "jugado" && p.loRegistreYo),
    enDisputa: todos.filter((p) => p.estado === "disputado"),
    historial: todos.filter((p) => ["confirmado", "resuelto", "anulado"].includes(p.estado)),
  };
}

export async function partidoPorId(id: string): Promise<FilaPartido | null> {
  const supabase = await createClient();
  const data = datos(await supabase.from("partido").select(SELECT_PARTIDO).eq("id", id).maybeSingle(), "el partido");
  return (data as unknown as FilaPartido | null) ?? null;
}

export async function setsDePartido(id: string) {
  const supabase = await createClient();
  const data = datos(
    await supabase.from("set_partido").select("numero, puntos_a, puntos_b").eq("partido_id", id).order("numero"),
    "los sets del partido",
  );
  return data ?? [];
}

/**
 * Corre la autoconfirmación de vencidos. Barata e idempotente.
 * Si falla no rompe la página: es una tarea de fondo, no lo que vino a ver
 * el usuario. Queda en el log del servidor.
 */
export async function autoconfirmarVencidos() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("autoconfirmar_vencidos");
  if (error) console.error("autoconfirmar_vencidos falló:", error.message);
}

export type MarcadorAbierto = {
  id: string;
  nombreA: string;
  nombreB: string;
  setsA: number;
  setsB: number;
  puntosA: number;
  puntosB: number;
  estado: string;
  partidoId: string | null;
  actualizado: string;
};

/**
 * Los marcadores que dejé a medias.
 *
 * Sin esto, salir de la pantalla del marcador es perderlo: el de un partido
 * del ranking se vuelve a abrir desde el partido, pero uno libre no cuelga de
 * nada y no había forma de llegar a él otra vez. Salir y retomar más tarde es
 * lo normal en el club, así que tienen que estar a la vista.
 */
export async function misMarcadoresAbiertos(yo: string): Promise<MarcadorAbierto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marcador")
    .select("id, nombre_a, nombre_b, sets_a, sets_b, puntos_a, puntos_b, estado, partido_id, actualizado_en")
    .eq("dueno", yo)
    .in("estado", ["en_juego", "abandonado"])
    .order("actualizado_en", { ascending: false })
    .limit(5);

  return (data ?? []).map((m) => ({
    id: m.id,
    nombreA: m.nombre_a,
    nombreB: m.nombre_b,
    setsA: m.sets_a,
    setsB: m.sets_b,
    puntosA: m.puntos_a,
    puntosB: m.puntos_b,
    estado: m.estado,
    partidoId: m.partido_id,
    actualizado: m.actualizado_en,
  }));
}
