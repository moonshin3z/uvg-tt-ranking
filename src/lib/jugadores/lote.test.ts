import { describe, expect, it } from "vitest";
import { leerLote } from "./lote";

describe("leerLote", () => {
  it("lee dos columnas pegadas desde Excel", () => {
    const filas = leerLote("20001\tAna López\n20002\tBruno Pérez");
    expect(filas).toEqual([
      { linea: 1, carnet: "20001", nombre: "Ana López" },
      { linea: 2, carnet: "20002", nombre: "Bruno Pérez" },
    ]);
  });

  it("no le importa el orden de las columnas", () => {
    const filas = leerLote("Ana López\t20001");
    expect(filas[0]).toMatchObject({ carnet: "20001", nombre: "Ana López" });
  });

  it("acepta comas y espacios, no solo tabulaciones", () => {
    expect(leerLote("20001,Ana López")[0]).toMatchObject({ carnet: "20001", nombre: "Ana López" });
    expect(leerLote("20001   Ana López")[0]).toMatchObject({ carnet: "20001", nombre: "Ana López" });
  });

  it("salta el encabezado de la hoja, y solo si va primero", () => {
    const filas = leerLote("Carnet\tNombre\n20001\tAna López");
    expect(filas).toHaveLength(1);
    expect(filas[0].carnet).toBe("20001");
  });

  it("acepta carnets de externos y los deja en mayúsculas", () => {
    expect(leerLote("ext-01\tPedro Visitante")[0]).toMatchObject({ carnet: "EXT-01", nombre: "Pedro Visitante" });
  });

  it("junta los espacios de más del nombre", () => {
    expect(leerLote("20001\tAna    María   López")[0].nombre).toBe("Ana María López");
  });

  it("ignora las líneas en blanco sin correr la numeración", () => {
    const filas = leerLote("20001\tAna López\n\n\n20002\tBruno Pérez");
    expect(filas.map((f) => f.linea)).toEqual([1, 4]);
  });

  it("marca la línea sin carnet reconocible", () => {
    const filas = leerLote("Ana López\tBruno Pérez");
    expect(filas[0].problema).toMatch(/forma de carnet/);
  });

  it("marca la línea con una sola columna", () => {
    expect(leerLote("20001")[0].problema).toMatch(/Falta/);
  });

  it("marca la línea con tres columnas en vez de inventarse cuál sobra", () => {
    expect(leerLote("20001\tAna\tLópez")[0].problema).toMatch(/3 columnas/);
  });

  it("marca el carnet repetido en la segunda aparición y deja buena la primera", () => {
    const filas = leerLote("20001\tAna López\n20001\tOtra Persona");
    expect(filas[0].problema).toBeUndefined();
    expect(filas[1].problema).toMatch(/repetido/);
  });

  it("avisa cuando las dos columnas parecen carnet", () => {
    expect(leerLote("20001\t20002")[0].problema).toMatch(/parecen carnet/);
  });

  it("marca el nombre demasiado corto", () => {
    expect(leerLote("20001\tA")[0].problema).toMatch(/corto/);
  });

  it("una lista entera buena no trae ningún problema", () => {
    const pegado = [
      "Carnet\tNombre",
      "20001\tAna López",
      "20002\tBruno Pérez",
      "20003\tCarla Méndez",
      "EXT-01\tPedro Visitante",
    ].join("\n");
    const filas = leerLote(pegado);
    expect(filas).toHaveLength(4);
    expect(filas.filter((f) => f.problema)).toEqual([]);
  });
});
