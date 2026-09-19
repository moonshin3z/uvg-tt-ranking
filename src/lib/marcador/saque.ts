export type LadoSaque = "a" | "b";

/** Saque de individuales. Los formatos cortos usan el mismo cambio en deuce. */
export function turnoDeSaque(
  primero: LadoSaque,
  puntosA: number,
  puntosB: number,
  setsJugados: number,
  puntosPorSet: number,
): LadoSaque {
  const empate = puntosPorSet - 1;
  const total = puntosA + puntosB;
  const cambios = puntosA >= empate && puntosB >= empate ? empate + total - 2 * empate : Math.floor(total / 2);
  return (setsJugados + cambios) % 2 === 0 ? primero : primero === "a" ? "b" : "a";
}
