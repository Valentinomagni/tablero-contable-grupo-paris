import { describe, it, expect } from "vitest";
import { grillaMes, eventosPorDia, conteoPorMes, claveFecha } from "./calendario";
import type { Announcement } from "./types";

const anno = (p: Partial<Announcement>): Announcement =>
  ({ id: "1", kind: "vencimiento", title: "IIBB", detail: "", due_date: "2026-03-18", created_by: "Jefe 1", created_at: "2026-03-01T00:00:00Z", owner_id: null, visible_to: [], ...p });

describe("claveFecha", () => {
  it("formatea con ceros a la izquierda", () => {
    expect(claveFecha(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("grillaMes", () => {
  it("devuelve 42 días arrancando un lunes", () => {
    const g = grillaMes(2026, 3, "2026-03-14"); // marzo 2026
    expect(g).toHaveLength(42);
    // el 1 de marzo de 2026 es domingo → la grilla arranca el lunes 23/02
    expect(g[0].date).toBe("2026-02-23");
    expect(g[0].delMes).toBe(false);
  });
  it("marca los días del mes y el día de hoy", () => {
    const g = grillaMes(2026, 3, "2026-03-14");
    const hoy = g.find((d) => d.esHoy)!;
    expect(hoy.date).toBe("2026-03-14");
    expect(hoy.delMes).toBe(true);
    expect(g.filter((d) => d.delMes)).toHaveLength(31); // marzo tiene 31 días
  });
});

describe("eventosPorDia", () => {
  it("agrupa por fecha e ignora los sin fecha", () => {
    const m = eventosPorDia([
      anno({ id: "a", due_date: "2026-03-18" }),
      anno({ id: "b", due_date: "2026-03-18" }),
      anno({ id: "c", due_date: null }),
    ]);
    expect(m["2026-03-18"].map((x) => x.id)).toEqual(["a", "b"]);
    expect(Object.keys(m)).toHaveLength(1);
  });
});

describe("conteoPorMes", () => {
  it("cuenta eventos por mes del año pedido", () => {
    const c = conteoPorMes([
      anno({ due_date: "2026-03-18" }),
      anno({ due_date: "2026-03-25" }),
      anno({ due_date: "2026-07-01" }),
      anno({ due_date: "2025-03-10" }), // otro año: no cuenta
      anno({ due_date: null }),
    ], 2026);
    expect(c[2]).toBe(2); // marzo
    expect(c[6]).toBe(1); // julio
    expect(c.reduce((a, b) => a + b, 0)).toBe(3);
  });
});
