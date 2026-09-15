import { createClient } from "@/lib/supabase/server";
import type { PartidoEstado, PartidoTipo, DivisionTipo } from "@/lib/supabase/tipos";

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
  const { data } = await supabase
    .from("partido")
    .select(SELECT_PARTIDO)
    .eq("division.ranking_id", rankingId)
    .or(`jugador_a.eq.${yo},jugador_b.eq.${yo}`)
    .order("registrado_en", { ascending: false, nullsFirst: false });

  const todos = ((data ?? []) as unknown as FilaPartido[]).map((p) => desdeMiPerspectiva(p, yo));
  return {
    porConfirmar: todos.filter((p) => p.estado === "jugado" && !p.loRegistreYo),
    pendientes: todos
      .filter((p) => p.estado === "pendiente")
      .sort((x, y) => x.rival.nombre.localeCompare(y.rival.nombre)),
    esperandoRival: todos.filter((p) => p.estado === "jugado" && p.loRegistreYo),
    enDisputa: todos.filter((p) => p.estado === "disputado"),
    historial: todos.filter((p) => ["confirmado", "resuelto", "anulado"].includes(p.estado)),
  };
}

export async function partidoPorId(id: string): Promise<FilaPartido | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("partido").select(SELECT_PARTIDO).eq("id", id).maybeSingle();
  return (data as unknown as FilaPartido | null) ?? null;
}

export async function setsDePartido(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("set_partido")
    .select("numero, puntos_a, puntos_b")
    .eq("partido_id", id)
    .order("numero");
  return data ?? [];
}

/** Corre la autoconfirmación de vencidos. Barata e idempotente. */
export async function autoconfirmarVencidos() {
  const supabase = await createClient();
  await supabase.rpc("autoconfirmar_vencidos");
}
