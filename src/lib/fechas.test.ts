import { describe, expect, it } from "vitest";
import { diasHasta, horasParaAutoconfirmar, textoAutoconfirmacion, textoFechaLimite } from "./fechas";

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
