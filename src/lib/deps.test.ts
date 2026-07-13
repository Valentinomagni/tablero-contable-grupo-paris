import { describe, it, expect } from "vitest";
import { missingDepIds, depInfoOf, isBlocked, dependentsOf, depGraphLayout, type DepMap, type RevDep } from "./deps";
import type { Card } from "./types";

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
const nameOf = (id: string) => ({ u1: "Ana", u2: "Beto" }[id] ?? "");

describe("missingDepIds", () => {
  it("devuelve solo ids de deps que no están en cards, sin duplicados", () => {
    const cards = [
      mkCard({ id: "a", deps: ["b", "x"] }),
      mkCard({ id: "b", deps: ["x", "y"] }),
    ];
    expect(missingDepIds(cards).sort()).toEqual(["x", "y"]);
  });
});

describe("depInfoOf", () => {
  const cards = [mkCard({ id: "a", title: "Local", status: "term", owner: "u2" })];
  const depMap: DepMap = { z: { id: "z", title: "Ajena", status: "pend", owner_name: "Otro" } };
  it("resuelve local con nombre del owner", () => {
    expect(depInfoOf("a", cards, nameOf, depMap)).toEqual({ id: "a", title: "Local", status: "term", owner_name: "Beto" });
  });
  it("cae al depMap para ids ajenos", () => {
    expect(depInfoOf("z", cards, nameOf, depMap)?.title).toBe("Ajena");
  });
  it("undefined si no existe en ningún lado", () => {
    expect(depInfoOf("nope", cards, nameOf, depMap)).toBeUndefined();
  });
});

describe("isBlocked", () => {
  const dep = mkCard({ id: "d", status: "proc" });
  it("bloqueada si una dep no está terminada", () => {
    expect(isBlocked(mkCard({ id: "a", deps: ["d"] }), [dep], {})).toBe(true);
  });
  it("no bloqueada si la dep está term o es desconocida", () => {
    expect(isBlocked(mkCard({ id: "a", deps: ["d"] }), [mkCard({ id: "d", status: "term" })], {})).toBe(false);
    expect(isBlocked(mkCard({ id: "a", deps: ["ghost"] }), [], {})).toBe(false);
  });
  it("una card terminada nunca está bloqueada", () => {
    expect(isBlocked(mkCard({ id: "a", status: "term", deps: ["d"] }), [dep], {})).toBe(false);
  });
});

describe("dependentsOf", () => {
  const cards = [mkCard({ id: "a", title: "Dependiente", owner: "u2", deps: ["x"] })];
  const rev: RevDep[] = [{ id: "r", title: "Ajena", status: "pend", owner_name: "Otro", dep_id: "x" }];
  it("jefe: solo locales", () => {
    const r = dependentsOf("x", cards, nameOf, rev, true);
    expect(r.map((d) => d.id)).toEqual(["a"]);
    expect(r[0].owner_name).toBe("Beto");
  });
  it("no-jefe: locales + reverse_deps del id", () => {
    expect(dependentsOf("x", cards, nameOf, rev, false).map((d) => d.id)).toEqual(["a", "r"]);
    expect(dependentsOf("otro", cards, nameOf, rev, false)).toEqual([]);
  });
});

describe("depGraphLayout", () => {
  it("null sin dependencias resolubles", () => {
    expect(depGraphLayout([mkCard({ id: "a" })], {})).toBeNull();
  });
  it("cadena a→b→c: 3 columnas por profundidad, 2 aristas", () => {
    const cards = [
      mkCard({ id: "a", title: "A", status: "term" }),
      mkCard({ id: "b", title: "B", deps: ["a"] }),
      mkCard({ id: "c", title: "C", deps: ["b"] }),
    ];
    const g = depGraphLayout(cards, {})!;
    expect(g.nodes).toHaveLength(3);
    expect(g.edges).toHaveLength(2);
    const x = Object.fromEntries(g.nodes.map((n) => [n.id, n.x]));
    expect(x.a).toBeLessThan(x.b);
    expect(x.b).toBeLessThan(x.c);
    expect(g.nodes.find((n) => n.id === "a")!.done).toBe(true);
    expect(g.edges.find((e) => e.from === "a")!.done).toBe(true);
  });
  it("ciclo a↔b no cuelga y devuelve ambos nodos", () => {
    const cards = [mkCard({ id: "a", deps: ["b"] }), mkCard({ id: "b", deps: ["a"] })];
    expect(depGraphLayout(cards, {})!.nodes).toHaveLength(2);
  });
});
