import { describe, it, expect } from "vitest";
import { flujoMensual, perfilDe, nivelCarga, TEXTO_PERFIL } from "./flujo-mensual";
import type { Snapshot } from "./types";

function snap(day: string, owner: string, done_count: number): Snapshot {
  return { day, owner, open_count: 0, open_effort: 0, done_count, done_effort: 0, activity_qty: 0 };
}

describe("perfilDe", () => {
  it("carga concentrada en la primera mitad → temprano", () => {
    const dias = Array(31).fill(0); dias[2] = 5; dias[6] = 8; dias[10] = 4;
    expect(perfilDe(dias)).toBe("temprano");
  });
  it("carga concentrada al cierre → tardio", () => {
    const dias = Array(31).fill(0); dias[24] = 9; dias[27] = 7; dias[29] = 6;
    expect(perfilDe(dias)).toBe("tardio");
  });
  it("carga repartida → uniforme", () => {
    const dias = Array(31).fill(2);
    expect(perfilDe(dias)).toBe("uniforme");
  });
  it("sin carga → sin-datos (no inventa un perfil)", () => {
    expect(perfilDe(Array(31).fill(0))).toBe("sin-datos");
  });
});

describe("flujoMensual", () => {
  const SNAPS = [
    snap("2026-07-03", "u1", 4), snap("2026-07-05", "u1", 6),
    snap("2026-07-28", "u2", 9),
    snap("2026-06-10", "u1", 99),   // otro mes: no debe contar
  ];

  it("agrupa por persona y sólo toma el mes pedido", () => {
    const r = flujoMensual(SNAPS, "2026-07");
    expect(r.map((f) => f.owner).sort()).toEqual(["u1", "u2"]);
    expect(r.find((f) => f.owner === "u1")!.total).toBe(10);
  });
  it("ubica cada día en su posición (1 = índice 0)", () => {
    const u1 = flujoMensual(SNAPS, "2026-07").find((f) => f.owner === "u1")!;
    expect(u1.dias[2]).toBe(4);   // día 3
    expect(u1.dias[4]).toBe(6);   // día 5
    expect(u1.dias[0]).toBe(0);
  });
  it("marca el día de mayor carga", () => {
    const u1 = flujoMensual(SNAPS, "2026-07").find((f) => f.owner === "u1")!;
    expect(u1.picoDia).toBe(5);
  });
  it("clasifica el perfil de cada persona", () => {
    const r = flujoMensual(SNAPS, "2026-07");
    expect(r.find((f) => f.owner === "u1")!.perfil).toBe("temprano");
    expect(r.find((f) => f.owner === "u2")!.perfil).toBe("tardio");
  });
  it("ordena de mayor a menor carga total", () => {
    const r = flujoMensual([snap("2026-07-02","a",1), snap("2026-07-02","b",50)], "2026-07");
    expect(r[0].owner).toBe("b");
  });
  it("sin snapshots devuelve lista vacía, no explota", () => {
    expect(flujoMensual([], "2026-07")).toEqual([]);
    expect(flujoMensual(null as unknown as Snapshot[], "2026-07")).toEqual([]);
  });
  it("ignora filas con fecha inválida", () => {
    expect(flujoMensual([snap("basura", "u1", 5)], "2026-07")).toEqual([]);
  });
});

describe("nivelCarga", () => {
  it("0 cuando no hubo nada", () => {
    expect(nivelCarga(0, 10)).toBe(0);
  });
  it("escala en 4 niveles hasta el máximo", () => {
    expect(nivelCarga(10, 10)).toBe(4);
    expect(nivelCarga(1, 10)).toBe(1);
  });
  it("máximo 0 no divide por cero", () => {
    expect(nivelCarga(0, 0)).toBe(0);
  });
});

describe("TEXTO_PERFIL", () => {
  it("describe la situación, sin calificar a la persona", () => {
    expect(TEXTO_PERFIL.temprano).toBe("Mayor carga al principio del mes");
    expect(TEXTO_PERFIL.tardio).toBe("Mayor carga hacia el cierre");
    expect(TEXTO_PERFIL.uniforme).toBe("Carga repartida en el mes");
    expect(TEXTO_PERFIL["sin-datos"]).toBe("Sin actividad registrada");
  });
});
