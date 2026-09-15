import { describe, expect, it } from "vitest";
import { barajar, generarSemilla, sortearDivisiones } from "./sorteo";

const ids = Array.from({ length: 9 }, (_, i) => `u${i + 1}`);

describe("sortearDivisiones", () => {
  it("es determinista para la misma semilla", () => {
    expect(sortearDivisiones(ids, "20260915-ABC123")).toEqual(sortearDivisiones(ids, "20260915-ABC123"));
  });

  it("cambia con otra semilla", () => {
    const a = sortearDivisiones(ids, "s1").map((x) => x.usuario_id);
    const b = sortearDivisiones(ids, "s2").map((x) => x.usuario_id);
    expect(a).not.toEqual(b);
  });

  it("no depende del orden de entrada", () => {
    const desordenados = [...ids].reverse();
    expect(sortearDivisiones(desordenados, "s")).toEqual(sortearDivisiones(ids, "s"));
  });

  it("Mayor = ceil(n/2), Menor = resto, sin repetidos", () => {
    const r = sortearDivisiones(ids, "s");
    expect(r.filter((x) => x.division === "mayor")).toHaveLength(5);
    expect(r.filter((x) => x.division === "menor")).toHaveLength(4);
    expect(new Set(r.map((x) => x.usuario_id)).size).toBe(9);
  });

  it("rechaza menos de 4", () => {
    expect(() => sortearDivisiones(["a", "b", "c"], "s")).toThrow();
  });

  it("barajar no muta ni pierde elementos", () => {
    const original = [...ids];
    const b = barajar(ids, "x");
    expect(ids).toEqual(original);
    expect([...b].sort()).toEqual([...ids].sort());
  });
});

describe("generarSemilla", () => {
  it("tiene formato fecha-sufijo", () => {
    expect(generarSemilla(new Date("2026-09-15T12:00:00Z"), () => 0)).toBe("20260915-AAAAAA");
  });
});
