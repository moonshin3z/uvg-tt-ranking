/**
 * Las divisiones del club, en orden: Primera es la de arriba.
 *
 * El orden es el mismo del enum `division_tipo` en la base, que es el que usa
 * `nivel_division`. Un ranking puede tener 2 o 3: las primeras N de esta lista.
 */
import type { DivisionTipo } from "@/lib/supabase/tipos";

export const DIVISIONES = ["primera", "segunda", "tercera"] as const satisfies readonly DivisionTipo[];

const NOMBRE: Record<DivisionTipo, string> = {
  primera: "Primera",
  segunda: "Segunda",
  tercera: "Tercera",
};

/** "Primera", "Segunda", "Tercera". */
export function nombreDivision(tipo: DivisionTipo): string {
  return NOMBRE[tipo];
}

/** "Primera división". */
export function divisionLarga(tipo: DivisionTipo): string {
  return `${NOMBRE[tipo]} división`;
}

/** 1 para Primera, 2 para Segunda, 3 para Tercera. */
export function nivelDivision(tipo: DivisionTipo): number {
  return DIVISIONES.indexOf(tipo) + 1;
}

export function esDivision(valor: unknown): valor is DivisionTipo {
  return typeof valor === "string" && (DIVISIONES as readonly string[]).includes(valor);
}

/** Las divisiones de un ranking que tiene `total`, en orden. */
export function divisionesDe(total: number): DivisionTipo[] {
  return DIVISIONES.slice(0, Math.max(0, Math.min(total, DIVISIONES.length)));
}

/** La división que pide la URL si existe en el ranking; si no, la primera. */
export function divisionElegida(param: unknown, disponibles: readonly DivisionTipo[]): DivisionTipo {
  return esDivision(param) && disponibles.includes(param) ? param : (disponibles[0] ?? "primera");
}
