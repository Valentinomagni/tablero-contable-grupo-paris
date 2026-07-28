import { describe, it, expect } from "vitest";
import { recomendaciones, ICR_MINIMO_PARA_RECOMENDAR, type SenalesRecomendacion } from "./recomendaciones";
import type { ResultadoICR } from "./icr";

const icrOk: ResultadoICR = { puntaje: 90, muestra: 20, suficiente: true, factores: [], lectura: "" };

const BASE: SenalesRecomendacion = {
  icr: icrOk,
  exposiciones: [
    { horizonte: 1, titulo: "Mañana", total: 0, porCategoria: [] },
    { horizonte: 3, titulo: "En 3 días", total: 0, porCategoria: [] },
    { horizonte: 7, titulo: "En 7 días", total: 0, porCategoria: [] },
  ],
  salud: { esperaPromedioDias: 1, edadPend: 2, edadProc: 2, multitarea: [] },
  concentraciones: [],
  previsibilidad: { planificadas: 10, imprevistas: 1, total: 11, pctPlanificado: 91, alerta: false },
  flujo: [],
  nombrePorId: { u1: "Carolina", u2: "Patricia" },
};

describe("recomendaciones — el ICR manda", () => {
  it("con ICR bajo NO recomienda sobre el trabajo: recomienda arreglar el registro", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: ICR_MINIMO_PARA_RECOMENDAR - 1 },
      concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 95 }] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("icr-bajo");
    expect(r[0].texto).toContain("registro");
  });
  it("con muestra insuficiente tampoco arriesga conclusiones", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: null, suficiente: false, muestra: 3 } });
    expect(r.every((x) => x.id === "muestra-chica")).toBe(true);
  });
  it("nunca culpa a una persona en el texto del ICR bajo", () => {
    const r = recomendaciones({ ...BASE, icr: { ...icrOk, puntaje: 20 } });
    expect(r[0].texto).not.toMatch(/culpa|responsable|descuid/i);
  });
});

describe("recomendaciones — reglas", () => {
  it("vencimientos inminentes generan una recomendación de prioridad alta", () => {
    const r = recomendaciones({ ...BASE, exposiciones: [
      { horizonte: 1, titulo: "Mañana", total: 4, porCategoria: [{ categoria: "IVA", n: 4 }] },
      { horizonte: 3, titulo: "En 3 días", total: 4, porCategoria: [] },
      { horizonte: 7, titulo: "En 7 días", total: 4, porCategoria: [] },
    ] });
    const x = r.find((y) => y.id === "vence-manana")!;
    expect(x.prioridad).toBe("alta");
    expect(x.texto).toContain("IVA");
  });
  it("la concentración de conocimiento propone formar un respaldo, no sacar trabajo", () => {
    const r = recomendaciones({ ...BASE, concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 82 }] });
    const x = r.find((y) => y.id.startsWith("concentracion"))!;
    expect(x.texto).toContain("IVA");
    expect(x.texto).toMatch(/respaldo|acompañ|formar/i);
    expect(x.texto).not.toMatch(/sacarle|quitarle/i);
  });
  it("demasiadas urgencias apuntan a la planificación, no a las personas", () => {
    const r = recomendaciones({ ...BASE, previsibilidad: { planificadas: 3, imprevistas: 9, total: 12, pctPlanificado: 25, alerta: true } });
    const x = r.find((y) => y.id === "previsibilidad")!;
    expect(x.texto).toMatch(/planific/i);
  });
  it("una carga muy concentrada al cierre sugiere adelantar trabajo", () => {
    const r = recomendaciones({ ...BASE, flujo: [
      { owner: "u1", dias: Array(31).fill(0).map((_, i) => (i > 24 ? 9 : 0)), total: 54, picoDia: 28, perfil: "tardio" },
    ] });
    const x = r.find((y) => y.id.startsWith("flujo-tardio"))!;
    expect(x.texto).toContain("Carolina");
    expect(x.texto).toMatch(/adelantar|primera/i);
  });
  it("mucha multitarea sugiere repartir, sin señalar a la persona", () => {
    const r = recomendaciones({ ...BASE, salud: { ...BASE.salud, multitarea: [{ owner: "u2", abiertas: 12 }] } });
    const x = r.find((y) => y.id.startsWith("multitarea"))!;
    expect(x.texto).toContain("Patricia");
    expect(x.texto).not.toMatch(/desorganiz|no puede|ineficaz/i);
  });
  it("todo en orden → sin recomendaciones (no inventa ruido)", () => {
    expect(recomendaciones(BASE)).toEqual([]);
  });
});

describe("recomendaciones — forma", () => {
  it("ordena por prioridad: alta primero", () => {
    const r = recomendaciones({ ...BASE,
      exposiciones: [
        { horizonte: 1, titulo: "Mañana", total: 3, porCategoria: [{ categoria: "IVA", n: 3 }] },
        { horizonte: 3, titulo: "En 3 días", total: 3, porCategoria: [] },
        { horizonte: 7, titulo: "En 7 días", total: 3, porCategoria: [] },
      ],
      previsibilidad: { planificadas: 3, imprevistas: 9, total: 12, pctPlanificado: 25, alerta: true },
    });
    expect(r[0].prioridad).toBe("alta");
  });
  it("cada recomendación explica en qué se basa", () => {
    const r = recomendaciones({ ...BASE, concentraciones: [{ categoria: "IVA", personas: 1, principal: "Carolina", pct: 82 }] });
    expect(r[0].motivo.length).toBeGreaterThan(0);
  });
  it("un owner desconocido no filtra un uuid crudo a la pantalla", () => {
    const r = recomendaciones({ ...BASE, nombrePorId: {},
      salud: { ...BASE.salud, multitarea: [{ owner: "uuid-abc-123", abiertas: 12 }] } });
    expect(r[0].texto).not.toContain("uuid-abc-123");
    expect(r[0].texto).toContain("—");
  });
  it("es defensiva ante señales incompletas", () => {
    expect(() => recomendaciones({} as SenalesRecomendacion)).not.toThrow();
  });
});
