/**
 * Sorteo de divisiones reproducible: misma semilla, mismo resultado.
 * Pura y testeable; la persistencia la hace la función armar_divisiones.
 */

import type { DivisionTipo } from "@/lib/supabase/tipos";

export type Asignacion = { usuario_id: string; division: DivisionTipo };

/** Hash FNV-1a de 32 bits: convierte la semilla (texto) en un entero. */
function hashSemilla(semilla: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32: rápido, determinista, suficiente para barajar 30 nombres. */
function crearRng(semilla: string): () => number {
  let a = hashSemilla(semilla);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates con el rng dado. No muta la entrada. */
export function barajar<T>(items: readonly T[], semilla: string): T[] {
  const rng = crearRng(semilla);
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Reparte a los participantes: se barajan con la semilla y la primera mitad
 * (redondeando hacia arriba) va a Mayor, el resto a Menor.
 * Se ordena la entrada antes de barajar para que el resultado no dependa del
 * orden en que llegaron los ids.
 */
export function sortearDivisiones(usuarioIds: readonly string[], semilla: string): Asignacion[] {
  const unicos = [...new Set(usuarioIds)].sort();
  if (unicos.length < 4) throw new Error("Se necesitan al menos 4 jugadores para sortear");

  const barajados = barajar(unicos, semilla);
  const corte = Math.ceil(barajados.length / 2);

  return barajados.map((usuario_id, i) => ({ usuario_id, division: i < corte ? "mayor" : "menor" }));
}

/** Semilla legible: fecha + 6 caracteres aleatorios. */
export function generarSemilla(ahora = new Date(), aleatorio = Math.random): string {
  const fecha = ahora.toISOString().slice(0, 10).replace(/-/g, "");
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sufijo = "";
  for (let i = 0; i < 6; i++) sufijo += alfabeto[Math.floor(aleatorio() * alfabeto.length)];
  return `${fecha}-${sufijo}`;
}
