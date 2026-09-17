import { createPublicClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import type { DivisionTipo, PartidoEstado, PartidoTipo, RankingEstado, UsuarioRow } from "@/lib/supabase/tipos";

/**
 * Consultas del perfil público. Van con el cliente anónimo: un perfil se ve
 * igual con sesión o sin ella.
 */

export type FilaHistorial = {
  ranking_id: string;
  ranking_nombre: string;
  ranking_estado: RankingEstado;
  division: DivisionTipo;
  posicion: number;
  jugadores_division: number;
  pj: number;
  pg: number;
  pp: number;
  pts: number;
  n_premiados: number;
  n_ascienden: number;
  n_descienden: number;
};

export type PartidoDePerfil = {
  id: string;
  ranking_id: string;
  ranking_nombre: string;
  division: DivisionTipo;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  rival: { id: string; nombre: string; carnet: string };
  gano: boolean | null;
  sets: string | null;
  fecha: string | null;
};

export async function jugadorPorCarnet(carnet: string): Promise<UsuarioRow | null> {
  const supabase = createPublicClient();
  // Columnas explícitas: `debe_cambiar_pin` ya no es legible y `select("*")`
  // fallaría entero por esa sola columna.
  return datos(
    await supabase
      .from("usuario")
      .select("id, carnet, nombre, rol, activo, creado_en, actualizado_en")
      .eq("carnet", carnet)
      .maybeSingle(),
    "el jugador",
  );
}

export async function historialDeJugador(usuarioId: string): Promise<FilaHistorial[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase.rpc("historial_jugador", { p_usuario_id: usuarioId }),
    "el historial del jugador",
  );
  return (data ?? []) as FilaHistorial[];
}

type FilaCruda = {
  id: string;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  jugador_a: string;
  jugador_b: string;
  ganador: string | null;
  sets_a: number | null;
  sets_b: number | null;
  confirmado_en: string | null;
  division: { tipo: DivisionTipo; ranking: { id: string; nombre: string; creado_en: string } };
  a: { id: string; nombre: string; carnet: string };
  b: { id: string; nombre: string; carnet: string };
};

const SELECT_PERFIL = `
  id, tipo, estado, jugador_a, jugador_b, ganador, sets_a, sets_b, confirmado_en,
  division!inner(tipo, ranking!inner(id, nombre, creado_en)),
  a:usuario!partido_jugador_a_fkey(id, nombre, carnet),
  b:usuario!partido_jugador_b_fkey(id, nombre, carnet)
`;

/** Todos los partidos definidos del jugador, del más reciente al más viejo. */
export async function partidosDeJugador(usuarioId: string, limite = 60): Promise<PartidoDePerfil[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(SELECT_PERFIL)
      .or(`jugador_a.eq.${usuarioId},jugador_b.eq.${usuarioId}`)
      .in("estado", ["confirmado", "resuelto"])
      .order("confirmado_en", { ascending: false, nullsFirst: false })
      .limit(limite),
    "los partidos del jugador",
  );

  return ((data ?? []) as unknown as FilaCruda[]).map((p) => {
    const soyA = p.jugador_a === usuarioId;
    const rival = soyA ? p.b : p.a;
    const sets =
      p.sets_a != null && p.sets_b != null ? (soyA ? `${p.sets_a}-${p.sets_b}` : `${p.sets_b}-${p.sets_a}`) : null;
    return {
      id: p.id,
      ranking_id: p.division.ranking.id,
      ranking_nombre: p.division.ranking.nombre,
      division: p.division.tipo,
      tipo: p.tipo,
      estado: p.estado,
      rival,
      gano: p.ganador ? p.ganador === usuarioId : null,
      sets,
      fecha: p.confirmado_en,
    };
  });
}

export type HeadToHead = {
  jugados: number;
  /** Victorias del dueño del perfil (de quien son los `partidos`). */
  ganoDuenio: number;
  /** Victorias del otro jugador. */
  ganoOtro: number;
};

/**
 * Récord entre el dueño del perfil y otro jugador, sumando todos los rankings.
 * `partidos` son los del dueño, así que `gano === true` es victoria suya.
 */
export function headToHead(partidos: PartidoDePerfil[], otroId: string): HeadToHead | null {
  const entre = partidos.filter((p) => p.rival.id === otroId && p.gano !== null);
  if (entre.length === 0) return null;
  const ganoDuenio = entre.filter((p) => p.gano === true).length;
  return { jugados: entre.length, ganoDuenio, ganoOtro: entre.length - ganoDuenio };
}
