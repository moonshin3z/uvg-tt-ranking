/**
 * Sorteo de torneo, reproducible: misma semilla, mismo cuadro.
 *
 * Mismo reparto de trabajo que el sorteo del ranking: acá se decide el ORDEN de
 * siembra y SQL construye la llave o los grupos a partir de él. La semilla
 * queda guardada en `torneo_sorteo` para poder rehacer el sorteo y comprobar
 * que salió lo mismo.
 */

import { barajar } from "@/lib/ranking/sorteo";

export { generarSemilla } from "@/lib/ranking/sorteo";

/** Un jugador que puede ir sembrado a mano por el coordinador. */
export type Participante = {
  usuario_id: string;
  /** 1 = primera cabeza de serie. null o undefined = va al sorteo. */
  siembra?: number | null;
};

/**
 * Orden de siembra final, del puesto 1 al N.
 *
 * Las cabezas de serie que puso el coordinador ocupan su puesto exacto; los
 * demás se barajan con la semilla y rellenan los puestos libres en orden. Así
 * sembrar a mano y sortear conviven sin que uno pise al otro.
 */
export function ordenarSiembra(participantes: readonly Participante[], semilla: string): string[] {
  const vistos = new Set<string>();
  for (const p of participantes) {
    if (vistos.has(p.usuario_id)) throw new Error("Hay un jugador repetido en la lista");
    vistos.add(p.usuario_id);
  }
  const n = participantes.length;
  if (n < 2) throw new Error("Hacen falta al menos 2 jugadores");

  const puestos: (string | null)[] = Array.from({ length: n }, () => null);
  const libres: string[] = [];

  for (const p of participantes) {
    const s = p.siembra;
    if (s == null) {
      libres.push(p.usuario_id);
      continue;
    }
    if (!Number.isInteger(s) || s < 1 || s > n) {
      throw new Error(`La siembra ${s} está fuera de rango (hay ${n} jugadores)`);
    }
    if (puestos[s - 1] !== null) throw new Error(`Hay dos jugadores sembrados en el puesto ${s}`);
    puestos[s - 1] = p.usuario_id;
  }

  // Se ordena antes de barajar para que el resultado no dependa del orden en
  // que vinieron los ids desde la base.
  const barajados = barajar([...libres].sort(), semilla);
  let i = 0;
  for (let k = 0; k < n; k++) {
    if (puestos[k] === null) puestos[k] = barajados[i++];
  }
  return puestos as string[];
}

/** Tamaño del cuadro: la siguiente potencia de 2. 5 jugadores -> cuadro de 8. */
export function tamanioLlave(n: number): number {
  if (n < 2) throw new Error("Hacen falta al menos 2 jugadores");
  let t = 2;
  while (t < n) t *= 2;
  if (t > 64) throw new Error("La llave más grande soportada es de 64");
  return t;
}

/** Cuántos pasan sin jugar la primera ronda. */
export function cantidadDeByes(n: number): number {
  return tamanioLlave(n) - n;
}

/**
 * Orden en que se colocan las posiciones del cuadro, igual que `orden_siembra`
 * en SQL. Se duplica acá para poder dibujar la llave antes de armarla.
 * 4 -> [1,4,2,3]   8 -> [1,8,4,5,2,7,3,6]
 */
export function ordenDeCuadro(tam: number): number[] {
  let orden = [1];
  let n = 1;
  while (n < tam) {
    const nuevo: number[] = [];
    for (const s of orden) nuevo.push(s, 2 * n + 1 - s);
    orden = nuevo;
    n *= 2;
  }
  return orden;
}

/** Los cruces de primera ronda. `null` es un bye. */
export function cruzesPrimeraRonda(orden: readonly string[]): [string | null, string | null][] {
  const tam = tamanioLlave(orden.length);
  const posiciones = ordenDeCuadro(tam);
  const cruces: [string | null, string | null][] = [];
  for (let i = 0; i < tam / 2; i++) {
    const a = posiciones[2 * i];
    const b = posiciones[2 * i + 1];
    cruces.push([orden[a - 1] ?? null, orden[b - 1] ?? null]);
  }
  return cruces;
}

/**
 * Cuántos grupos sugerir para N jugadores: apunta a grupos de 4, que es el
 * tamaño en que un round robin no se vuelve eterno (6 partidos por grupo).
 */
export function gruposSugeridos(n: number): number {
  if (n < 4) return 2;
  return Math.max(2, Math.min(8, Math.round(n / 4)));
}
