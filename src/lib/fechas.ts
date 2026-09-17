/**
 * Formato y cuentas de tiempo, en la zona horaria de Guatemala.
 * Puro y testeable: las páginas son server components, así que estos textos
 * se calculan en cada request y no dependen del reloj del navegador.
 */

const ZONA = "America/Guatemala";

export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", timeZone: ZONA }).format(new Date(iso));
}

export function formatearFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  }).format(new Date(iso));
}

/** Días calendario entre hoy y una fecha (negativo si ya pasó). */
export function diasHasta(fecha: string, ahora = new Date()): number {
  const dia = 86_400_000;
  const aMedianoche = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // Las fechas límite vienen como "2026-12-15" (sin hora): se comparan como día.
  const objetivo = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  return Math.round((aMedianoche(objetivo) - aMedianoche(ahora)) / dia);
}

export function textoFechaLimite(fecha: string, ahora = new Date()): string {
  const d = diasHasta(fecha, ahora);
  if (d > 1) return `faltan ${d} días`;
  if (d === 1) return "es mañana";
  if (d === 0) return "es hoy";
  if (d === -1) return "venció ayer";
  return `venció hace ${Math.abs(d)} días`;
}

/**
 * Cuánto falta para que un resultado registrado se confirme solo.
 * `horas` null significa que no hay plazo.
 */
export function horasParaAutoconfirmar(
  registradoEn: string | null,
  horas: number | null,
  ahora = new Date(),
): number | null {
  if (!registradoEn || horas == null) return null;
  const vence = new Date(registradoEn).getTime() + horas * 3_600_000;
  return Math.ceil((vence - ahora.getTime()) / 3_600_000);
}

export function textoAutoconfirmacion(
  registradoEn: string | null,
  horas: number | null,
  ahora = new Date(),
): string | null {
  const restantes = horasParaAutoconfirmar(registradoEn, horas, ahora);
  if (restantes === null) return null;
  if (restantes <= 0) return "se confirma en cualquier momento";
  if (restantes === 1) return "se confirma solo en 1 hora";
  if (restantes < 24) return `se confirma solo en ${restantes} horas`;
  const dias = Math.ceil(restantes / 24);
  return `se confirma solo en ${dias} día${dias === 1 ? "" : "s"}`;
}
