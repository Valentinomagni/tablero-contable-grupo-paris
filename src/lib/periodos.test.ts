import { describe, it, expect } from "vitest";
import { mesCerradoPor, mesesAbiertos, resumenEquipo, mesesConTrabajoDe, mesLegible } from "./periodos";
import type { CierrePeriodo, Profile, Card } from "./types";

const per = (owner: string, mes: string, cerrado_at = "2026-07-05T10:00:00Z"): CierrePeriodo =>
  ({ id: `${owner}-${mes}`, owner, mes, cerrado_at, nota: null });

const persona = (id: string, name: string): Profile =>
  ({ id, name, role: "empleado", email: `${id}@x.com`, username: null, puesto: "", ficha: "", manager_id: null, marca: null });

const card = (owner: string, marcaMes: string): Card => ({
  id: `c-${owner}-${marcaMes}-${Math.random()}`, owner, title: "IVA", status: "pend",
  description: "", checklist: [], comments: [],
  history: [{ who: "x", at: "2026-06-01T00:00:00Z", txt: `Generada desde la plantilla de cierre mensual · ${marcaMes}` }],
  done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
  card_type: "normal", deps: [], created_at: "2026-06-01T00:00:00Z",
} as unknown as Card);

describe("mesCerradoPor", () => {
  it("devuelve la fila cuando esa persona cerró ese mes", () => {
    const p = mesCerradoPor([per("ana", "2026-06"), per("beto", "2026-07")], "ana", "2026-06");
    expect(p?.mes).toBe("2026-06");
    expect(p?.owner).toBe("ana");
  });
  it("devuelve null si no hay fila (o la fila es de otra persona / otro mes)", () => {
    const filas = [per("ana", "2026-06")];
    expect(mesCerradoPor(filas, "ana", "2026-07")).toBeNull();
    expect(mesCerradoPor(filas, "beto", "2026-06")).toBeNull();
    expect(mesCerradoPor([], "ana", "2026-06")).toBeNull();
  });
  it("es defensiva ante entradas nulas (sin migración 29)", () => {
    expect(mesCerradoPor(undefined as unknown as CierrePeriodo[], "ana", "2026-06")).toBeNull();
  });
});

describe("mesesAbiertos", () => {
  it("persona sin filas de cierre → todos los meses con trabajo quedan abiertos", () => {
    expect(mesesAbiertos([], "ana", ["2026-06", "2026-07"])).toEqual(["2026-06", "2026-07"]);
  });
  it("cerró junio pero no julio → solo julio abierto", () => {
    expect(mesesAbiertos([per("ana", "2026-06")], "ana", ["2026-06", "2026-07"])).toEqual(["2026-07"]);
  });
  it("un mes sin trabajo no cuenta como abierto", () => {
    expect(mesesAbiertos([], "ana", ["2026-07"])).toEqual(["2026-07"]);
    expect(mesesAbiertos([], "ana", [])).toEqual([]);
  });
  it("el cierre de otra persona no cierra el mes propio", () => {
    expect(mesesAbiertos([per("beto", "2026-06")], "ana", ["2026-06"])).toEqual(["2026-06"]);
  });
  it("ordena y deduplica los meses", () => {
    expect(mesesAbiertos([], "ana", ["2026-07", "2026-06", "2026-07"])).toEqual(["2026-06", "2026-07"]);
  });
  it("es defensiva ante entradas nulas", () => {
    expect(mesesAbiertos(undefined as unknown as CierrePeriodo[], "ana", undefined as unknown as string[])).toEqual([]);
  });
});

describe("resumenEquipo", () => {
  it("3 personas con 1 cerrada → pct 33 y listas correctas", () => {
    const personas = [persona("ana", "Ana"), persona("beto", "Beto"), persona("caro", "Caro")];
    const r = resumenEquipo([per("beto", "2026-06")], personas, "2026-06");
    expect(r.pct).toBe(33);
    expect(r.cerraron.map((p) => p.id)).toEqual(["beto"]);
    expect(r.pendientes.map((p) => p.id)).toEqual(["ana", "caro"]);
  });
  it("equipo vacío → pct 0 sin dividir por cero", () => {
    const r = resumenEquipo([], [], "2026-06");
    expect(r.pct).toBe(0);
    expect(r.cerraron).toEqual([]);
    expect(r.pendientes).toEqual([]);
  });
  it("solo cuenta el mes pedido", () => {
    const personas = [persona("ana", "Ana"), persona("beto", "Beto")];
    const r = resumenEquipo([per("ana", "2026-05")], personas, "2026-06");
    expect(r.pct).toBe(0);
    expect(r.pendientes.map((p) => p.id)).toEqual(["ana", "beto"]);
  });
  it("todos cerraron → pct 100", () => {
    const personas = [persona("ana", "Ana"), persona("beto", "Beto")];
    const r = resumenEquipo([per("ana", "2026-06"), per("beto", "2026-06")], personas, "2026-06");
    expect(r.pct).toBe(100);
    expect(r.pendientes).toEqual([]);
  });
  it("es defensiva ante entradas nulas", () => {
    const r = resumenEquipo(undefined as unknown as CierrePeriodo[], undefined as unknown as Profile[], "2026-06");
    expect(r).toEqual({ cerraron: [], pendientes: [], pct: 0 });
  });
});

describe("mesesConTrabajoDe", () => {
  it("saca los meses de las cards de cierre de esa persona", () => {
    const cards = [card("ana", "2026-06"), card("ana", "2026-07"), card("beto", "2026-05")];
    expect(mesesConTrabajoDe(cards, "ana")).toEqual(["2026-06", "2026-07"]);
  });
  it("sin cards → sin meses (y no crashea con history nulo)", () => {
    expect(mesesConTrabajoDe([], "ana")).toEqual([]);
    expect(mesesConTrabajoDe([{ owner: "ana" } as Card], "ana")).toEqual([]);
    expect(mesesConTrabajoDe(undefined as unknown as Card[], "ana")).toEqual([]);
  });
});

describe("mesLegible", () => {
  it("convierte YYYY-MM a nombre de mes", () => {
    expect(mesLegible("2026-06")).toBe("junio");
    expect(mesLegible("2026-07")).toBe("julio");
  });
  it("no crashea con basura", () => {
    expect(mesLegible("")).toBe("");
    expect(mesLegible("2026-99")).toBe("2026-99");
  });
});
