import { describe, expect, it } from "vitest";
import {
  armarSemana,
  lunesDe,
  lunesSugerido,
  semanaActual,
  semanaDe,
  semanaPorDefecto,
  semanaTerminada,
  textoSemana,
  type PartidoSemanal,
} from "./semanas";

// Mediodía en Guatemala (UTC-6) de cada día, para no depender de la hora.
const dia = (fecha: string) => new Date(`${fecha}T18:00:00Z`);
const INICIO = "2026-10-05"; // lunes

describe("semanaDe", () => {
  it("cuenta desde el lunes de inicio", () => {
    expect(semanaDe(INICIO, "2026-10-05")).toBe(1);
    expect(semanaDe(INICIO, "2026-10-11")).toBe(1);
    expect(semanaDe(INICIO, "2026-10-12")).toBe(2);
    expect(semanaDe(INICIO, "2026-10-04")).toBe(0);
  });

  it("usa el día de Guatemala, no el de UTC", () => {
    // Domingo 11 a las 9 p.m. en Guatemala ya es lunes 12 en UTC.
    expect(semanaActual(INICIO, new Date("2026-10-12T03:00:00Z"))).toBe(1);
  });
});

describe("lunesSugerido", () => {
  it("lunes o martes: esta semana", () => {
    expect(lunesSugerido(dia("2026-10-05"))).toBe("2026-10-05");
    expect(lunesSugerido(dia("2026-10-06"))).toBe("2026-10-05");
  });
  it("de miércoles en adelante: la que viene", () => {
    expect(lunesSugerido(dia("2026-10-07"))).toBe("2026-10-12");
    expect(lunesSugerido(dia("2026-10-11"))).toBe("2026-10-12");
  });
  it("lunesDe lleva cualquier día a su lunes", () => {
    expect(lunesDe("2026-10-08")).toBe("2026-10-05");
    expect(lunesDe("2026-10-05")).toBe("2026-10-05");
  });
});

describe("textoSemana", () => {
  it("de martes a jueves", () => {
    expect(textoSemana(INICIO, 1)).toBe("6 al 8 de octubre");
  });
  it("cuando cambia el mes lo dice en los dos", () => {
    expect(textoSemana("2026-09-28", 1)).toBe("29 de septiembre al 1 de octubre");
  });
});

describe("semanaTerminada", () => {
  it("termina después del jueves", () => {
    expect(semanaTerminada(INICIO, 1, dia("2026-10-08"))).toBe(false);
    expect(semanaTerminada(INICIO, 1, dia("2026-10-09"))).toBe(true);
  });
});

const jugador = (id: string) => ({ id, nombre: id.toUpperCase(), carnet: id });
const partido = (id: string, semana: number | null, extra: Partial<PartidoSemanal> = {}): PartidoSemanal => ({
  id,
  semana,
  estado: "pendiente",
  division: "primera",
  a: jugador(`${id}a`),
  b: jugador(`${id}b`),
  ganador: null,
  sets_a: null,
  sets_b: null,
  registrado_en: null,
  ...extra,
});

describe("armarSemana", () => {
  const partidos: PartidoSemanal[] = [
    partido("p1", 1, {
      estado: "confirmado",
      ganador: "p1a",
      sets_a: 2,
      sets_b: 0,
      registrado_en: "2026-10-06T20:00:00Z",
    }),
    partido("p2", 1),
    partido("p3", 2, { division: "segunda" }),
    // De la semana 1, se jugó en la semana 2: atrasado.
    partido("p4", 1, {
      estado: "jugado",
      ganador: "p4b",
      sets_a: 1,
      sets_b: 2,
      registrado_en: "2026-10-13T20:00:00Z",
    }),
    partido("p5", 3, { estado: "anulado" }),
  ];

  it("la semana 1 terminada: lo que no se jugó dice que no se jugó", () => {
    const s = armarSemana(partidos, INICIO, 1, dia("2026-10-10"));
    const situaciones = Object.fromEntries(s.porDivision.flatMap((d) => d.partidos).map((p) => [p.id, p.situacion]));
    expect(situaciones).toEqual({ p1: "jugado", p2: "no_se_jugo", p4: "sin_confirmar" });
    expect(s.total).toBe(2);
  });

  it("la semana en curso trae el atrasado jugado y los pendientes de antes", () => {
    const s = armarSemana(partidos, INICIO, 2, dia("2026-10-13"));
    const ids = s.porDivision.flatMap((d) => d.partidos.map((p) => p.id));
    expect(ids).toEqual(["p4", "p3"]);
    expect(s.porDivision.map((d) => d.division)).toEqual(["primera", "segunda"]);
    expect(s.porDivision[0].partidos[0].deLaSemana).toBe(1);
    expect(s.pendientesAnteriores.map((p) => p.id)).toEqual(["p2"]);
    expect(s.porJugar).toBe(1);
    expect(s.jugados).toBe(1);
  });

  it("los anulados no cuentan", () => {
    expect(armarSemana(partidos, INICIO, 3, dia("2026-10-13")).porDivision).toEqual([]);
  });

  it("por defecto, la semana en curso sin pasarse de las que hay", () => {
    expect(semanaPorDefecto(INICIO, 6, dia("2026-10-01"))).toBe(1);
    expect(semanaPorDefecto(INICIO, 6, dia("2026-10-14"))).toBe(2);
    expect(semanaPorDefecto(INICIO, 6, dia("2026-12-01"))).toBe(6);
  });
});
