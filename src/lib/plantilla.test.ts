import { describe, it, expect } from "vitest";
import { validarPlantilla, dueDateDe, faltantesDePlantilla, filasParaInsertar, type TemplateItem } from "./plantilla";
import type { Card } from "./types";

const item = (p: Partial<TemplateItem>): TemplateItem =>
  ({ title: "IVA", owner: "u1", due_day: 18, effort: 3, priority: "alta", ...p });

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}

describe("validarPlantilla", () => {
  it("rechaza vacía, sin título, sin owner, día inválido", () => {
    expect(validarPlantilla([])).toContain("vacía");
    expect(validarPlantilla([item({ title: " " })])).toContain("sin título");
    expect(validarPlantilla([item({ owner: "" })])).toContain("responsable");
    expect(validarPlantilla([item({ due_day: 40 })])).toContain("inválido");
    expect(validarPlantilla([item({})])).toBeNull();
  });
});

describe("dueDateDe", () => {
  it("arma la fecha del mes pedido con padding", () => {
    expect(dueDateDe(item({ due_day: 5 }), 2020, 3)).toBe("2020-03-05");
  });
  it("clampa el día 31 a febrero", () => {
    expect(dueDateDe(item({ due_day: 31 }), 2020, 2)).toBe("2020-02-29"); // bisiesto
    expect(dueDateDe(item({ due_day: 31 }), 2021, 2)).toBe("2021-02-28");
  });
  it("null si el ítem no tiene vencimiento", () => {
    expect(dueDateDe(item({ due_day: null }), 2020, 3)).toBeNull();
  });
});

describe("faltantesDePlantilla", () => {
  const items = [item({ title: "IVA" }), item({ title: "Sueldos", due_day: 4 })];
  it("excluye las que ya existen ese mes (por due_date o created_at), case-insensitive", () => {
    const cards = [
      mkCard({ owner: "u1", title: "iva", due_date: "2020-03-18" }),
      mkCard({ id: "c2", owner: "u1", title: "Sueldos", due_date: "2020-02-04" }), // otro mes: no cuenta
    ];
    expect(faltantesDePlantilla(items, cards, 2020, 3).map((i) => i.title)).toEqual(["Sueldos"]);
  });
  it("no descarta por coincidencia de otra persona", () => {
    const cards = [mkCard({ owner: "u2", title: "IVA", due_date: "2020-03-18" })];
    expect(faltantesDePlantilla(items, cards, 2020, 3)).toHaveLength(2);
  });
  it("idempotencia: un ítem SIN vencimiento generado por la plantilla no se regenera (marca de historial)", () => {
    const undated = [item({ title: "Backup mensual", due_day: null })];
    const generada = filasParaInsertar(undated, 2020, 8, "Ana"); // due_date null + marca de agosto
    const yaGenerada = mkCard({ owner: "u1", title: "Backup mensual", due_date: null, history: generada[0].history });
    expect(faltantesDePlantilla(undated, [], 2020, 8)).toHaveLength(1);        // sin la card: falta
    expect(faltantesDePlantilla(undated, [yaGenerada], 2020, 8)).toHaveLength(0); // ya generada ese mes: NO se duplica
    expect(faltantesDePlantilla(undated, [yaGenerada], 2020, 9)).toHaveLength(1); // otro mes: sí falta
  });
});
