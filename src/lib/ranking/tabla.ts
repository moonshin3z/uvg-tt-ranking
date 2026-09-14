/**
 * Lógica pura de la tabla de posiciones. Sin dependencias de React ni de
 * Supabase para poder testearla con vitest.
 *
 * Orden del reglamento: puntos, resultado de desempate, enfrentamiento
 * directo (solo entre dos), nombre.
 */

export type FilaTabla = {
  usuario_id: string;
  nombre: string;
  carnet: string;
  pj: number;
  pg: number;
  pp: number;
  pts: number;
  pg_desempate: number;
};

export type EnfrentamientoDirecto = {
  jugador_a: string;
  jugador_b: string;
  ganador: string | null;
};

export type FilaOrdenada = FilaTabla & {
  posicion: number;
  /** premio | ascenso | descenso | null, según parámetros del ranking */
  zona: "premio" | "ascenso" | "descenso" | null;
};

export type ParametrosZona = {
  division: "mayor" | "menor";
  n_premiados: number;
  n_ascienden: number;
  n_descienden: number;
};

export function ordenarTabla(filas: FilaTabla[], directos: EnfrentamientoDirecto[] = []): FilaTabla[] {
  const ganadorDirecto = (a: string, b: string): string | null => {
    const p = directos.find(
      (d) => (d.jugador_a === a && d.jugador_b === b) || (d.jugador_a === b && d.jugador_b === a),
    );
    return p?.ganador ?? null;
  };

  return [...filas].sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.pg_desempate !== x.pg_desempate) return y.pg_desempate - x.pg_desempate;
    // Enfrentamiento directo solo decide si exactamente dos jugadores comparten pts
    const empatados = filas.filter((f) => f.pts === x.pts && f.pg_desempate === x.pg_desempate);
    if (empatados.length === 2) {
      const g = ganadorDirecto(x.usuario_id, y.usuario_id);
      if (g === x.usuario_id) return -1;
      if (g === y.usuario_id) return 1;
    }
    return x.nombre.localeCompare(y.nombre, "es");
  });
}

export function asignarZonas(filas: FilaTabla[], p: ParametrosZona): FilaOrdenada[] {
  const n = filas.length;
  return filas.map((f, i) => {
    const pos = i + 1;
    let zona: FilaOrdenada["zona"] = null;
    if (p.division === "menor" && pos <= p.n_ascienden) zona = "ascenso";
    else if (p.division === "mayor" && pos <= p.n_premiados) zona = "premio";
    else if (p.division === "menor" && pos <= p.n_premiados) zona = "premio";
    if (p.division === "mayor" && pos > n - p.n_descienden) zona = "descenso";
    return { ...f, posicion: pos, zona };
  });
}
