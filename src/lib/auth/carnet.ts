/**
 * Reglas de identidad del club. Sin dependencias para poder testearlas.
 *
 * El usuario se identifica con su carnet UVG (o EXT-xxx para externos). Como
 * Supabase Auth exige un email, se deriva uno interno que nunca se usa para
 * enviar correo.
 */

export const DOMINIO_INTERNO = "uvgtt.local";

/** Debe coincidir con el CHECK usuario_carnet_formato de la base de datos. */
export const CARNET_REGEX = /^([0-9]{4,8}|EXT-[A-Z0-9]{2,12})$/;

export const PIN_REGEX = /^[0-9]{6}$/;

/** Quita espacios y pone mayúsculas: " ext-01 " -> "EXT-01". */
export function normalizarCarnet(entrada: string): string {
  return entrada.trim().toUpperCase();
}

export function esCarnetValido(carnet: string): boolean {
  return CARNET_REGEX.test(carnet);
}

export function esPinValido(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

export function emailDesdeCarnet(carnet: string): string {
  const c = normalizarCarnet(carnet);
  if (!esCarnetValido(c)) throw new Error("Carnet inválido");
  // Los emails son case-insensitive pero GoTrue los guarda en minúsculas.
  return `${c.toLowerCase()}@${DOMINIO_INTERNO}`;
}
