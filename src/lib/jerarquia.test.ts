import { describe, it, expect } from "vitest";
import { reportesDirectos, equipoDe, visiblesPara, porMarca, puedeSerManager, cardsDeEquipo, puedeReasignar, construirArbol, arbolConAncestros } from "./jerarquia";
import type { Card, Profile } from "./types";
const p = (id: string, role: Profile["role"], manager_id: string | null = null, marca: string | null = null): Profile =>
  ({ id, name: id, role, email: "", username: null, puesto: "", ficha: "", manager_id, marca });
const team = [
  p("jefe", "jefe"), p("enc", "encargado", "jefe", "Peugeot"),
  p("e1", "empleado", "enc", "Peugeot"), p("e2", "empleado", "enc", "Peugeot"),
  p("enc2", "encargado", "jefe", "Honda"), p("e3", "empleado", "enc2", "Honda"),
];
describe("reportesDirectos", () => {
  it("solo los reportes directos", () =>
    expect(reportesDirectos("enc", team).map(x => x.id)).toEqual(["e1", "e2"]));
});
describe("equipoDe", () => {
  it("incluye subárbol", () =>
    expect(equipoDe("jefe", team).map(x => x.id).sort()).toEqual(["e1", "e2", "e3", "enc", "enc2"]));
});
describe("visiblesPara", () => {
  it("empleado ve solo a sí mismo", () =>
    expect(visiblesPara(team[2], team).map(x => x.id)).toEqual(["e1"]));
  it("encargado ve a sí y su equipo", () =>
    expect(visiblesPara(team[1], team).map(x => x.id).sort()).toEqual(["e1", "e2", "enc"]));
  it("jefe ve a todos", () =>
    expect(visiblesPara(team[0], team).length).toBe(6));
});
describe("porMarca", () => {
  it("agrupa por marca", () =>
    expect(Object.keys(porMarca(team)).sort()).toEqual(["Honda", "Peugeot"]));
});
describe("puedeSerManager", () => {
  it("no puede ser su propio manager", () =>
    expect(puedeSerManager("enc", "enc", team)).toBe(false));
  it("no puede asignar un subordinado como manager (anti-ciclo)", () =>
    expect(puedeSerManager("e1", "enc", team)).toBe(false));
  it("no puede asignar un subordinado indirecto como manager", () =>
    expect(puedeSerManager("e3", "jefe", team)).toBe(false));
  it("puede asignar un manager válido fuera de su subárbol", () =>
    expect(puedeSerManager("enc2", "enc", team)).toBe(true));
  it("el jefe puede ser manager de cualquiera", () =>
    expect(puedeSerManager("jefe", "enc", team)).toBe(true));
});

const card = (id: string, owner: string): Card => ({
  id, owner, title: "t", status: "pend", description: "", checklist: [], comments: [], history: [],
  done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
  card_type: "normal", deps: [], created_at: "2026-07-01T00:00:00Z",
});
describe("cardsDeEquipo", () => {
  const cards = [card("a", "e1"), card("b", "e2"), card("c", "e3")];
  it("deja solo las cards cuyo dueño está en el equipo visible", () =>
    expect(cardsDeEquipo(cards, visiblesPara(team[1], team)).map(c => c.id).sort()).toEqual(["a", "b"]));
  it("team vacío => sin cards", () =>
    expect(cardsDeEquipo(cards, [])).toEqual([]));
  it("no muta el array original", () => {
    const n = cards.length; cardsDeEquipo(cards, team); expect(cards.length).toBe(n);
  });
});

describe("construirArbol", () => {
  it("arma jefe -> [enc -> [e1,e2], enc2 -> [e3]]", () => {
    const raices = construirArbol(team);
    expect(raices.map((r) => r.profile.id)).toEqual(["jefe"]);
    const jefe = raices[0];
    expect(jefe.hijos.map((h) => h.profile.id).sort()).toEqual(["enc", "enc2"]);
    const enc = jefe.hijos.find((h) => h.profile.id === "enc")!;
    expect(enc.hijos.map((h) => h.profile.id).sort()).toEqual(["e1", "e2"]);
    const enc2 = jefe.hijos.find((h) => h.profile.id === "enc2")!;
    expect(enc2.hijos.map((h) => h.profile.id)).toEqual(["e3"]);
    // hojas sin hijos
    expect(enc.hijos.every((h) => h.hijos.length === 0)).toBe(true);
  });
  it("manager fuera del set => raíz (subárbol de un encargado)", () => {
    // solo el equipo de 'enc' (sin el jefe). enc.manager_id='jefe' no está en el set => raíz.
    const sub = team.filter((p) => ["enc", "e1", "e2"].includes(p.id));
    const raices = construirArbol(sub);
    expect(raices.map((r) => r.profile.id)).toEqual(["enc"]);
    expect(raices[0].hijos.map((h) => h.profile.id).sort()).toEqual(["e1", "e2"]);
  });
  it("sin jerarquía (manager_id null) => todos raíces planos", () => {
    const planos = [p("a", "empleado"), p("b", "empleado"), p("c", "empleado")];
    const raices = construirArbol(planos);
    expect(raices.map((r) => r.profile.id)).toEqual(["a", "b", "c"]);
    expect(raices.every((r) => r.hijos.length === 0)).toBe(true);
  });
  it("array vacío => []", () => {
    expect(construirArbol([])).toEqual([]);
  });
});

describe("arbolConAncestros", () => {
  // Juan (General) es manager de Ana (Peugeot) y de Beto (Honda) — jerarquía cruzada de marcas,
  // el caso real reportado por el usuario.
  const cruzado = [
    p("juan", "jefe", null, "General"),
    p("ana", "encargado", "juan", "Peugeot"),
    p("e1", "empleado", "ana", "Peugeot"),
    p("beto", "encargado", "juan", "Honda"),
    p("e2", "empleado", "beto", "Honda"),
  ];

  it("sin filtro (null) => árbol completo, igual que construirArbol", () => {
    const raices = arbolConAncestros(cruzado, null);
    expect(raices.map((r) => r.profile.id)).toEqual(["juan"]);
    expect(raices[0].hijos.map((h) => h.profile.id).sort()).toEqual(["ana", "beto"]);
  });

  it("filtrando por Peugeot, Juan (General) aparece como raíz con Ana colgando", () => {
    const raices = arbolConAncestros(cruzado, "Peugeot");
    expect(raices.map((r) => r.profile.id)).toEqual(["juan"]);
    const juan = raices[0];
    expect(juan.hijos.map((h) => h.profile.id)).toEqual(["ana"]);
    expect(juan.hijos[0].hijos.map((h) => h.profile.id)).toEqual(["e1"]);
    // Beto (Honda) no pertenece a la cadena de ancestros de Peugeot: no debe colgar de Juan.
    expect(juan.hijos.some((h) => h.profile.id === "beto")).toBe(false);
  });

  it("filtrando por Honda, Juan también aparece como raíz con Beto colgando", () => {
    const raices = arbolConAncestros(cruzado, "Honda");
    expect(raices.map((r) => r.profile.id)).toEqual(["juan"]);
    expect(raices[0].hijos.map((h) => h.profile.id)).toEqual(["beto"]);
  });

  it("dos jefes sin manager (marcas distintas) => dos raíces legítimas", () => {
    const dosJefes = [
      p("j1", "jefe", null, "Peugeot"),
      p("j2", "jefe", null, "Honda"),
      p("sub1", "empleado", "j1", "Peugeot"),
    ];
    const raices = arbolConAncestros(dosJefes, null);
    expect(raices.map((r) => r.profile.id).sort()).toEqual(["j1", "j2"]);
  });

  it("un encargado filtrando su propia marca => solo su subárbol, sin superiores fantasma", () => {
    const raices = arbolConAncestros(cruzado, "Peugeot");
    // El único ancestro real de Ana es Juan; no debe aparecer nadie de Honda.
    const ids: string[] = [];
    const walk = (n: (typeof raices)[number]) => { ids.push(n.profile.id); n.hijos.forEach(walk); };
    raices.forEach(walk);
    expect(ids.sort()).toEqual(["ana", "e1", "juan"]);
  });

  it("array vacío => []", () => {
    expect(arbolConAncestros([], "Peugeot")).toEqual([]);
  });

  // Reproducción literal del reporte del usuario: "Con 4 integrantes solo se visualiza
  // correctamente mi equipo. Si selecciono a Juan puedo ver toda la estructura, pero al
  // seleccionar cualquier otro integrante, Juan deja de aparecer." Juan es Gerente Contable
  // General (marca "General", sin manager) y es jefe directo de un encargado por cada marca.
  // Con la vista rediseñada, "seleccionar a otro integrante" equivale a filtrar por SU marca.
  it("caso del usuario: 4 integrantes, Juan (Gerente Contable General) siempre visible con cualquier filtro", () => {
    const equipo4 = [
      p("juan", "jefe", null, "General"),          // máxima autoridad
      p("ana", "encargado", "juan", "Peugeot"),
      p("beto", "encargado", "juan", "Honda"),
      p("cami", "encargado", "juan", "Citroën"),
    ];
    for (const marca of ["Peugeot", "Honda", "Citroën"]) {
      const raices = arbolConAncestros(equipo4, marca);
      expect(raices.map((r) => r.profile.id)).toEqual(["juan"]); // Juan sigue siendo la raíz
      expect(raices[0].hijos.map((h) => h.profile.id)).toEqual([
        equipo4.find((x) => x.marca === marca)!.id,
      ]);
    }
    // Y sin filtro ("Todas las marcas"), Juan sigue siendo la única raíz con los 3 colgando.
    const todas = arbolConAncestros(equipo4, null);
    expect(todas.map((r) => r.profile.id)).toEqual(["juan"]);
    expect(todas[0].hijos.map((h) => h.profile.id).sort()).toEqual(["ana", "beto", "cami"]);
  });
});

describe("puedeReasignar", () => {
  const enc = team[1]; // encargado de Peugeot (e1, e2)
  const jefe = team[0];
  it("encargado reasigna entre miembros de su equipo", () =>
    expect(puedeReasignar(enc, "e1", "e2", team)).toBe(true));
  it("encargado NO reasigna hacia alguien fuera de su equipo", () =>
    expect(puedeReasignar(enc, "e1", "e3", team)).toBe(false));
  it("encargado NO reasigna una card de fuera de su equipo", () =>
    expect(puedeReasignar(enc, "e3", "e1", team)).toBe(false));
  it("origen y destino iguales => false", () =>
    expect(puedeReasignar(enc, "e1", "e1", team)).toBe(false));
  it("empleado nunca puede reasignar", () =>
    expect(puedeReasignar(team[2], "e1", "e2", team)).toBe(false));
  it("jefe puede reasignar entre cualesquiera", () =>
    expect(puedeReasignar(jefe, "e1", "e3", team)).toBe(true));
});
