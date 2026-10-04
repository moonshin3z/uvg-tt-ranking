/**
 * El calendario del club, pegado desde Excel. Puro y testeable.
 *
 * El coordinador arma en una hoja en qué semana va cada partido, con filas
 * como «1 · Division 1 · Giancarlo R. vs Arturo S.». Acá se lee eso y se
 * reconoce a cada jugador entre los inscritos de su división. Los nombres de
 * la hoja suelen ser cortos («Diego Q.») y a veces vienen con otra ortografía
 * («Joseph B.» por «Joshep»), así que no se exige que coincidan letra por
 * letra: se muestra qué se entendió y el coordinador corrige antes de guardar.
 */
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { DIVISIONES } from "./divisiones";

export type FilaCalendario = {
  /** 1 es la primera línea pegada, para poder señalarla. */
  linea: number;
  semana: number;
  division: DivisionTipo | null;
  a: string;
  b: string;
};

/** «Division 1», «División 2», «Primera», «Div 3». */
export function leerDivision(texto: string): DivisionTipo | null {
  const t = normalizar(texto);
  // El número solo, sin «División», es la semana: no se toma como división.
  const numero = /^(division|div)\s*([1-9])$/.exec(t);
  if (numero) return DIVISIONES[Number(numero[2]) - 1] ?? null;
  const nombre = /^(division\s+)?(primera|segunda|tercera)(\s+division)?$/.exec(t);
  return nombre ? (nombre[2] as DivisionTipo) : null;
}

/**
 * Lee las filas con un partido. Lo demás (el título, el encabezado, el resumen
 * de carga semanal) se ignora sin avisar: no tiene «vs».
 */
export function leerCalendario(texto: string): FilaCalendario[] {
  const filas: FilaCalendario[] = [];
  const lineas = texto.split(/\r?\n/);
  let semanaAnterior: number | null = null;

  for (let i = 0; i < lineas.length; i++) {
    const campos = partirFila(lineas[i]);
    const partido = campos.find((c) => /\s+vs\.?\s+/i.test(c));
    if (!partido) continue;
    const [a, b] = partido.split(/\s+vs\.?\s+/i).map(limpiar);
    if (!a || !b) continue;

    const numero = campos.find((c) => /^\d{1,2}$/.test(c.trim()));
    const division = campos.map(leerDivision).find((d) => d !== null) ?? null;
    // Hay hojas que ponen la semana solo en la primera fila de cada bloque.
    const semana: number | null = numero ? Number(numero) : semanaAnterior;
    if (semana === null || semana < 1) continue;
    semanaAnterior = semana;

    filas.push({ linea: i + 1, semana, division, a, b });
  }
  return filas;
}

// ---------------------------------------------------------------------------
// Reconocer a los jugadores
// ---------------------------------------------------------------------------

export type Inscrito = { id: string; nombre: string; division: DivisionTipo };

export type Reconocido = {
  /** El nombre tal como viene en la hoja. */
  texto: string;
  division: DivisionTipo | null;
  /** Null si no se pudo reconocer. */
  id: string | null;
  como: "igual" | "parecido" | "descarte" | "ninguno" | "varios";
};

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cuántas letras hay que cambiar para pasar de una palabra a la otra, contando
 * como una sola dos letras vecinas cambiadas de lugar («Joseph» y «Joshep»).
 */
export function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * «Diego Q.» es «Diego Quan»: el primer nombre igual y cada palabra que sigue
 * es el principio de la palabra correspondiente. También vale un primer nombre
 * mal escrito («Joseph B.» por «Joshep»): hasta dos letras si tiene 5 o más,
 * una si tiene 4. Más corto no se adivina.
 */
function seParece(hoja: string, inscrito: string): boolean {
  const h = normalizar(hoja).split(" ");
  const n = normalizar(inscrito).split(" ");
  if (h.length === 0) return false;
  const tolerancia = h[0].length >= 5 ? 2 : h[0].length === 4 ? 1 : 0;
  const mismoNombre = h[0] === n[0] || (tolerancia > 0 && distancia(h[0], n[0]) <= tolerancia);
  if (!mismoNombre) return false;
  // Lo que sigue tiene que calzar con lo que tenga el inscrito; si el inscrito
  // tiene menos palabras («Joshep»), las de más de la hoja no lo descartan.
  return h.slice(1).every((palabra, i) => n[i + 1] === undefined || n[i + 1].startsWith(palabra));
}

/**
 * Reconoce cada nombre distinto de la hoja entre los inscritos de su división.
 *
 * Igual (sin mirar tildes, mayúsculas ni puntos) gana; si no, uno que se
 * parezca. Si en una división queda un solo nombre sin reconocer y un solo
 * inscrito sin nombre, son el mismo: por descarte. `elegidos` son las
 * correcciones del coordinador, que mandan sobre todo lo demás.
 */
export function reconocer(
  filas: readonly FilaCalendario[],
  inscritos: readonly Inscrito[],
  elegidos: Readonly<Record<string, string>> = {},
): Reconocido[] {
  const clave = (texto: string, division: DivisionTipo | null) => `${division ?? ""}|${normalizar(texto)}`;
  const nombres = new Map<string, { texto: string; division: DivisionTipo | null }>();
  for (const f of filas) {
    for (const texto of [f.a, f.b]) {
      const k = clave(texto, f.division);
      if (!nombres.has(k)) nombres.set(k, { texto, division: f.division });
    }
  }

  const resultado: Reconocido[] = [...nombres.entries()].map(([k, { texto, division }]) => {
    const candidatos = inscritos.filter((j) => division === null || j.division === division);
    const elegido = elegidos[k];
    if (elegido && candidatos.some((j) => j.id === elegido)) return { texto, division, id: elegido, como: "igual" };
    const iguales = candidatos.filter((j) => normalizar(j.nombre) === normalizar(texto));
    if (iguales.length === 1) return { texto, division, id: iguales[0].id, como: "igual" };
    const parecidos = candidatos.filter((j) => seParece(texto, j.nombre));
    if (parecidos.length === 1) return { texto, division, id: parecidos[0].id, como: "parecido" };
    return { texto, division, id: null, como: parecidos.length > 1 ? "varios" : "ninguno" };
  });

  // Por descarte, división por división.
  for (const division of [...DIVISIONES, null] as const) {
    const sinReconocer = resultado.filter((r) => r.division === division && r.id === null);
    if (sinReconocer.length !== 1) continue;
    const usados = new Set(resultado.filter((r) => r.id !== null).map((r) => r.id));
    const libres = inscritos.filter((j) => (division === null || j.division === division) && !usados.has(j.id));
    if (libres.length === 1) {
      sinReconocer[0].id = libres[0].id;
      sinReconocer[0].como = "descarte";
    }
  }

  return resultado;
}

/** La clave con que el formulario manda la corrección de un nombre. */
export function claveNombre(texto: string, division: DivisionTipo | null): string {
  return `${division ?? ""}|${normalizar(texto)}`;
}

export type PartidoDelCalendario = { jugador_a: string; jugador_b: string; semana: number };

export type RevisionCalendario = {
  filas: number;
  semanas: number;
  nombres: Reconocido[];
  /** Lo que impide guardar. */
  problemas: string[];
  partidos: PartidoDelCalendario[];
};

/** Lee, reconoce y arma lo que se guardaría, con lo que impide guardarlo. */
export function revisarCalendario(
  texto: string,
  inscritos: readonly Inscrito[],
  elegidos: Readonly<Record<string, string>> = {},
): RevisionCalendario {
  const filas = leerCalendario(texto);
  const nombres = reconocer(filas, inscritos, elegidos);
  const id = (t: string, d: DivisionTipo | null) =>
    nombres.find((n) => claveNombre(n.texto, n.division) === claveNombre(t, d))?.id ?? null;
  const problemas: string[] = [];

  if (filas.length === 0)
    problemas.push("No encontré ningún partido. Cada fila tiene que traer «Fulano vs Mengano».");

  const sinNombre = nombres.filter((n) => n.id === null);
  if (sinNombre.length > 0) {
    problemas.push(
      `Falta decir quién es ${sinNombre.map((n) => `«${n.texto}»`).join(", ")}. Elegilo en la lista de abajo.`,
    );
  }

  // Dos nombres de la hoja no pueden ser la misma persona.
  const porId = new Map<string, string[]>();
  for (const n of nombres) if (n.id) porId.set(n.id, [...(porId.get(n.id) ?? []), n.texto]);
  for (const [, textos] of porId) {
    if (textos.length > 1)
      problemas.push(`${textos.map((t) => `«${t}»`).join(" y ")} quedaron como la misma persona.`);
  }

  const partidos: PartidoDelCalendario[] = [];
  for (const f of filas) {
    const a = id(f.a, f.division);
    const b = id(f.b, f.division);
    if (a && b) partidos.push({ jugador_a: a, jugador_b: b, semana: f.semana });
  }

  return {
    filas: filas.length,
    semanas: filas.length ? Math.max(...filas.map((f) => f.semana)) : 0,
    nombres,
    problemas,
    partidos,
  };
}

/**
 * Los campos de una fila. Si viene escrita a mano con espacios simples («1
 * Division 1 Ana vs Bruno»), se separan la semana y la división del partido.
 */
function partirFila(linea: string): string[] {
  const campos = partir(linea);
  if (campos.length !== 1) return campos;
  const m = /^(\d{1,2})\s+(?:((?:divisi[oó]n|div\.?)\s*\d|primera|segunda|tercera)\s+)?(.+\s+vs\.?\s+.+)$/i.exec(
    campos[0],
  );
  return m ? [m[1], m[2] ?? "", m[3]] : campos;
}

/** Tabulación primero (es lo que pega Excel), después dos o más espacios. */
function partir(linea: string): string[] {
  const t = linea.trim();
  if (t === "") return [];
  if (t.includes("\t")) return t.split("\t").map((c) => c.trim());
  return t.split(/\s{2,}|\s*[|;]\s*/).map((c) => c.trim());
}

function limpiar(s: string) {
  return s.trim().replace(/\s+/g, " ");
}
