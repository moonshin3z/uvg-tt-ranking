/**
 * Las semanas del ranking, del lado de la aplicación. Puro y testeable.
 *
 * La base reparte los partidos (`planificar_semanas`) y guarda en cada uno su
 * `semana`. Acá solo se cuentan fechas y se arma lo que muestra una semana.
 * Las cuentas son las mismas de `semana_de` en SQL: la semana 1 empieza el
 * lunes `inicio_semanas` y se cuenta en días de Guatemala.
 */
import type { DivisionTipo, PartidoEstado } from "@/lib/supabase/tipos";
import { DIVISIONES } from "./divisiones";

const ZONA = "America/Guatemala";
const DIA = 86_400_000;

/** Hoy en Guatemala, como "2026-10-05". */
export function hoyEnGuatemala(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora);
}

function aUtc(fecha: string): number {
  return Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha) + dias * DIA).toISOString().slice(0, 10);
}

/** Número de semana de un día; antes de la semana 1 da 0 o menos. */
export function semanaDe(inicio: string, dia: string): number {
  return Math.floor((aUtc(dia) - aUtc(inicio)) / (7 * DIA)) + 1;
}

export function semanaActual(inicio: string, ahora = new Date()): number {
  return semanaDe(inicio, hoyEnGuatemala(ahora));
}

/**
 * El lunes que la base usa si el coordinador no elige otro: esta semana si hoy
 * es lunes o martes (todavía quedan los tres días de juego), si no la que viene.
 */
export function lunesSugerido(ahora = new Date()): string {
  const hoy = hoyEnGuatemala(ahora);
  const dow = new Date(aUtc(hoy)).getUTCDay(); // 0 domingo … 6 sábado
  const desdeLunes = (dow + 6) % 7;
  const lunes = sumarDias(hoy, -desdeLunes);
  return desdeLunes <= 1 ? lunes : sumarDias(lunes, 7);
}

/** Lleva la fecha al lunes de su semana. */
export function lunesDe(fecha: string): string {
  const dow = new Date(aUtc(fecha)).getUTCDay();
  return sumarDias(fecha, -((dow + 6) % 7));
}

const MES = new Intl.DateTimeFormat("es-GT", { month: "long", timeZone: "UTC" });

/** "6 al 8 de octubre" o "29 de septiembre al 1 de octubre": de martes a jueves. */
export function textoSemana(inicio: string, semana: number): string {
  const martes = sumarDias(inicio, (semana - 1) * 7 + 1);
  const jueves = sumarDias(martes, 2);
  const mes = (f: string) => MES.format(new Date(aUtc(f)));
  const dia = (f: string) => Number(f.slice(8, 10));
  return mes(martes) === mes(jueves)
    ? `${dia(martes)} al ${dia(jueves)} de ${mes(jueves)}`
    : `${dia(martes)} de ${mes(martes)} al ${dia(jueves)} de ${mes(jueves)}`;
}

/**
 * Si los días de juego de una semana ya pasaron. Desde el viernes una semana
 * muestra sus resultados; lo que no se jugó queda como «no se jugó».
 */
export function semanaTerminada(inicio: string, semana: number, ahora = new Date()): boolean {
  const jueves = sumarDias(inicio, (semana - 1) * 7 + 3);
  return hoyEnGuatemala(ahora) > jueves;
}

// ---------------------------------------------------------------------------
// Lo que muestra una semana
// ---------------------------------------------------------------------------

export type PartidoSemanal = {
  id: string;
  semana: number | null;
  estado: PartidoEstado;
  division: DivisionTipo;
  a: { id: string; nombre: string; carnet: string };
  b: { id: string; nombre: string; carnet: string };
  ganador: string | null;
  sets_a: number | null;
  sets_b: number | null;
  registrado_en: string | null;
};

export type SituacionPartido = "por_jugar" | "sin_confirmar" | "en_disputa" | "jugado" | "no_se_jugo";

export type FilaSemana = PartidoSemanal & {
  situacion: SituacionPartido;
  /** Era de una semana anterior y se jugó (o sigue sin jugarse) después. */
  deLaSemana?: number;
};

export type Semana = {
  numero: number;
  total: number;
  porDivision: { division: DivisionTipo; partidos: FilaSemana[] }[];
  /** Partidos de semanas anteriores que siguen sin jugarse. Solo en la semana en curso. */
  pendientesAnteriores: FilaSemana[];
  jugados: number;
  porJugar: number;
};

function situacion(p: PartidoSemanal, terminada: boolean): SituacionPartido {
  if (p.estado === "confirmado" || p.estado === "resuelto") return "jugado";
  if (p.estado === "jugado") return "sin_confirmar";
  if (p.estado === "disputado") return "en_disputa";
  return terminada ? "no_se_jugo" : "por_jugar";
}

/**
 * Arma la semana `numero`: sus partidos por división y, aparte, los que se
 * jugaron esa semana siendo de una semana anterior (atrasados).
 *
 * Un partido adelantado ya viene con la semana en que se jugó (la base lo
 * mueve), así que aparece en esa semana sin hacer nada especial.
 */
export function armarSemana(
  partidos: readonly PartidoSemanal[],
  inicio: string,
  numero: number,
  ahora = new Date(),
): Semana {
  const vivos = partidos.filter((p) => p.estado !== "anulado" && p.semana !== null);
  const total = Math.max(0, ...vivos.map((p) => p.semana ?? 0));
  const terminada = semanaTerminada(inicio, numero, ahora);
  const actual = semanaActual(inicio, ahora);

  const jugadaEn = (p: PartidoSemanal) =>
    p.registrado_en ? semanaDe(inicio, hoyEnGuatemala(new Date(p.registrado_en))) : null;

  const deEsta: FilaSemana[] = vivos
    .filter((p) => p.semana === numero)
    .map((p) => ({ ...p, situacion: situacion(p, terminada) }));

  const atrasados: FilaSemana[] = vivos
    .filter((p) => (p.semana ?? 0) < numero && p.estado !== "pendiente" && jugadaEn(p) === numero)
    .map((p) => ({
      ...p,
      situacion: situacion(p, terminada),
      deLaSemana: p.semana ?? 0,
    }));

  const todas = [...deEsta, ...atrasados];
  const porDivision = DIVISIONES.map((division) => ({
    division,
    partidos: todas.filter((p) => p.division === division),
  })).filter((d) => d.partidos.length > 0);

  const pendientesAnteriores: FilaSemana[] =
    numero === actual
      ? vivos
          .filter((p) => (p.semana ?? 0) < numero && p.estado === "pendiente")
          .map((p) => ({
            ...p,
            situacion: "no_se_jugo" as const,
            deLaSemana: p.semana ?? 0,
          }))
      : [];

  return {
    numero,
    total,
    porDivision,
    pendientesAnteriores,
    jugados: todas.filter((p) => p.situacion !== "por_jugar" && p.situacion !== "no_se_jugo").length,
    porJugar: todas.filter((p) => p.situacion === "por_jugar").length,
  };
}

/** Qué semana mostrar si no se pide una: la en curso, sin pasarse de las que hay. */
export function semanaPorDefecto(inicio: string, total: number, ahora = new Date()): number {
  if (total < 1) return 1;
  return Math.min(Math.max(semanaActual(inicio, ahora), 1), total);
}
