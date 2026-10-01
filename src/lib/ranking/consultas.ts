import { createPublicClient } from "@/lib/supabase/server";
import type { DivisionTipo, RankingRow, TablaPosicionesRow } from "@/lib/supabase/tipos";
import { asignarZonas, ordenarTabla, type EnfrentamientoDirecto, type FilaOrdenada } from "./tabla";
import { DIVISIONES, nivelDivision } from "./divisiones";
import type { PartidoSemanal } from "./semanas";
import { datos } from "@/lib/supabase/errores";

/**
 * Consultas públicas de solo lectura para la portada. Usan el cliente anónimo
 * (sin cookies) porque la tabla es la misma para todos.
 */

export type ResultadoReciente = {
  id: string;
  division: DivisionTipo;
  ganador: { nombre: string; carnet: string };
  perdedor: { nombre: string; carnet: string };
  sets: string | null;
  fecha: string;
};

/** El ranking que se muestra en portada: el último que no esté en borrador. */
export async function rankingVigente(): Promise<RankingRow | null> {
  const supabase = createPublicClient();
  return datos(
    await supabase
      .from("ranking")
      .select("*")
      .not("estado", "in", "(borrador,cancelado)")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "el ranking vigente",
  );
}

/** Las divisiones que tiene un ranking, de Primera para abajo. */
export async function divisionesDelRanking(rankingId: string): Promise<DivisionTipo[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase.from("division").select("tipo").eq("ranking_id", rankingId),
    "las divisiones del ranking",
  );
  const tipos = new Set((data ?? []).map((d) => d.tipo));
  return DIVISIONES.filter((t) => tipos.has(t));
}

/** En qué división juega alguien en un ranking, si juega. */
export async function divisionDeJugador(usuarioId: string, rankingId: string): Promise<DivisionTipo | null> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("inscripcion")
      .select("division!inner(ranking_id, tipo)")
      .eq("usuario_id", usuarioId)
      .eq("division.ranking_id", rankingId)
      .maybeSingle(),
    "la división del jugador",
  );
  return data?.division.tipo ?? null;
}

export async function tablaDeDivision(
  ranking: RankingRow,
  division: DivisionTipo,
  divisiones: number,
): Promise<FilaOrdenada[]> {
  const supabase = createPublicClient();

  const [respuestaFilas, respuestaDirectos] = await Promise.all([
    supabase.from("tabla_posiciones").select("*").eq("ranking_id", ranking.id).eq("division", division),
    supabase
      .from("partido")
      .select("jugador_a, jugador_b, ganador, division!inner(ranking_id, tipo)")
      .eq("tipo", "regular")
      .in("estado", ["confirmado", "resuelto"])
      .eq("division.ranking_id", ranking.id)
      .eq("division.tipo", division),
  ]);
  const filas = datos(respuestaFilas, "la tabla de posiciones");
  const directos = datos(respuestaDirectos, "los enfrentamientos directos");

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
    dif_sets: f.dif_sets ?? 0,
  }));
  const ordenadas = ordenarTabla(normalizadas, (directos ?? []) as EnfrentamientoDirecto[]);
  return asignarZonas(ordenadas, {
    nivel: nivelDivision(division),
    divisiones,
    n_premiados: ranking.n_premiados,
    n_ascienden: ranking.n_ascienden,
    n_descienden: ranking.n_descienden,
  });
}

export async function ultimosResultados(ranking: RankingRow, limite = 8): Promise<ResultadoReciente[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(
        "id, ganador, sets_a, sets_b, confirmado_en, jugador_a, jugador_b, division!inner(ranking_id, tipo), a:usuario!partido_jugador_a_fkey(nombre, carnet), b:usuario!partido_jugador_b_fkey(nombre, carnet)",
      )
      .eq("tipo", "regular")
      .in("estado", ["confirmado", "resuelto"])
      .eq("division.ranking_id", ranking.id)
      .order("confirmado_en", { ascending: false, nullsFirst: false })
      .limit(limite),
    "los últimos resultados",
  );

  return (data ?? []).map((p) => {
    const ganoA = p.ganador === p.jugador_a;
    const ganador = ganoA ? p.a : p.b;
    const perdedor = ganoA ? p.b : p.a;
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

/** Todos los rankings publicados, del más reciente al más viejo. */
export async function todosLosRankings(): Promise<RankingRow[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("ranking")
      .select("*")
      .not("estado", "in", "(borrador,cancelado)")
      .order("creado_en", { ascending: false }),
    "la lista de rankings",
  );
  return data ?? [];
}

export async function rankingPorId(id: string): Promise<RankingRow | null> {
  const supabase = createPublicClient();
  return datos(await supabase.from("ranking").select("*").eq("id", id).maybeSingle(), "el ranking");
}

export type PartidoDeCalendario = {
  id: string;
  division: DivisionTipo;
  tipo: "regular" | "desempate";
  estado: string;
  a: { nombre: string; carnet: string };
  b: { nombre: string; carnet: string };
  ganador: string | null;
  jugador_a: string;
  sets_a: number | null;
  sets_b: number | null;
  fecha: string | null;
};

/** Calendario completo de un ranking: quién juega contra quién y cómo va. */
export async function calendarioDeRanking(rankingId: string): Promise<PartidoDeCalendario[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(
        "id, tipo, estado, ganador, jugador_a, sets_a, sets_b, confirmado_en, division!inner(tipo, ranking_id), a:usuario!partido_jugador_a_fkey(nombre, carnet), b:usuario!partido_jugador_b_fkey(nombre, carnet)",
      )
      .eq("division.ranking_id", rankingId),
    "el calendario",
  );

  type Cruda = {
    id: string;
    tipo: "regular" | "desempate";
    estado: string;
    ganador: string | null;
    jugador_a: string;
    sets_a: number | null;
    sets_b: number | null;
    confirmado_en: string | null;
    division: { tipo: DivisionTipo };
    a: { nombre: string; carnet: string };
    b: { nombre: string; carnet: string };
  };

  return ((data ?? []) as unknown as Cruda[])
    .map((p) => ({
      id: p.id,
      division: p.division.tipo,
      tipo: p.tipo,
      estado: p.estado,
      a: p.a,
      b: p.b,
      ganador: p.ganador,
      jugador_a: p.jugador_a,
      sets_a: p.sets_a,
      sets_b: p.sets_b,
      fecha: p.confirmado_en,
    }))
    .sort((x, y) => x.a.nombre.localeCompare(y.a.nombre) || x.b.nombre.localeCompare(y.b.nombre));
}

/**
 * Los partidos del ranking que ya tienen semana, con los dos jugadores. Para
 * la pantalla de la semana y su imagen: con 30 partidos por ranking se traen
 * todos y se arman en `armarSemana`.
 */
export async function partidosSemanales(rankingId: string): Promise<PartidoSemanal[]> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(
        "id, semana, estado, ganador, sets_a, sets_b, registrado_en, division!inner(ranking_id, tipo), a:usuario!partido_jugador_a_fkey(id, nombre, carnet), b:usuario!partido_jugador_b_fkey(id, nombre, carnet)",
      )
      .eq("tipo", "regular")
      .eq("division.ranking_id", rankingId)
      .not("semana", "is", null)
      .order("semana")
      .order("id"),
    "los partidos de la semana",
  );
  return (data ?? []).map((p) => ({
    id: p.id,
    semana: p.semana,
    estado: p.estado,
    division: p.division.tipo,
    a: p.a,
    b: p.b,
    ganador: p.ganador,
    sets_a: p.sets_a,
    sets_b: p.sets_b,
    registrado_en: p.registrado_en,
  }));
}

/** La última semana que tiene algún partido del ranking (0 si todavía no hay semanas). */
export async function ultimaSemanaDe(rankingId: string): Promise<number> {
  const supabase = createPublicClient();
  const data = datos(
    await supabase
      .from("partido")
      .select("semana, division!inner(ranking_id)")
      .eq("division.ranking_id", rankingId)
      .not("semana", "is", null)
      .order("semana", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "la última semana",
  );
  return data?.semana ?? 0;
}
