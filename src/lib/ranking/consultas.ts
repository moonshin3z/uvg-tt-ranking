import { createPublicClient } from "@/lib/supabase/server";
import type { DivisionTipo, RankingRow, TablaPosicionesRow } from "@/lib/supabase/tipos";
import { asignarZonas, ordenarTabla, type EnfrentamientoDirecto, type FilaOrdenada } from "./tabla";

/**
 * Consultas públicas de solo lectura para la portada. Usan el cliente anónimo
 * (sin cookies) porque la tabla es la misma para todos.
 */

export type ResultadoReciente = {
  id: string;
  division: DivisionTipo;
  ganador: string;
  perdedor: string;
  sets: string | null;
  fecha: string;
};

/** El ranking que se muestra en portada: el último que no esté en borrador. */
export async function rankingVigente(): Promise<RankingRow | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("ranking")
    .select("*")
    .neq("estado", "borrador")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function tablaDeDivision(ranking: RankingRow, division: DivisionTipo): Promise<FilaOrdenada[]> {
  const supabase = createPublicClient();

  const [{ data: filas }, { data: directos }] = await Promise.all([
    supabase.from("tabla_posiciones").select("*").eq("ranking_id", ranking.id).eq("division", division),
    supabase
      .from("partido")
      .select("jugador_a, jugador_b, ganador, division!inner(ranking_id, tipo)")
      .eq("tipo", "regular")
      .in("estado", ["confirmado", "resuelto"])
      .eq("division.ranking_id", ranking.id)
      .eq("division.tipo", division),
  ]);

  // Postgres no puede garantizar NOT NULL en columnas de una vista, así que
  // los tipos generados salen nullable; la vista nunca devuelve nulos en la
  // práctica (todo viene de joins internos y count/sum con coalesce).
  const normalizadas = ((filas ?? []) as TablaPosicionesRow[]).map((f) => ({
    usuario_id: f.usuario_id ?? "",
    nombre: f.nombre ?? "",
    carnet: f.carnet ?? "",
    pj: f.pj ?? 0,
    pg: f.pg ?? 0,
    pp: f.pp ?? 0,
    pts: f.pts ?? 0,
    pg_desempate: f.pg_desempate ?? 0,
  }));
  const ordenadas = ordenarTabla(normalizadas, (directos ?? []) as EnfrentamientoDirecto[]);
  return asignarZonas(ordenadas, {
    division,
    n_premiados: ranking.n_premiados,
    n_ascienden: ranking.n_ascienden,
    n_descienden: ranking.n_descienden,
  });
}

export async function ultimosResultados(ranking: RankingRow, limite = 8): Promise<ResultadoReciente[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("partido")
    .select(
      "id, ganador, sets_a, sets_b, confirmado_en, jugador_a, jugador_b, division!inner(ranking_id, tipo), a:usuario!partido_jugador_a_fkey(nombre), b:usuario!partido_jugador_b_fkey(nombre)",
    )
    .eq("tipo", "regular")
    .in("estado", ["confirmado", "resuelto"])
    .eq("division.ranking_id", ranking.id)
    .order("confirmado_en", { ascending: false, nullsFirst: false })
    .limit(limite);

  return (data ?? []).map((p) => {
    const ganoA = p.ganador === p.jugador_a;
    const ganador = ganoA ? p.a.nombre : p.b.nombre;
    const perdedor = ganoA ? p.b.nombre : p.a.nombre;
    const sets =
      p.sets_a != null && p.sets_b != null ? (ganoA ? `${p.sets_a}-${p.sets_b}` : `${p.sets_b}-${p.sets_a}`) : null;
    return {
      id: p.id,
      division: p.division.tipo,
      ganador,
      perdedor,
      sets,
      fecha: p.confirmado_en ?? "",
    };
  });
}
