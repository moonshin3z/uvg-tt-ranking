import { describe, expect, it } from "vitest";
import { asignarZonas, ordenarTabla, type FilaTabla } from "./tabla";

const fila = (id: string, nombre: string, pg: number, pp: number, extra: Partial<FilaTabla> = {}): FilaTabla => ({
  usuario_id: id,
  nombre,
  carnet: id,
  pj: pg + pp,
  pg,
  pp,
  pts: pg,
  pg_desempate: 0,
  dif_sets: 0,
  ...extra,
});

describe("ordenarTabla", () => {
  it("ordena por puntos descendente", () => {
    const r = ordenarTabla([fila("a", "Ana", 1, 2), fila("b", "Bruno", 3, 0), fila("c", "Carla", 2, 1)]);
    expect(r.map((f) => f.usuario_id)).toEqual(["b", "c", "a"]);
  });

  it("el desempate jugado va antes que el enfrentamiento directo", () => {
    const r = ordenarTabla(
      [fila("a", "Ana", 2, 1), fila("b", "Bruno", 2, 1, { pg_desempate: 1 })],
      [{ jugador_a: "a", jugador_b: "b", ganador: "a" }],
    );
    expect(r[0].usuario_id).toBe("b");
  });

  it("usa enfrentamiento directo solo cuando empatan exactamente dos", () => {
    const dos = ordenarTabla(
      [fila("a", "Ana", 2, 1), fila("b", "Bruno", 2, 1)],
      [{ jugador_a: "a", jugador_b: "b", ganador: "b" }],
    );
    expect(dos[0].usuario_id).toBe("b");

    const tres = ordenarTabla(
      [fila("a", "Ana", 2, 1), fila("b", "Bruno", 2, 1), fila("c", "Carla", 2, 1)],
      [{ jugador_a: "a", jugador_b: "b", ganador: "b" }],
    );
    // Con tres empatados cae al nombre
    expect(tres.map((f) => f.nombre)).toEqual(["Ana", "Bruno", "Carla"]);
  });
});

describe("asignarZonas", () => {
  const seis = ["a", "b", "c", "d", "e", "f"].map((id, i) => fila(id, id, 5 - i, i));

  const cinco = ["a", "b", "c", "d", "e"].map((id, i) => fila(id, id, 4 - i, i));
  const club = { divisiones: 3, n_premiados: 2, n_ascienden: 2, n_descienden: 2 };

  it("Primera: premian a los 2 primeros y bajan los 2 últimos", () => {
    const z = asignarZonas(cinco, { ...club, nivel: 1 });
    expect(z.map((f) => f.zona)).toEqual(["premio", "premio", null, "descenso", "descenso"]);
    expect(z[3].posicion).toBe(4);
  });

  it("Segunda: suben los 2 primeros y bajan los 2 últimos", () => {
    const z = asignarZonas(cinco, { ...club, nivel: 2 });
    expect(z.map((f) => f.zona)).toEqual(["ascenso", "ascenso", null, "descenso", "descenso"]);
  });

  it("Tercera: suben los 2 primeros y nadie baja", () => {
    const z = asignarZonas(cinco, { ...club, nivel: 3 });
    expect(z.map((f) => f.zona)).toEqual(["ascenso", "ascenso", null, null, null]);
  });

  it("con dos divisiones, la de abajo no baja y la de arriba no sube", () => {
    const arriba = asignarZonas(seis, { nivel: 1, divisiones: 2, n_premiados: 3, n_ascienden: 3, n_descienden: 3 });
    expect(arriba.map((f) => f.zona)).toEqual(["premio", "premio", "premio", "descenso", "descenso", "descenso"]);
    const abajo = asignarZonas(seis, { nivel: 2, divisiones: 2, n_premiados: 3, n_ascienden: 3, n_descienden: 3 });
    expect(abajo.map((f) => f.zona)).toEqual(["ascenso", "ascenso", "ascenso", null, null, null]);
  });
});

describe("diferencia de sets", () => {
  it("ordena por diferencia de sets cuando el directo no decide", () => {
    // Tres empatados en puntos: el enfrentamiento directo no aplica (solo
    // decide entre dos), así que manda la diferencia de sets y no el nombre.
    const r = ordenarTabla([
      fila("a", "Ana", 1, 1, { dif_sets: 0 }),
      fila("b", "Bruno", 1, 1, { dif_sets: 3 }),
      fila("c", "Carla", 1, 1, { dif_sets: -3 }),
    ]);
    expect(r.map((f) => f.usuario_id)).toEqual(["b", "a", "c"]);
  });

  it("el enfrentamiento directo pesa más que la diferencia de sets", () => {
    const r = ordenarTabla(
      [fila("a", "Ana", 1, 1, { dif_sets: 5 }), fila("b", "Bruno", 1, 1, { dif_sets: -5 })],
      [{ jugador_a: "a", jugador_b: "b", ganador: "b" }],
    );
    expect(r.map((f) => f.usuario_id)).toEqual(["b", "a"]);
  });
});
