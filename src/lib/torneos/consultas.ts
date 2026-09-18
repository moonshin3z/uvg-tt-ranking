import { createClient } from "@/lib/supabase/server";
import { datos, ErrorDeDatos } from "@/lib/supabase/errores";
import type { Database } from "@/lib/supabase/database.types";

export type Torneo = Database["public"]["Tables"]["torneo"]["Row"];

export type LlaveDeCuadro = {
  ronda: number;
  posicion: number;
  a: { id: string; nombre: string } | null;
  b: { id: string; nombre: string } | null;
  setsA: number | null;
  setsB: number | null;
  ganador: string | null;
  partidoId: string | null;
};

export type PosicionGrupo = {
  usuario_id: string;
  nombre: string;
  pj: number;
  pg: number;
  dif_sets: number;
  posicion: number;
  empatado_sin_resolver: boolean;
};

/**
 * El torneo en curso, si hay uno.
 *
 * La franja de la portada solo existe mientras hay torneo: el resto del año no
 * ocupa un pixel. Por eso esto devuelve null y no un objeto vacío.
 */
export async function torneoEnCurso(): Promise<{ torneo: Torneo; porJugar: number } | null> {
  const supabase = await createClient();
  const torneo = datos(
    await supabase
      .from("torneo")
      .select("*")
      // También los que están en inscripción: si el torneo no aparece hasta que
      // el coordinador arma el cuadro, nadie se entera de que hay que anotarse.
      // Eso fue justo lo que pasó la primera vez que se creó uno.
      .in("estado", ["inscripcion", "en_juego"])
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "el torneo en curso",
  );
  if (!torneo) return null;

  const conteo = await supabase
    .from("partido")
    .select("id", { count: "exact", head: true })
    .eq("torneo_id", torneo.id)
    .in("estado", ["pendiente", "jugado", "disputado"]);
  if (conteo.error) throw new ErrorDeDatos("los partidos pendientes del torneo", conteo.error);

  return { torneo, porJugar: conteo.count ?? 0 };
}

export async function torneoPorId(id: string): Promise<Torneo | null> {
  const supabase = await createClient();
  return datos(await supabase.from("torneo").select("*").eq("id", id).maybeSingle(), "el torneo");
}

/**
 * El cuadro completo, listo para dibujar.
 *
 * `torneo_llave` existe entero desde el sorteo, con los jugadores en null
 * donde todavía no se sabe quién llega, así que el cuadro se puede dibujar
 * desde el primer día sin inventar partidos.
 */
export async function cuadroDeTorneo(torneoId: string): Promise<LlaveDeCuadro[]> {
  const supabase = await createClient();
  const llaves = datos(
    await supabase
      .from("torneo_llave")
      .select("ronda, posicion, jugador_a, jugador_b, partido_id, ganador")
      .eq("torneo_id", torneoId)
      .order("ronda")
      .order("posicion"),
    "el cuadro del torneo",
  );
  if (!llaves || llaves.length === 0) return [];

  const ids = [...new Set(llaves.flatMap((l) => [l.jugador_a, l.jugador_b]).filter((x): x is string => !!x))];
  const partidoIds = llaves.map((l) => l.partido_id).filter((x): x is string => !!x);

  const [nombresRespuesta, partidosRespuesta] = await Promise.all([
    ids.length > 0
      ? supabase.from("usuario").select("id, nombre").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    partidoIds.length > 0
      ? supabase.from("partido").select("id, jugador_a, sets_a, sets_b, estado").in("id", partidoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const nombres = datos(nombresRespuesta, "los nombres del cuadro");
  const partidos = datos(partidosRespuesta, "los resultados del cuadro");

  const nombrePor = new Map((nombres ?? []).map((u) => [u.id, u.nombre]));
  const partidoPor = new Map((partidos ?? []).map((p) => [p.id, p]));

  return llaves.map((l) => {
    const p = l.partido_id ? partidoPor.get(l.partido_id) : undefined;
    // El partido guarda los sets con su propio orden de jugadores, que no
    // tiene por qué coincidir con el de la llave.
    const invertido = p != null && l.jugador_a != null && p.jugador_a !== l.jugador_a;
    return {
      ronda: l.ronda,
      posicion: l.posicion,
      a: l.jugador_a ? { id: l.jugador_a, nombre: nombrePor.get(l.jugador_a) ?? "?" } : null,
      b: l.jugador_b ? { id: l.jugador_b, nombre: nombrePor.get(l.jugador_b) ?? "?" } : null,
      setsA: p ? (invertido ? p.sets_b : p.sets_a) : null,
      setsB: p ? (invertido ? p.sets_a : p.sets_b) : null,
      ganador: l.ganador,
      partidoId: l.partido_id,
    };
  });
}

/** Los grupos con su tabla, en el orden que decide la base. */
export async function gruposDeTorneo(torneoId: string): Promise<{ nombre: string; filas: PosicionGrupo[] }[]> {
  const supabase = await createClient();
  const grupos = datos(
    await supabase.from("torneo_grupo").select("id, nombre").eq("torneo_id", torneoId).order("nombre"),
    "los grupos del torneo",
  );
  if (!grupos || grupos.length === 0) return [];

  return Promise.all(
    grupos.map(async (g) => {
      const filas = datos(await supabase.rpc("posiciones_grupo", { p_grupo_id: g.id }), "la tabla del grupo");
      return { nombre: g.nombre, filas: (filas ?? []) as PosicionGrupo[] };
    }),
  );
}

/** El nombre de cada ronda, contando desde la final hacia atrás. */
export function nombreDeRonda(ronda: number, ultima: number): string {
  const desdeElFinal = ultima - ronda;
  if (desdeElFinal === 0) return "Final";
  if (desdeElFinal === 1) return "Semifinales";
  if (desdeElFinal === 2) return "Cuartos";
  if (desdeElFinal === 3) return "Octavos";
  return `Ronda ${ronda}`;
}
