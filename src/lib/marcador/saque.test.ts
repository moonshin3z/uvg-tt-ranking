import { describe, expect, it } from "vitest";
import { turnoDeSaque } from "./saque";

describe("turno de saque", () => {
  it("respeta al elegido y alterna cada dos puntos sin importar quién los ganó", () => {
    expect(turnoDeSaque("b", 0, 0, 0, 11)).toBe("b");
    expect(turnoDeSaque("b", 1, 0, 0, 11)).toBe("b");
    expect(turnoDeSaque("b", 1, 1, 0, 11)).toBe("a");
    expect(turnoDeSaque("b", 0, 3, 0, 11)).toBe("a");
    expect(turnoDeSaque("b", 4, 0, 0, 11)).toBe("b");
  });

  it("cambia quién empieza en cada set", () => {
    expect(turnoDeSaque("a", 0, 0, 1, 11)).toBe("b");
    expect(turnoDeSaque("a", 0, 0, 2, 11)).toBe("a");
    expect(turnoDeSaque("b", 2, 0, 1, 11)).toBe("b");
  });

  it("desde 10-10 alterna cada punto, incluso después de varios empates", () => {
    expect(turnoDeSaque("a", 10, 10, 0, 11)).toBe("a");
    expect(turnoDeSaque("a", 11, 10, 0, 11)).toBe("b");
    expect(turnoDeSaque("a", 11, 11, 0, 11)).toBe("a");
    expect(turnoDeSaque("a", 15, 16, 0, 11)).toBe("b");
    expect(turnoDeSaque("a", 10, 11, 1, 11)).toBe("a");
  });

  it("deshacer recupera el saque previo al punto o al cierre de un set", () => {
    expect(turnoDeSaque("b", 0, 0, 1, 11)).toBe("a");
    expect(turnoDeSaque("b", 10, 7, 0, 11)).toBe("b");
    expect(turnoDeSaque("b", 11, 10, 0, 11)).toBe("a");
    expect(turnoDeSaque("b", 10, 10, 0, 11)).toBe("b");
  });

  it("mantiene la secuencia al llegar al empate de los formatos configurables", () => {
    expect(turnoDeSaque("a", 4, 4, 0, 5)).toBe("a");
    expect(turnoDeSaque("a", 5, 4, 0, 5)).toBe("b");
    expect(turnoDeSaque("a", 5, 5, 0, 6)).toBe("b");
    expect(turnoDeSaque("a", 6, 5, 0, 6)).toBe("a");
    expect(turnoDeSaque("b", 20, 21, 0, 21)).toBe("a");
  });
});
