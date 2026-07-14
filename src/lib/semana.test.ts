import { describe, it, expect } from "vitest";
import { semanaDe, tareasDelDia, poolSinPlan } from "./semana";
import type { Card } from "./types";

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
// miércoles 4 de marzo de 2020 (12:00 local)
const MIE = new Date(2020, 2, 4, 12).getTime();

describe("semanaDe", () => {
  it("devuelve Lun-Sáb de la semana en curso y marca hoy", () => {
    const s = semanaDe(MIE);
    expect(s).toHaveLength(6);
    expect(s[0].date).toBe("2020-03-02"); // lunes
    expect(s[5].date).toBe("2020-03-07"); // sábado
    expect(s.find((d) => d.esHoy)!.date).toBe("2020-03-04");
  });
  it("un domingo pertenece a la semana que termina", () => {
    const DOM = new Date(2020, 2, 8, 12).getTime();
    expect(semanaDe(DOM)[0].date).toBe("2020-03-02");
  });
});

describe("tareasDelDia / poolSinPlan", () => {
  const cards = [
    mkCard({ id: "a", due_date: "2020-03-04" }),
    mkCard({ id: "b", due_date: "2020-03-04", status: "term" }),          // cerrada: no
    mkCard({ id: "c", due_date: "2020-03-04", owner: "u2" }),             // otro dueño: no
    mkCard({ id: "d", due_date: null }),                                   // pool
    mkCard({ id: "e", due_date: "2020-02-20" }),                           // vencida vieja: pool
    mkCard({ id: "f", due_date: "2020-03-06" }),                           // viernes
    mkCard({ id: "g", due_date: null, card_type: "operativa" }),           // operativa: no
  ];
  it("filtra por día, dueño, abiertas y no operativas", () => {
    expect(tareasDelDia(cards, "u1", "2020-03-04").map((c) => c.id)).toEqual(["a"]);
  });
  it("pool: sin fecha o vencidas antes del lunes", () => {
    expect(poolSinPlan(cards, "u1", "2020-03-02").map((c) => c.id)).toEqual(["d", "e"]);
  });
});
