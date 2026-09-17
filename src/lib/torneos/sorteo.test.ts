import { describe, expect, it } from "vitest";
import {
  cantidadDeByes,
  cruzesPrimeraRonda,
  gruposSugeridos,
  ordenDeCuadro,
  ordenarSiembra,
  tamanioLlave,
} from "./sorteo";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${String(i + 1).padStart(2, "0")}`);

describe("tamanioLlave", () => {
  it("redondea a la siguiente potencia de 2", () => {
    expect(tamanioLlave(2)).toBe(2);
    expect(tamanioLlave(5)).toBe(8);
    expect(tamanioLlave(8)).toBe(8);
    expect(tamanioLlave(9)).toBe(16);
  });
  it("no acepta menos de 2 ni más de 64", () => {
    expect(() => tamanioLlave(1)).toThrow();
    expect(() => tamanioLlave(65)).toThrow();
  });
  it("cuenta los byes", () => {
    expect(cantidadDeByes(5)).toBe(3);
    expect(cantidadDeByes(8)).toBe(0);
  });
});

describe("ordenDeCuadro", () => {
  it("coincide con la siembra estándar", () => {
    expect(ordenDeCuadro(2)).toEqual([1, 2]);
    expect(ordenDeCuadro(4)).toEqual([1, 4, 2, 3]);
    expect(ordenDeCuadro(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("mantiene al 1 y al 2 en mitades opuestas en todos los tamaños", () => {
    for (const tam of [4, 8, 16, 32, 64]) {
      const orden = ordenDeCuadro(tam);
      // La posición del cuadro donde cae cada siembra
      const donde = (s: number) => orden.indexOf(s);
      const mitad = tam / 2;
      expect(donde(1) < mitad).toBe(true);
      expect(donde(2) < mitad).toBe(false);
    }
  });
});

describe("cruzesPrimeraRonda", () => {
  it("empareja mejor contra peor", () => {
    expect(cruzesPrimeraRonda(ids(8))).toEqual([
      ["j01", "j08"],
      ["j04", "j05"],
      ["j02", "j07"],
      ["j03", "j06"],
    ]);
  });

  it("los byes caen sobre las cabezas de serie y nunca hay dos en el mismo cruce", () => {
    for (let n = 2; n <= 33; n++) {
      const cruces = cruzesPrimeraRonda(ids(n));
      const dobles = cruces.filter(([a, b]) => a === null && b === null);
      expect(dobles, `n=${n} tiene un cruce sin nadie`).toHaveLength(0);
      const byes = cruces.filter(([a, b]) => a === null || b === null);
      expect(byes, `n=${n}`).toHaveLength(cantidadDeByes(n));
    }
  });
});

describe("ordenarSiembra", () => {
  it("es reproducible con la misma semilla", () => {
    const a = ordenarSiembra(ids(9).map((usuario_id) => ({ usuario_id })), "SEM-1");
    const b = ordenarSiembra(ids(9).map((usuario_id) => ({ usuario_id })), "SEM-1");
    expect(a).toEqual(b);
  });

  it("cambia con otra semilla", () => {
    const a = ordenarSiembra(ids(9).map((usuario_id) => ({ usuario_id })), "SEM-1");
    const b = ordenarSiembra(ids(9).map((usuario_id) => ({ usuario_id })), "SEM-2");
    expect(a).not.toEqual(b);
  });

  it("no depende del orden en que llegan los ids", () => {
    const base = ids(9).map((usuario_id) => ({ usuario_id }));
    const revuelto = [...base].reverse();
    expect(ordenarSiembra(base, "SEM-1")).toEqual(ordenarSiembra(revuelto, "SEM-1"));
  });

  it("respeta las cabezas de serie puestas a mano", () => {
    const orden = ordenarSiembra(
      [
        { usuario_id: "j01", siembra: 1 },
        { usuario_id: "j02", siembra: 2 },
        { usuario_id: "j03" },
        { usuario_id: "j04" },
        { usuario_id: "j05" },
      ],
      "SEM-1",
    );
    expect(orden[0]).toBe("j01");
    expect(orden[1]).toBe("j02");
    expect(orden.slice(2).sort()).toEqual(["j03", "j04", "j05"]);
  });

  it("devuelve a todos, una sola vez", () => {
    const orden = ordenarSiembra(ids(12).map((usuario_id) => ({ usuario_id })), "SEM-9");
    expect(new Set(orden).size).toBe(12);
    expect([...orden].sort()).toEqual(ids(12));
  });

  it("rechaza dos sembrados en el mismo puesto", () => {
    expect(() =>
      ordenarSiembra([{ usuario_id: "a", siembra: 1 }, { usuario_id: "b", siembra: 1 }], "S"),
    ).toThrow(/puesto 1/);
  });

  it("rechaza una siembra fuera de rango", () => {
    expect(() =>
      ordenarSiembra([{ usuario_id: "a", siembra: 9 }, { usuario_id: "b" }], "S"),
    ).toThrow(/fuera de rango/);
  });

  it("rechaza jugadores repetidos", () => {
    expect(() => ordenarSiembra([{ usuario_id: "a" }, { usuario_id: "a" }], "S")).toThrow(/repetido/);
  });
});

describe("gruposSugeridos", () => {
  it("apunta a grupos de 4", () => {
    expect(gruposSugeridos(8)).toBe(2);
    expect(gruposSugeridos(16)).toBe(4);
    expect(gruposSugeridos(25)).toBe(6);
  });
});
