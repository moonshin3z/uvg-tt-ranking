import { createClient } from "@/lib/supabase/server";
import type { PartidoEstado, PartidoTipo, DivisionTipo } from "@/lib/supabase/tipos";
import { datos } from "@/lib/supabase/errores";

/** Un partido visto desde un jugador concreto ("yo"). */
export type PartidoMio = {
  id: string;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  /** Null cuando el partido es de un torneo: ahí no hay divisiones. */
  division: DivisionTipo | null;
  /** El torneo del que cuelga, si cuelga de uno. */
  torneo: { id: string; nombre: string } | null;
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
  torneo_id,
  division(tipo, ranking_id, ranking(estado)),
  torneo(id, nombre, estado, horas_autoconfirmacion),
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
  torneo_id: string | null;
  division: { tipo: DivisionTipo; ranking_id: string; ranking: { estado: string } | null } | null;
  torneo: { id: string; nombre: string; estado: string; horas_autoconfirmacion: number | null } | null;
  a: { id: string; nombre: string; carnet: string };
  b: { id: string; nombre: string; carnet: string };
};

export function partidoCancelado(p: {
  division: { ranking: { estado: string } | null } | null;
  torneo: { estado: string } | null;
}): boolean {
  return p.division?.ranking?.estado === "cancelado" || p.torneo?.estado === "cancelado";
}

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
    division: p.division?.tipo ?? null,
    torneo: p.torneo,
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
      // El filtro debe descartar el partido, no solo dejar su división en null.
      // Sin !inner aparecían partidos de rankings anteriores como si fueran de torneo.
      .select(SELECT_PARTIDO.replace("division(", "division!inner("))
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

export type EventoPartido = {
  id: number;
  accion: string;
  antes: unknown;
  despues: unknown;
  creadoEn: string;
  actor: { nombre: string; carnet: string } | null;
};

/** Historial inmutable de las transiciones de un partido. */
export async function eventosDePartido(id: string): Promise<EventoPartido[]> {
  const supabase = await createClient();
  const data = datos(
    await supabase
      .from("partido_evento")
      .select("id, accion, antes, despues, creado_en, actor:usuario!partido_evento_actor_fkey(nombre, carnet)")
      .eq("partido_id", id)
      .order("creado_en", { ascending: true })
      .order("id", { ascending: true }),
    "la bitácora del partido",
  );

  return (
    (data ?? []) as unknown as {
      id: number;
      accion: string;
      antes: unknown;
      despues: unknown;
      creado_en: string;
      actor: { nombre: string; carnet: string } | null;
    }[]
  ).map((e) => ({
    id: e.id,
    accion: e.accion,
    antes: e.antes,
    despues: e.despues,
    creadoEn: e.creado_en,
    actor: e.actor,
  }));
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
  const data = datos(
    await supabase
      .from("marcador")
      .select(
        "id, nombre_a, nombre_b, sets_a, sets_b, puntos_a, puntos_b, estado, partido_id, actualizado_en, partido(division(ranking(estado)), torneo(estado))",
      )
      .eq("dueno", yo)
      .in("estado", ["en_juego", "abandonado"])
      .order("actualizado_en", { ascending: false }),
    "tus marcadores abiertos",
  );

  // Primero se excluyen las cancelaciones: cinco marcadores cancelados no
  // deben ocultar uno libre o de otra competencia que todavía se puede retomar.
  return (data ?? [])
    .filter((m) => !m.partido || !partidoCancelado(m.partido))
    .slice(0, 5)
    .map((m) => ({
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

/**
 * Mis partidos de torneo.
 *
 * Van aparte de los del ranking porque no comparten nada: un partido de torneo
 * no tiene división, no suma puntos en la tabla y se juega con las reglas de su
 * torneo. Hasta ahora `misPartidos` filtraba por `division.ranking_id`, así que
 * a un jugador no le aparecía nunca su partido de torneo: no podía registrar el
 * resultado, ni confirmarlo, ni abrir el marcador. El torneo era de solo
 * lectura para todos menos el coordinador.
 */
export async function misPartidosDeTorneo(yo: string): Promise<PartidoMio[]> {
  const supabase = await createClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(SELECT_PARTIDO.replace("torneo(", "torneo!inner("))
      .eq("torneo.estado", "en_juego")
      .or(`jugador_a.eq.${yo},jugador_b.eq.${yo}`)
      .in("estado", ["pendiente", "jugado", "disputado"])
      .order("registrado_en", { ascending: false, nullsFirst: false }),
    "tus partidos de torneo",
  );
  return ((data ?? []) as unknown as FilaPartido[]).map((p) => desdeMiPerspectiva(p, yo));
}
