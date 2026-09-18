import { CARNET_REGEX, normalizarCarnet } from "@/lib/auth/carnet";

export type FilaLote = {
  /** 1 es la primera línea que escribió el coordinador, para poder señalarla. */
  linea: number;
  carnet: string;
  nombre: string;
  /** Qué tiene de malo, si tiene algo. */
  problema?: string;
};

/**
 * Interpreta lo que se pega desde Excel o Sheets.
 *
 * Copiar dos columnas de una hoja y pegarlas da líneas con tabulaciones, así
 * que ese es el formato principal. Se aceptan además comas y dos o más
 * espacios, porque la gente también escribe la lista a mano o la copia de un
 * documento.
 *
 * El orden de las columnas no se pregunta: se deduce. De los dos campos, el
 * que tiene forma de carnet es el carnet. Preguntar «¿cuál columna es cuál?»
 * es una decisión que el sistema puede tomar solo y equivocarse menos que
 * quien está apurado llenando el club.
 */
export function leerLote(texto: string): FilaLote[] {
  const filas: FilaLote[] = [];
  const lineas = texto.split(/\r?\n/);

  for (let i = 0; i < lineas.length; i++) {
    const cruda = lineas[i].trim();
    if (cruda === "") continue;

    const campos = partir(cruda);
    const linea = i + 1;

    // Encabezado de la hoja: se salta en silencio y solo si es la primera fila
    // con contenido, para no tragarse a alguien que de verdad se llame así.
    if (filas.length === 0 && esEncabezado(campos)) continue;

    if (campos.length < 2) {
      filas.push({ linea, carnet: "", nombre: cruda, problema: "Falta el carnet o el nombre" });
      continue;
    }
    if (campos.length > 2) {
      filas.push({
        linea,
        carnet: "",
        nombre: cruda,
        problema: `Trae ${campos.length} columnas y esperaba 2 (carnet y nombre)`,
      });
      continue;
    }

    const [a, b] = campos;
    const aEsCarnet = CARNET_REGEX.test(normalizarCarnet(a));
    const bEsCarnet = CARNET_REGEX.test(normalizarCarnet(b));

    let carnet: string;
    let nombre: string;
    if (aEsCarnet && !bEsCarnet) {
      carnet = normalizarCarnet(a);
      nombre = limpiarNombre(b);
    } else if (bEsCarnet && !aEsCarnet) {
      carnet = normalizarCarnet(b);
      nombre = limpiarNombre(a);
    } else if (aEsCarnet && bEsCarnet) {
      // Dos números: se toma el primero como carnet, que es el orden de casi
      // toda hoja, y se avisa para que lo mire.
      carnet = normalizarCarnet(a);
      nombre = limpiarNombre(b);
      filas.push({ linea, carnet, nombre, problema: "Las dos columnas parecen carnet; revisá cuál es el nombre" });
      continue;
    } else {
      filas.push({
        linea,
        carnet: "",
        nombre: cruda,
        problema: "Ninguna de las dos columnas tiene forma de carnet",
      });
      continue;
    }

    if (nombre.length < 2) {
      filas.push({ linea, carnet, nombre, problema: "El nombre es muy corto" });
      continue;
    }
    if (nombre.length > 80) {
      filas.push({ linea, carnet, nombre, problema: "El nombre es muy largo" });
      continue;
    }

    filas.push({ linea, carnet, nombre });
  }

  return marcarRepetidos(filas);
}

/** Tabulación primero (es lo que pega Excel), después coma, después espacios. */
function partir(linea: string): string[] {
  if (linea.includes("\t")) return linea.split("\t").map((c) => c.trim());
  if (linea.includes(",")) return linea.split(",").map((c) => c.trim());
  return linea.split(/\s{2,}/).map((c) => c.trim());
}

function limpiarNombre(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function esEncabezado(campos: string[]) {
  const t = campos.join(" ").toLowerCase();
  return /carn[eé]/.test(t) && /nombre|jugador/.test(t);
}

/**
 * Un carnet repetido dentro de la misma lista se marca en la segunda aparición
 * y siguientes. La primera queda buena: es lo que la gente espera cuando pegó
 * una fila dos veces sin darse cuenta.
 */
function marcarRepetidos(filas: FilaLote[]): FilaLote[] {
  const vistos = new Set<string>();
  return filas.map((f) => {
    if (f.problema || f.carnet === "") return f;
    if (vistos.has(f.carnet)) return { ...f, problema: `El carnet ${f.carnet} está repetido en la lista` };
    vistos.add(f.carnet);
    return f;
  });
}
