/**
 * Las medallas: oro para el 1.º y plata para el 2.º de cada división cuando
 * un ranking se cierra. Mientras el ranking está en juego nadie tiene medalla,
 * aunque vaya primero.
 *
 * Todo sale de lo que ya calcula la tabla (la posición final, con los
 * desempates resueltos), así que no hay nada guardado aparte que se pueda
 * desincronizar.
 */
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { nombreDivision } from "@/lib/ranking/divisiones";
import type { FilaOrdenada } from "@/lib/ranking/tabla";

export type Puesto = 1 | 2;

/** La medalla que corresponde a una posición final, si corresponde alguna. */
export function medallaDe(estadoRanking: string, posicion: number): Puesto | null {
  if (estadoRanking !== "cerrado") return null;
  return posicion === 1 ? 1 : posicion === 2 ? 2 : null;
}

export function nombreMedalla(puesto: Puesto): string {
  return puesto === 1 ? "Oro" : "Plata";
}

export type MedallaGanada = {
  puesto: Puesto;
  division: DivisionTipo;
  rankingId: string;
  rankingNombre: string;
};

type FilaDeHistorial = {
  ranking_id: string;
  ranking_nombre: string;
  ranking_estado: string;
  division: DivisionTipo;
  posicion: number;
};

/** Las medallas de un jugador, en el orden del historial (la más nueva primero). */
export function medallasDelHistorial(historial: FilaDeHistorial[]): MedallaGanada[] {
  return historial.flatMap((h) => {
    const puesto = medallaDe(h.ranking_estado, h.posicion);
    return puesto ? [{ puesto, division: h.division, rankingId: h.ranking_id, rankingNombre: h.ranking_nombre }] : [];
  });
}

/** "Oro en Primera · Ranking 1 · 2026-2". */
export function textoMedalla(m: MedallaGanada): string {
  return `${nombreMedalla(m.puesto)} en ${nombreDivision(m.division)} · ${m.rankingNombre}`;
}

export type Premiado = { nombre: string; carnet: string; pts: number; pj: number; pg: number };

export type Podio = { division: DivisionTipo; oro: Premiado | null; plata: Premiado | null };

const premiado = (f: FilaOrdenada | undefined): Premiado | null =>
  f ? { nombre: f.nombre, carnet: f.carnet, pts: f.pts, pj: f.pj, pg: f.pg } : null;

/** El 1.º y el 2.º de una tabla ya ordenada. */
export function podioDeTabla(division: DivisionTipo, filas: FilaOrdenada[]): Podio {
  return {
    division,
    oro: premiado(filas.find((f) => f.posicion === 1)),
    plata: premiado(filas.find((f) => f.posicion === 2)),
  };
}

/** "Iván, Andres y wellington": los de oro, por el primer nombre. */
export function nombresDeOro(podios: Podio[]): string {
  const nombres = podios.flatMap((p) => (p.oro ? [p.oro.nombre.trim().split(/\s+/)[0]] : []));
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
