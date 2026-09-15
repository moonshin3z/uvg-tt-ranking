import { describe, expect, it } from "vitest";
import { emailDesdeCarnet, esCarnetValido, esPinValido, normalizarCarnet } from "./carnet";

describe("carnet", () => {
  it("acepta carnets numéricos y externos", () => {
    expect(esCarnetValido("20001")).toBe(true);
    expect(esCarnetValido("2024123")).toBe(true);
    expect(esCarnetValido("EXT-01")).toBe(true);
  });

  it("rechaza formatos inválidos", () => {
    expect(esCarnetValido("123")).toBe(false);
    expect(esCarnetValido("ext-01")).toBe(false); // sin normalizar
    expect(esCarnetValido("20001; drop")).toBe(false);
    expect(esCarnetValido("")).toBe(false);
  });

  it("normaliza espacios y mayúsculas", () => {
    expect(normalizarCarnet("  ext-01 ")).toBe("EXT-01");
  });

  it("deriva el email interno en minúsculas", () => {
    expect(emailDesdeCarnet(" EXT-01 ")).toBe("ext-01@uvgtt.local");
    expect(emailDesdeCarnet("20001")).toBe("20001@uvgtt.local");
    expect(() => emailDesdeCarnet("abc")).toThrow();
  });

  it("PIN de 6 dígitos", () => {
    expect(esPinValido("123456")).toBe(true);
    expect(esPinValido("12345")).toBe(false);
    expect(esPinValido("12345a")).toBe(false);
  });
});
