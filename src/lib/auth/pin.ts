import { randomInt } from "node:crypto";

/** PIN de 6 dígitos con aleatoriedad criptográfica; evita los triviales. */
export function generarPin(): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const repetido = /^(\d)\1{5}$/.test(pin);
    const secuencia = "0123456789012345".includes(pin) || "9876543210987654".includes(pin);
    if (!repetido && !secuencia) return pin;
  }
}
