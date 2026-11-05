import { describe, expect, it } from "vitest";
import { medallaDe, medallasDelHistorial, nombresDeOro, podioDeTabla, textoMedalla, type Podio } from "./medallas";
import type { FilaOrdenada } from "./tabla";

const fila = (nombre: string, posicion: number, pg: number): FilaOrdenada => ({
  usuario_id: nombre,
  nombre,
  carnet: `c-${nombre}`,
  pj: 4,
  pg,
  pp: 4 - pg,
  pts: pg,
  pg_desempate: 0,
  dif_sets: 0,
  posicion,
  zona: null,
});

describe("medallaDe", () => {
  it("da oro al 1.º y plata al 2.º de un ranking cerrado", () => {
    expect(medallaDe("cerrado", 1)).toBe(1);
    expect(medallaDe("cerrado", 2)).toBe(2);
    expect(medallaDe("cerrado", 3)).toBeNull();
  });

  it("no da nada mientras el ranking no se cierra, aunque vaya primero", () => {
    for (const estado of ["abierto", "fase_regular_cerrada", "en_desempates"]) {
      expect(medallaDe(estado, 1)).toBeNull();
    }
  });
});

describe("medallasDelHistorial", () => {
  it("se queda con las medallas de rankings cerrados, en el orden del historial", () => {
    const m = medallasDelHistorial([
      { ranking_id: "r3", ranking_nombre: "Ranking 3", ranking_estado: "abierto", division: "primera", posicion: 1 },
      { ranking_id: "r2", ranking_nombre: "Ranking 2", ranking_estado: "cerrado", division: "primera", posicion: 2 },
      { ranking_id: "r1", ranking_nombre: "Ranking 1", ranking_estado: "cerrado", division: "segunda", posicion: 1 },
      { ranking_id: "r0", ranking_nombre: "Ranking 0", ranking_estado: "cerrado", division: "segunda", posicion: 4 },
    ]);
    expect(m.map((x) => [x.rankingId, x.puesto])).toEqual([
      ["r2", 2],
      ["r1", 1],
    ]);
    expect(textoMedalla(m[0])).toBe("Plata en Primera · Ranking 2");
    expect(textoMedalla(m[1])).toBe("Oro en Segunda · Ranking 1");
  });
});

describe("podioDeTabla", () => {
  it("toma al 1.º y al 2.º por posición", () => {
    const p = podioDeTabla("tercera", [fila("Mirna", 1, 4), fila("Joshep", 2, 3), fila("Alfred", 3, 1)]);
    expect(p.oro?.nombre).toBe("Mirna");
    expect(p.plata?.nombre).toBe("Joshep");
    expect(p.oro).toEqual({ nombre: "Mirna", carnet: "c-Mirna", pts: 4, pj: 4, pg: 4 });
  });

  it("deja vacío lo que no existe", () => {
    expect(podioDeTabla("primera", [])).toEqual({ division: "primera", oro: null, plata: null });
    expect(podioDeTabla("primera", [fila("Solo", 1, 0)]).plata).toBeNull();
  });
});

describe("nombresDeOro", () => {
  const podio = (division: Podio["division"], nombre: string | null): Podio => ({
    division,
    oro: nombre ? { nombre, carnet: nombre, pts: 0, pj: 0, pg: 0 } : null,
    plata: null,
  });

  it("junta los primeros nombres con comas y una y al final", () => {
    expect(
      nombresDeOro([
        podio("primera", "Iván Roblero"),
        podio("segunda", "Andres M."),
        podio("tercera", "wellington G"),
      ]),
    ).toBe("Iván, Andres y wellington");
    expect(nombresDeOro([podio("primera", "Iván Roblero"), podio("segunda", "Andres M.")])).toBe("Iván y Andres");
    expect(nombresDeOro([podio("primera", "Iván Roblero")])).toBe("Iván");
    expect(nombresDeOro([podio("primera", null)])).toBe("");
  });
});
