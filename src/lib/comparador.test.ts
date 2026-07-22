import { describe, it, expect } from "vitest";
import { comparativaMensual } from "./comparador";
import type { CardArchive, Profile, Card } from "./types";

function perfil(id: string, marca: string | null = null, sucursal: string | null = null, oculto = false): Profile {
  return {
    id, name: id, role: "empleado", email: `${id}@x.com`, username: id, puesto: "x", ficha: id,
    manager_id: null, marca, sucursal, oculto,
  };
}

function card(over: Partial<Card>): Card {
  return {
    id: over.id ?? "c1", owner: over.owner ?? "u1", title: "t", status: over.status ?? "term",
    description: "", checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: over.card_type ?? "normal",
    deps: [], created_at: "", marca: over.marca, sucursal: over.sucursal,
  };
}

function archivo(mes: string, owner: string, c: Partial<Card>, id = `${mes}-${owner}-${Math.random()}`): CardArchive {
  return { id, owner, mes, card: card({ owner, ...c }), archived_at: "" };
}

describe("comparativaMensual", () => {
  it("sin archives → vacío", () => {
    expect(comparativaMensual([], [perfil("u1")], 6)).toEqual([]);
  });

  it("un mes con datos → una entrada", () => {
    const profiles = [perfil("u1", "MarcaA")];
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "pend" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r).toHaveLength(1);
    expect(r[0].mes).toBe("2026-06");
    expect(r[0].porMarca["MarcaA"]).toBe(50);
  });

  it("respeta la ventana de meses, anclada en el mes más reciente con datos", () => {
    const profiles = [perfil("u1", "MarcaA")];
    const archives = [
      archivo("2026-01", "u1", { status: "term" }),
      archivo("2026-02", "u1", { status: "term" }),
      archivo("2026-03", "u1", { status: "term" }),
      archivo("2026-04", "u1", { status: "term" }),
    ];
    const r = comparativaMensual(archives, profiles, 2);
    expect(r.map((x) => x.mes)).toEqual(["2026-03", "2026-04"]);
  });

  it("orden ascendente por mes", () => {
    const profiles = [perfil("u1", "MarcaA")];
    const archives = [
      archivo("2026-04", "u1", { status: "term" }),
      archivo("2026-02", "u1", { status: "term" }),
      archivo("2026-03", "u1", { status: "term" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r.map((x) => x.mes)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });

  it("la card hereda la marca del dueño cuando no tiene marca propia", () => {
    const profiles = [perfil("u1", "MarcaDueño")];
    const archives = [archivo("2026-06", "u1", { status: "term" })];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porMarca["MarcaDueño"]).toBe(100);
  });

  it("la marca propia de la card manda sobre la del dueño", () => {
    const profiles = [perfil("u1", "MarcaDueño")];
    const archives = [archivo("2026-06", "u1", { status: "term", marca: "MarcaPropia" })];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porMarca["MarcaPropia"]).toBe(100);
    expect(r[0].porMarca["MarcaDueño"]).toBeUndefined();
  });

  it("agrupa por sucursal (card manda, si no hereda del dueño)", () => {
    const profiles = [perfil("u1", null, "SucursalX")];
    const archives = [archivo("2026-06", "u1", { status: "term" })];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porSucursal["SucursalX"]).toBe(100);
  });

  it("excluye usuarios ocultos", () => {
    const profiles = [perfil("u1", "MarcaA"), perfil("oculto1", "MarcaA", null, true)];
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "oculto1", { status: "pend" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porMarca["MarcaA"]).toBe(100);
  });

  it("excluye cards operativas del cálculo", () => {
    const profiles = [perfil("u1", "MarcaA")];
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "pend", card_type: "operativa" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porMarca["MarcaA"]).toBe(100);
  });

  it("un mes sin cards de una marca: esa marca no aparece en ese mes (sin división por cero)", () => {
    const profiles = [perfil("u1", "MarcaA"), perfil("u2", "MarcaB")];
    const archives = [
      archivo("2026-05", "u1", { status: "term" }),
      archivo("2026-06", "u2", { status: "term" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    const mayo = r.find((x) => x.mes === "2026-05")!;
    const junio = r.find((x) => x.mes === "2026-06")!;
    expect(mayo.porMarca["MarcaA"]).toBe(100);
    expect(mayo.porMarca["MarcaB"]).toBeUndefined();
    expect(junio.porMarca["MarcaB"]).toBe(100);
    expect(junio.porMarca["MarcaA"]).toBeUndefined();
  });

  it("varias cards del mismo mes/marca se agrupan (una fila por card en cards_archive)", () => {
    const profiles = [perfil("u1", "MarcaA")];
    const archives = [
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "term" }),
      archivo("2026-06", "u1", { status: "pend" }),
      archivo("2026-06", "u1", { status: "proc" }),
    ];
    const r = comparativaMensual(archives, profiles, 6);
    expect(r[0].porMarca["MarcaA"]).toBe(50);
  });
});
