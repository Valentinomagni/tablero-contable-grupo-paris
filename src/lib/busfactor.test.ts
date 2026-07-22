import { describe, it, expect } from "vitest";
import { concentracion } from "./busfactor";
import type { CardArchive, Profile, Card } from "./types";

function mkProfile(id: string, name: string, oculto = false): Profile {
  return { id, name, role: "empleado", email: `${id}@x.com`, username: null, puesto: "", ficha: "", manager_id: null, marca: null, oculto };
}

function mkCard(categoria: string | null, card_type: "normal" | "operativa" = "normal"): Card {
  return {
    id: Math.random().toString(), owner: "", title: "t", status: "term", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null, recurring: false,
    priority: "media", effort: 1, card_type, deps: [], created_at: "2026-01-01",
    categoria,
  };
}

function mkArchive(owner: string, categoria: string | null, card_type: "normal" | "operativa" = "normal", mes = "2026-01"): CardArchive {
  return { id: Math.random().toString(), owner, mes, card: mkCard(categoria, card_type), archived_at: "2026-01-31" };
}

describe("concentracion", () => {
  it("sin archives -> vacío", () => {
    expect(concentracion([], [])).toEqual([]);
  });

  it("categoría con una sola persona -> pct 100 y personas 1", () => {
    const profiles = [mkProfile("a", "Ana")];
    const archives = [mkArchive("a", "DDJJ IIBB"), mkArchive("a", "DDJJ IIBB")];
    const r = concentracion(archives, profiles);
    expect(r).toEqual([{ categoria: "DDJJ IIBB", personas: 1, principal: "Ana", pct: 100 }]);
  });

  it("categoría repartida 50/50 -> no aparece", () => {
    const profiles = [mkProfile("a", "Ana"), mkProfile("b", "Beto")];
    const archives = [
      mkArchive("a", "DDJJ IIBB"), mkArchive("a", "DDJJ IIBB"),
      mkArchive("b", "DDJJ IIBB"), mkArchive("b", "DDJJ IIBB"),
    ];
    expect(concentracion(archives, profiles)).toEqual([]);
  });

  it("categoría 85/15 -> aparece con pct 85", () => {
    const profiles = [mkProfile("a", "Ana"), mkProfile("b", "Beto")];
    const archives = [
      ...Array.from({ length: 17 }, () => mkArchive("a", "DDJJ IIBB")),
      ...Array.from({ length: 3 }, () => mkArchive("b", "DDJJ IIBB")),
    ];
    const r = concentracion(archives, profiles);
    expect(r).toEqual([{ categoria: "DDJJ IIBB", personas: 2, principal: "Ana", pct: 85 }]);
  });

  it("cards sin categoría -> ignoradas", () => {
    const profiles = [mkProfile("a", "Ana")];
    const archives = [mkArchive("a", null), mkArchive("a", null)];
    expect(concentracion(archives, profiles)).toEqual([]);
  });

  it("operativas -> ignoradas", () => {
    const profiles = [mkProfile("a", "Ana")];
    const archives = [mkArchive("a", "DDJJ IIBB", "operativa"), mkArchive("a", "DDJJ IIBB", "operativa")];
    expect(concentracion(archives, profiles)).toEqual([]);
  });

  it("usuario oculto -> excluido", () => {
    const profiles = [mkProfile("a", "Ana", true)];
    const archives = [mkArchive("a", "DDJJ IIBB"), mkArchive("a", "DDJJ IIBB")];
    expect(concentracion(archives, profiles)).toEqual([]);
  });

  it("ordena por pct desc", () => {
    const profiles = [mkProfile("a", "Ana"), mkProfile("b", "Beto"), mkProfile("c", "Caro")];
    const archives = [
      ...Array.from({ length: 9 }, () => mkArchive("a", "Cat90")), mkArchive("b", "Cat90"),
      ...Array.from({ length: 8 }, () => mkArchive("c", "Cat80")), ...Array.from({ length: 2 }, () => mkArchive("a", "Cat80")),
    ];
    const r = concentracion(archives, profiles);
    expect(r.map((x) => x.categoria)).toEqual(["Cat90", "Cat80"]);
  });
});
