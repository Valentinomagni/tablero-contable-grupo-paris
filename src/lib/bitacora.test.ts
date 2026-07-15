import { describe, it, expect } from "vitest";
import { construirBitacora, agruparPorDia } from "./bitacora";
import type { ActivityLog, Card } from "./types";

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
const nombreDe = (id: string) => ({ u1: "Ana", u2: "Beto" }[id] ?? "?");

describe("construirBitacora", () => {
  const cards = [
    mkCard({ id: "a", owner: "u1", title: "IVA", history: [
      { who: "Ana", at: "2020-03-02T09:00:00Z", txt: "Creó la tarea" },
      { who: "—", at: "2020-03-02T15:00:00Z", txt: "Marcó terminada" }, // who "—" → cae al dueño
    ] }),
    mkCard({ id: "b", owner: "u2", title: "Sueldos", history: [
      { who: "Beto", at: "2020-03-01T10:00:00Z", txt: "Creó la tarea" },
    ] }),
  ];
  const activity: ActivityLog[] = [
    { id: "1", card_id: "a", owner: "u1", who_name: "Ana", qty: 3, note: "lote 1", at: "2020-03-03T11:00:00Z" },
  ];

  it("mezcla history + activity y ordena por fecha descendente", () => {
    const ev = construirBitacora(cards, activity, null, nombreDe);
    expect(ev.map((e) => e.at)).toEqual([
      "2020-03-03T11:00:00Z", "2020-03-02T15:00:00Z", "2020-03-02T09:00:00Z", "2020-03-01T10:00:00Z",
    ]);
  });
  it("resuelve el 'quien' vacío o '—' al nombre del dueño", () => {
    const ev = construirBitacora(cards, [], null, nombreDe);
    const term = ev.find((e) => e.texto === "Marcó terminada")!;
    expect(term.quien).toBe("Ana");
  });
  it("el registro operativo describe cantidad y nota, con título de la card", () => {
    const ev = construirBitacora(cards, activity, null, nombreDe);
    const reg = ev.find((e) => e.tipo === "operativa")!;
    expect(reg.texto).toBe("Registró 3 u. · lote 1");
    expect(reg.cardTitulo).toBe("IVA");
  });
  it("filtra por persona (autocontrol): solo eventos de esa dueña", () => {
    const ev = construirBitacora(cards, activity, "u1", nombreDe);
    expect(ev.every((e) => e.ownerId === "u1")).toBe(true);
    expect(ev).toHaveLength(3); // 2 history de IVA + 1 operativa
  });
});

describe("agruparPorDia", () => {
  it("agrupa por día calendario preservando el orden", () => {
    const ev = construirBitacora(
      [mkCard({ id: "a", owner: "u1", title: "X", history: [
        { who: "Ana", at: "2020-03-03T11:00:00Z", txt: "b" },
        { who: "Ana", at: "2020-03-03T09:00:00Z", txt: "a" },
        { who: "Ana", at: "2020-03-01T10:00:00Z", txt: "c" },
      ] })], [], null, nombreDe);
    const g = agruparPorDia(ev);
    expect(g.map((x) => x.dia)).toEqual(["2020-03-03", "2020-03-01"]);
    expect(g[0].eventos).toHaveLength(2);
    expect(g[1].eventos).toHaveLength(1);
  });
});
