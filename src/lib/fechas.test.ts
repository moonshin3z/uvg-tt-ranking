import { describe, expect, it } from "vitest";
import {
  cuandoPaso,
  diasHasta,
  formatearDia,
  formatearFecha,
  formatearFechaLarga,
  horasParaAutoconfirmar,
  textoAutoconfirmacion,
  textoFechaLimite,
} from "./fechas";

const ahora = new Date("2026-09-15T18:00:00Z");

describe("diasHasta", () => {
  it("cuenta días calendario", () => {
    expect(diasHasta("2026-09-20", ahora)).toBe(5);
    expect(diasHasta("2026-09-16", ahora)).toBe(1);
    expect(diasHasta("2026-09-15", ahora)).toBe(0);
    expect(diasHasta("2026-09-13", ahora)).toBe(-2);
  });

  it("acepta fechas con hora", () => {
    expect(diasHasta("2026-09-20T00:00:00Z", ahora)).toBe(5);
  });
});

describe("formatearFecha", () => {
  // La fecha límite de un ranking es una columna `date`: llega como
  // "2026-10-24", sin hora. Leída como medianoche UTC, en Guatemala caía el
  // día anterior y la portada decía que el ranking cerraba el 23.
  it("una fecha sin hora es ese mismo día en Guatemala", () => {
    expect(formatearFecha("2026-10-24")).toMatch(/\b24\b/);
    expect(formatearFechaLarga("2026-10-24")).toMatch(/sábado.*\b24\b/);
  });

  it("un instante se sigue mostrando en hora de Guatemala", () => {
    // 03:00 UTC del 15 son las 21:00 del 14 en Guatemala.
    expect(formatearFecha("2026-09-15T03:00:00Z")).toMatch(/\b14\b/);
  });
});

describe("textoFechaLimite", () => {
  it("dice lo que corresponde según el día", () => {
    expect(textoFechaLimite("2026-09-27", ahora)).toBe("faltan 12 días");
    expect(textoFechaLimite("2026-09-16", ahora)).toBe("es mañana");
    expect(textoFechaLimite("2026-09-15", ahora)).toBe("es hoy");
    expect(textoFechaLimite("2026-09-14", ahora)).toBe("venció ayer");
    expect(textoFechaLimite("2026-09-10", ahora)).toBe("venció hace 5 días");
  });
});

describe("autoconfirmación", () => {
  it("cuenta las horas que faltan", () => {
    expect(horasParaAutoconfirmar("2026-09-15T12:00:00Z", 72, ahora)).toBe(66);
    expect(horasParaAutoconfirmar("2026-09-12T12:00:00Z", 72, ahora)).toBe(-6);
  });

  it("sin plazo o sin registro devuelve null", () => {
    expect(horasParaAutoconfirmar("2026-09-15T12:00:00Z", null, ahora)).toBeNull();
    expect(horasParaAutoconfirmar(null, 72, ahora)).toBeNull();
    expect(textoAutoconfirmacion(null, 72, ahora)).toBeNull();
  });

  it("redacta en horas o días según cuánto falte", () => {
    expect(textoAutoconfirmacion("2026-09-15T17:00:00Z", 72, ahora)).toBe("se confirma solo en 3 días");
    expect(textoAutoconfirmacion("2026-09-15T12:00:00Z", 10, ahora)).toBe("se confirma solo en 4 horas");
    expect(textoAutoconfirmacion("2026-09-15T12:00:00Z", 7, ahora)).toBe("se confirma solo en 1 hora");
    expect(textoAutoconfirmacion("2026-09-10T12:00:00Z", 72, ahora)).toBe("se confirma en cualquier momento");
  });
});

describe("cuandoPaso", () => {
  // ahora = 15 de septiembre, 12:00 en Guatemala
  it("dice Hoy y Ayer contando días de Guatemala", () => {
    expect(cuandoPaso("2026-09-15T15:00:00Z", ahora)).toBe("Hoy");
    // 14 de septiembre a las 11 p.m. en Guatemala, aunque en UTC ya es el 15.
    expect(cuandoPaso("2026-09-15T05:00:00Z", ahora)).toBe("Ayer");
    expect(cuandoPaso("2026-09-14T08:00:00Z", ahora)).toBe("Ayer");
  });

  it("antes de ayer da la fecha corta", () => {
    expect(cuandoPaso("2026-09-12T18:00:00Z", ahora)).toMatch(/\b12\b/);
  });
});

describe("formatearDia", () => {
  it("da el día y el mes completo", () => {
    expect(formatearDia("2026-09-14")).toMatch(/^14 de septiembre$/);
  });
});
