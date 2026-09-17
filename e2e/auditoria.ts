/**
 * La auditoría de responsive, escrita para correr DENTRO del navegador.
 *
 * Se exporta como texto de función para poder pasarla a page.evaluate sin
 * depender del bundler. Todo lo que revisa se puede comprobar mirando el DOM
 * ya renderizado, que es la única forma de saber de verdad si algo se sale.
 */

export type Hallazgo = {
  regla: string;
  detalle: string;
  selector: string;
};

export const REGLAS = {
  SIN_SCROLL_HORIZONTAL: "sin-scroll-horizontal",
  NADA_SE_SALE: "nada-se-sale",
  AREA_TACTIL: "area-tactil",
  TEXTO_CORTADO: "texto-cortado",
  LETRA_MINIMA: "letra-minima",
} as const;

/** Alto y ancho mínimos de algo que se toca con el dedo, en px CSS. */
export const TACTIL_MIN = 40;
/** Tamaño de letra por debajo del cual el texto deja de ser cómodo. */
export const LETRA_MIN = 12;

/**
 * Ojo: esta función se serializa con toString() y se evalúa dentro del
 * navegador, así que no puede referirse a NADA de fuera de su propio cuerpo.
 * Por eso los nombres de regla van escritos como texto literal y no como
 * REGLAS.LO_QUE_SEA, aunque REGLAS exista más arriba para usarla desde las
 * pruebas.
 */
export function auditar(tactilMin: number, letraMin: number): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const ancho = window.innerWidth;

  const ruta = (el: Element): string => {
    const partes: string[] = [];
    let n: Element | null = el;
    for (let i = 0; n && i < 4; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) {
        s += `#${n.id}`;
        partes.unshift(s);
        break;
      }
      const cls = (n.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += `.${cls.join(".")}`;
      partes.unshift(s);
      n = n.parentElement;
    }
    return partes.join(" > ");
  };

  // 1. La página entera no debe poder desplazarse a los lados.
  const scrollDoc = document.documentElement.scrollWidth;
  if (scrollDoc > ancho + 1) {
    hallazgos.push({
      regla: "sin-scroll-horizontal",
      detalle: `la página mide ${scrollDoc}px de ancho y la pantalla ${ancho}px`,
      selector: "html",
    });
  }

  const todos = Array.from(document.body.querySelectorAll<HTMLElement>("*"));

  for (const el of todos) {
    const est = getComputedStyle(el);
    if (est.display === "none" || est.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    // Texto que solo existe para los lectores de pantalla: mide 1x1px con el
    // contenido recortado a propósito (la clase `sr-only` de Tailwind). No es
    // un elemento roto, es accesibilidad bien hecha, así que se salta entero.
    const soloLector =
      r.width <= 1 &&
      r.height <= 1 &&
      (est.position === "absolute" || est.position === "fixed") &&
      est.overflow === "hidden";
    if (soloLector) continue;

    // 2. Ningún elemento se sale por la derecha, salvo que viva dentro de algo
    // que fue hecho a propósito para desplazarse (un cuadro de torneo, p. ej.).
    if (r.right > ancho + 1) {
      // Un elemento dentro de un contenedor que recorta o desplaza no puede
      // sacar la página de la pantalla: o se le pone scroll propio (un cuadro
      // de torneo) o queda recortado con puntos suspensivos (un nombre largo
      // con `truncate`). Los dos casos son a propósito. El texto recortado SIN
      // puntos suspensivos lo agarra la otra regla.
      let contenido = false;
      let p: HTMLElement | null = el.parentElement;
      while (p && p !== document.body) {
        const pe = getComputedStyle(p);
        if (["auto", "scroll", "hidden", "clip"].includes(pe.overflowX)) {
          contenido = true;
          break;
        }
        p = p.parentElement;
      }
      if (!contenido) {
        hallazgos.push({
          regla: "nada-se-sale",
          detalle: `llega hasta ${Math.round(r.right)}px con pantalla de ${ancho}px`,
          selector: ruta(el),
        });
      }
    }

    // 3. Lo que se toca con el dedo tiene que ser tocable.
    const esInteractivo =
      ["BUTTON", "SELECT", "TEXTAREA"].includes(el.tagName) ||
      (el.tagName === "INPUT" && !["hidden"].includes((el as HTMLInputElement).type)) ||
      el.getAttribute("role") === "button" ||
      // Los enlaces sueltos dentro de un párrafo no cuentan: son texto, no botones.
      (el.tagName === "A" && est.display !== "inline");

    // Una casilla o un radio dentro de una etiqueta grande ya es tocable: lo
    // que el dedo toca es la etiqueta entera, no el cuadrito de 16px.
    let cubiertoPorEtiqueta = false;
    if (el.tagName === "INPUT" && ["checkbox", "radio"].includes((el as HTMLInputElement).type)) {
      const lab = el.closest("label");
      if (lab) {
        const lr = lab.getBoundingClientRect();
        cubiertoPorEtiqueta = lr.height >= tactilMin && lr.width >= tactilMin;
      }
    }

    if (esInteractivo && !cubiertoPorEtiqueta && (r.height < tactilMin || r.width < tactilMin)) {
      hallazgos.push({
        regla: "area-tactil",
        detalle: `mide ${Math.round(r.width)}x${Math.round(r.height)}px, el mínimo es ${tactilMin}`,
        selector: ruta(el),
      });
    }

    // 4. Texto cortado sin puntos suspensivos ni scroll propio.
    if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0) {
      const recorta = est.overflow !== "visible" || est.overflowX !== "visible";
      const tienePuntos = est.textOverflow === "ellipsis";
      if (el.scrollWidth > el.clientWidth + 1 && recorta && !tienePuntos) {
        hallazgos.push({
          regla: "texto-cortado",
          detalle: `el texto mide ${el.scrollWidth}px y la caja ${el.clientWidth}px`,
          selector: ruta(el),
        });
      }
      const px = parseFloat(est.fontSize);
      if (px && px < letraMin) {
        hallazgos.push({
          regla: "letra-minima",
          detalle: `letra de ${px}px, el mínimo es ${letraMin}`,
          selector: ruta(el),
        });
      }
    }
  }

  // Un hallazgo por regla y selector, para no repetir cien veces lo mismo.
  const vistos = new Set<string>();
  return hallazgos.filter((h) => {
    const k = `${h.regla}|${h.selector}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}
