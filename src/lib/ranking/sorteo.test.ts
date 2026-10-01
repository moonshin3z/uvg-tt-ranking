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

  it("tres divisiones parejas, sin repetidos", () => {
    const r = sortearDivisiones(ids, "s");
    expect(r.filter((x) => x.division === "primera")).toHaveLength(3);
    expect(r.filter((x) => x.division === "segunda")).toHaveLength(3);
    expect(r.filter((x) => x.division === "tercera")).toHaveLength(3);
    expect(new Set(r.map((x) => x.usuario_id)).size).toBe(9);
  });

  it("si no da exacto, las de arriba llevan uno más", () => {
    const r = sortearDivisiones(ids.slice(0, 8), "s");
    expect(["primera", "segunda", "tercera"].map((d) => r.filter((x) => x.division === d).length)).toEqual([3, 3, 2]);
  });

  it("con dos divisiones: Primera = ceil(n/2), Segunda = resto", () => {
    const r = sortearDivisiones(ids, "s", 2);
    expect(r.filter((x) => x.division === "primera")).toHaveLength(5);
    expect(r.filter((x) => x.division === "segunda")).toHaveLength(4);
  });

  it("rechaza menos de 2 por división", () => {
    expect(() => sortearDivisiones(["a", "b", "c", "d", "e"], "s")).toThrow();
    expect(() => sortearDivisiones(["a", "b", "c"], "s", 2)).toThrow();
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
