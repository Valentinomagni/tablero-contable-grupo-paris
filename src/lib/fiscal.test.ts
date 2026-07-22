import { describe, it, expect } from "vitest";
import { VENCIMIENTOS_FISCALES, ajustarFinDeSemana, generarVencimientosMes, tituloVencimiento } from "./fiscal";
import type { Announcement } from "./types";

function mkAnno(p: Partial<Announcement>): Announcement {
  return {
    id: "a1", kind: "vencimiento", title: "t", detail: "", due_date: null,
    created_by: "Ana", created_at: "2020-01-01T00:00:00Z", owner_id: null, visible_to: [],
    ...p,
  };
}

describe("ajustarFinDeSemana", () => {
  it("deja el día sin cambios si es hábil", () => {
    expect(ajustarFinDeSemana(2026, 3, 10)).toBe("2026-03-10"); // martes
  });
  it("corre el sábado al lunes siguiente", () => {
    expect(ajustarFinDeSemana(2026, 7, 18)).toBe("2026-07-20"); // sábado -> lunes
  });
  it("corre el domingo al lunes siguiente", () => {
    expect(ajustarFinDeSemana(2026, 11, 15)).toBe("2026-11-16"); // domingo -> lunes
  });
});

describe("generarVencimientosMes", () => {
  it("mes sin nada previo: propone todas las obligaciones", () => {
    const props = generarVencimientosMes(2026, 3, []);
    expect(props).toHaveLength(VENCIMIENTOS_FISCALES.length);
    expect(props.map((p) => p.title)).toContain(tituloVencimiento("IVA", 2026, 3));
  });

  it("mes ya generado: no propone nada (idempotencia)", () => {
    const existentes = VENCIMIENTOS_FISCALES.map((v) =>
      mkAnno({ title: tituloVencimiento(v.nombre, 2026, 3) }),
    );
    expect(generarVencimientosMes(2026, 3, existentes)).toHaveLength(0);
  });

  it("generación parcial: propone solo las que faltan", () => {
    const existentes = [mkAnno({ title: tituloVencimiento("IVA", 2026, 3) })];
    const props = generarVencimientosMes(2026, 3, existentes);
    expect(props).toHaveLength(VENCIMIENTOS_FISCALES.length - 1);
    expect(props.map((p) => p.title)).not.toContain(tituloVencimiento("IVA", 2026, 3));
  });

  it("no descarta por vencimientos de otro mes ni de otro kind", () => {
    const existentes = [
      mkAnno({ title: tituloVencimiento("IVA", 2026, 2) }), // otro mes
      mkAnno({ kind: "aviso", title: tituloVencimiento("IVA", 2026, 3) }), // otro kind
    ];
    expect(generarVencimientosMes(2026, 3, existentes)).toHaveLength(VENCIMIENTOS_FISCALES.length);
  });

  it("fin de semana: la fecha propuesta cae en lunes cuando corresponde", () => {
    const props = generarVencimientosMes(2026, 7, []);
    const iva = props.find((p) => p.title === tituloVencimiento("IVA", 2026, 7));
    expect(iva?.due_date).toBe("2026-07-20"); // 18/07/2026 es sábado
  });
});
