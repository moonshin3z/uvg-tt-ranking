import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claveNombre, leerCalendario, leerDivision, reconocer, revisarCalendario, type Inscrito } from "./calendario";

// La hoja «Calendario ajustado 35» del club tal como se copia de Excel: con el
// título, el encabezado y el resumen de carga semanal de abajo.
const HOJA = readFileSync(join(__dirname, "calendario-del-club.fixture.tsv"), "utf8");

// Los inscritos como quedan en la app con la lista de integrantes. El
// calendario del club trae «Joseph B.» (en la lista es «Joshep») y «Diego Q.»,
// que no está en el ranking: su lugar en Tercera es de wellington G.
const nombres: [string, Inscrito["division"]][] = [
  ["Cristian M.", "primera"],
  ["Giancarlo R.", "primera"],
  ["Ivan R.", "primera"],
  ["Marvin F.", "primera"],
  ["Arturo S.", "primera"],
  ["Palma R.", "segunda"],
  ["Marcelo D.", "segunda"],
  ["Ian Q.", "segunda"],
  ["Jose J.", "segunda"],
  ["Andres M.", "segunda"],
  ["Joshep", "tercera"],
  ["wellington G", "tercera"],
  ["Alfred A.", "tercera"],
  ["Christofer A.", "tercera"],
  ["Jhonatan m.", "tercera"],
  ["Mirna", "tercera"],
];
const INSCRITOS: Inscrito[] = nombres.map(([nombre, division], i) => ({ id: `u${i}`, nombre, division }));
const idDe = (nombre: string) => INSCRITOS.find((j) => j.nombre === nombre)!.id;

describe("leerDivision", () => {
  it("entiende cómo la escribe el club y cómo la escribe la app", () => {
    expect(leerDivision("Division 1")).toBe("primera");
    expect(leerDivision("División 3")).toBe("tercera");
    expect(leerDivision("Segunda")).toBe("segunda");
    expect(leerDivision("Partidos")).toBeNull();
  });
});

describe("leerCalendario", () => {
  it("lee los 35 partidos de la hoja del club e ignora todo lo demás", () => {
    const filas = leerCalendario(HOJA);
    expect(filas).toHaveLength(35);
    expect(filas[0]).toMatchObject({ semana: 1, division: "primera", a: "Giancarlo R.", b: "Arturo S." });
    expect(filas.at(-1)).toMatchObject({ semana: 8, division: "tercera", a: "Christofer A.", b: "Jhonatan m." });
  });

  it("acepta una fila escrita a mano con espacios", () => {
    expect(leerCalendario("2 Division 3 Mirna vs Diego Q.")[0]).toMatchObject({
      semana: 2,
      division: "tercera",
      a: "Mirna",
      b: "Diego Q.",
    });
  });

  it("si la semana solo está en la primera fila del bloque, la arrastra", () => {
    const filas = leerCalendario("1\tDivision 1\tAna vs Bruno\n\tDivision 1\tCarla vs Diego");
    expect(filas.map((f) => f.semana)).toEqual([1, 1]);
  });
});

describe("reconocer", () => {
  it("reconoce a todos: iguales, parecidos y uno por descarte", () => {
    const r = reconocer(leerCalendario(HOJA), INSCRITOS);
    const de = (texto: string) => r.find((n) => n.texto === texto)!;
    expect(r).toHaveLength(16);
    expect(de("Cristian M.")).toMatchObject({ id: idDe("Cristian M."), como: "igual" });
    // Una letra cambiada de lugar en un nombre largo: es la misma persona.
    expect(de("Joseph B.")).toMatchObject({ id: idDe("Joshep"), como: "parecido" });
    // Diego no está; el único inscrito de Tercera sin nombre en la hoja es wellington.
    expect(de("Diego Q.")).toMatchObject({ id: idDe("wellington G"), como: "descarte" });
  });

  it("«Diego Q.» se parece a «Diego Quan» por las iniciales", () => {
    const conDiego = INSCRITOS.map((j) => (j.nombre === "wellington G" ? { ...j, nombre: "Diego Quan" } : j));
    const r = reconocer(leerCalendario(HOJA), conDiego);
    expect(r.find((n) => n.texto === "Diego Q.")).toMatchObject({ como: "parecido" });
  });

  it("sin descarte posible, pide que el coordinador elija", () => {
    const conOtro = [...INSCRITOS, { id: "u99", nombre: "Pedro X.", division: "tercera" as const }];
    const r = reconocer(leerCalendario(HOJA), conOtro);
    expect(r.find((n) => n.texto === "Diego Q.")).toMatchObject({ id: null, como: "ninguno" });

    const elegido = reconocer(leerCalendario(HOJA), conOtro, {
      [claveNombre("Diego Q.", "tercera")]: idDe("wellington G"),
    });
    expect(elegido.find((n) => n.texto === "Diego Q.")?.id).toBe(idDe("wellington G"));
  });

  it("un nombre corto mal escrito no se adivina", () => {
    const r = reconocer(leerCalendario("1\tDivision 2\tJuan vs Ian Q."), INSCRITOS);
    expect(r.find((n) => n.texto === "Juan")?.como).not.toBe("parecido");
  });

  it("solo busca en la división de la fila", () => {
    const r = reconocer(leerCalendario("1\tDivision 2\tCristian M. vs Palma R."), INSCRITOS);
    expect(r.find((n) => n.texto === "Cristian M.")?.id).toBeNull();
  });
});

describe("revisarCalendario", () => {
  it("la hoja del club queda lista para guardar: 35 partidos en 8 semanas", () => {
    const r = revisarCalendario(HOJA, INSCRITOS);
    expect(r.problemas).toEqual([]);
    expect(r.partidos).toHaveLength(35);
    expect(r.semanas).toBe(8);
    expect(r.partidos[0]).toEqual({ jugador_a: idDe("Giancarlo R."), jugador_b: idDe("Arturo S."), semana: 1 });
  });

  it("dice a quién no reconoció", () => {
    const r = revisarCalendario("1\tDivision 1\tCristian M. vs Nadie Conocido", INSCRITOS);
    expect(r.problemas.join(" ")).toMatch(/«Nadie Conocido»/);
    expect(r.partidos).toHaveLength(0);
  });

  it("no deja que dos nombres de la hoja sean la misma persona", () => {
    const r = revisarCalendario("1\tDivision 1\tCristian M. vs Ivan R.", INSCRITOS, {
      [claveNombre("Ivan R.", "primera")]: idDe("Cristian M."),
    });
    expect(r.problemas.join(" ")).toMatch(/misma persona/);
  });
});
