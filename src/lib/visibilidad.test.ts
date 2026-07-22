import { describe, it, expect } from "vitest";
import { esVisible, personasVisibles, cardsVisibles, archivesParaMetricas, enAlcanceDeMetricas } from "./visibilidad";
import type { Profile } from "./types";

const p = (id: string, email: string, oculto?: boolean): Profile =>
  ({ id, name: id, role: "empleado", email, username: null, puesto: "", ficha: "", manager_id: null, marca: null, oculto });

describe("esVisible", () => {
  it("perfil normal es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com"))).toBe(true);
  });
  it("oculto: true no es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", true))).toBe(false);
  });
  it("el centinela sin-asignar no es visible", () => {
    expect(esVisible(p("sin-asignar", "sin-asignar@grupoparis.com"))).toBe(false);
  });
  it("oculto undefined (base sin migración 29) es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", undefined))).toBe(true);
  });
  it("oculto: false explícito (valor real tras la migración 29) es visible", () => {
    expect(esVisible(p("u1", "u1@grupoparis.com", false))).toBe(true);
  });
});

describe("personasVisibles", () => {
  it("filtra ocultos y sin-asignar conservando el orden", () => {
    const ps = [
      p("u1", "u1@grupoparis.com"),
      p("u2", "u2@grupoparis.com", true),
      p("sin-asignar", "sin-asignar@grupoparis.com"),
      p("u3", "u3@grupoparis.com"),
    ];
    expect(personasVisibles(ps).map((x) => x.id)).toEqual(["u1", "u3"]);
  });
});

describe("cardsVisibles", () => {
  const c = (id: string, owner: string) => ({ id, owner });
  const profiles = [
    p("u1", "u1@grupoparis.com"),
    p("u2", "u2@grupoparis.com", true),
    p("sin-asignar", "sin-asignar@grupoparis.com"),
  ];

  it("excluye solo las cards del owner oculto", () => {
    const cards = [c("c1", "u1"), c("c2", "u2"), c("c3", "sin-asignar")];
    expect(cardsVisibles(cards, profiles).map((x) => x.id)).toEqual(["c1", "c3"]);
  });

  it("conserva las cards de 'Sin asignar' (huérfanas reales, no ocultarlas)", () => {
    const cards = [c("c1", "sin-asignar")];
    expect(cardsVisibles(cards, profiles).map((x) => x.id)).toEqual(["c1"]);
  });

  it("sin perfiles ocultos, no filtra nada", () => {
    const cards = [c("c1", "u1"), c("c2", "u3")];
    expect(cardsVisibles(cards, [p("u1", "u1@grupoparis.com")]).map((x) => x.id)).toEqual(["c1", "c2"]);
  });
});

describe("archivesParaMetricas (criterio único de métricas históricas)", () => {
  const arch = (owner: string) => ({ id: `a-${owner}`, owner, mes: "2026-06" });
  const perfiles = [
    p("u1", "u1@grupoparis.com"),
    p("fantasma", "admin@grupoparis.com", true),
    p("sin-asignar", "sin-asignar@grupoparis.com"),
  ];

  it("excluye los archivos de un usuario oculto", () => {
    const out = archivesParaMetricas([arch("u1"), arch("fantasma")], perfiles);
    expect(out.map((a) => a.owner)).toEqual(["u1"]);
  });

  it("MANTIENE el centinela sin-asignar (a diferencia de esVisible)", () => {
    // Es la incoherencia que este helper vino a cerrar: comparativaMensual y concentracion
    // usaban esVisible, que se llevaba puesto al centinela, mientras que analizarMes no
    // excluía a nadie — y el mismo mes daba dos porcentajes distintos.
    const out = archivesParaMetricas([arch("u1"), arch("sin-asignar")], perfiles);
    expect(out.map((a) => a.owner).sort()).toEqual(["sin-asignar", "u1"]);
  });

  it("coincide con el criterio de cardsVisibles sobre los mismos owners", () => {
    const owners = ["u1", "fantasma", "sin-asignar"];
    const porArchivo = archivesParaMetricas(owners.map(arch), perfiles).map((a) => a.owner);
    const porCard = cardsVisibles(owners.map((owner) => ({ owner })), perfiles).map((c) => c.owner);
    expect(porArchivo).toEqual(porCard);
  });

  it("sin perfiles ocultos no descarta nada", () => {
    const out = archivesParaMetricas([arch("u1"), arch("u2")], [p("u1", "u1@x.com"), p("u2", "u2@x.com")]);
    expect(out).toHaveLength(2);
  });

  // Cableado real: los consumidores (equipoVisible, teamSeg) reciben perfiles YA sin el
  // oculto — personasVisibles() lo sacó antes. El fantasma nunca aparece en esa lista.
  describe("con la lista de perfiles ya acotada (sin el oculto adentro, como llega en la app)", () => {
    const perfilesVisibles = [p("u1", "u1@grupoparis.com")]; // sin "fantasma", sin "sin-asignar"

    it("los archivos del fantasma quedan excluidos aunque no esté en la lista", () => {
      const out = archivesParaMetricas([arch("u1"), arch("fantasma")], perfilesVisibles);
      expect(out.map((a) => a.owner)).toEqual(["u1"]);
    });

    it("el centinela 'sin-asignar' cuenta aunque no esté en la lista de perfiles visibles", () => {
      // El centinela real se identifica por SIN_ASIGNAR_ID (uuid de ceros), no por un id
      // legible — esSinAsignar() es quien reconoce ese uuid, no una coincidencia de texto.
      const sentinelId = "00000000-0000-0000-0000-000000000000";
      const out = archivesParaMetricas([arch("u1"), arch(sentinelId)], perfilesVisibles);
      expect(out.map((a) => a.owner).sort()).toEqual([sentinelId, "u1"]);
    });

    it("un owner desconocido (ni en la lista ni centinela) queda excluido", () => {
      const out = archivesParaMetricas([arch("u1"), arch("desconocido-uuid")], perfilesVisibles);
      expect(out.map((a) => a.owner)).toEqual(["u1"]);
    });
  });
});

// El helper genérico detrás de archivesParaMetricas, extraído para que cualquier métrica
// sobre cards/ActivityLog use el MISMO criterio (review Fase D, MEDIA 2).
describe("enAlcanceDeMetricas", () => {
  const perfilesVisibles = [p("u1", "u1@grupoparis.com")]; // lista ya acotada, sin el fantasma

  it("excluye al oculto que NO está en la lista acotada (filtro positivo)", () => {
    const out = enAlcanceDeMetricas([{ owner: "u1", qty: 1 }, { owner: "fantasma", qty: 99 }], perfilesVisibles);
    expect(out.map((x) => x.owner)).toEqual(["u1"]);
  });

  it("excluye al oculto que SÍ está en la lista", () => {
    const out = enAlcanceDeMetricas([{ owner: "u1" }, { owner: "u2" }], [p("u1", "a@x.com"), p("u2", "b@x.com", true)]);
    expect(out.map((x) => x.owner)).toEqual(["u1"]);
  });

  it("deja pasar el centinela 'Sin asignar'", () => {
    const sentinelId = "00000000-0000-0000-0000-000000000000";
    const out = enAlcanceDeMetricas([{ owner: sentinelId }], perfilesVisibles);
    expect(out).toHaveLength(1);
  });

  it("tolera entradas nulas", () => {
    expect(enAlcanceDeMetricas([], [])).toEqual([]);
  });
});
