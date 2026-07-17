import { describe, it, expect } from "vitest";
import { vigente, expirado, ordenarAvisos, archivados, activos } from "./tablon";
import type { Announcement } from "./types";

function mk(p: Partial<Announcement>): Announcement {
  return {
    id: "a", kind: "aviso", title: "t", detail: "", due_date: null,
    created_by: "X", created_at: "2026-07-01T00:00:00Z", owner_id: null, visible_to: [],
    prioridad: "normal", vigente_hasta: null, archivado: false, ...p,
  };
}
const HOY = "2026-07-17";

describe("vigente / expirado", () => {
  it("sin vigencia y no archivado → vigente", () => {
    expect(vigente(mk({}), HOY)).toBe(true);
    expect(expirado(mk({}), HOY)).toBe(false);
  });
  it("vigente_hasta en el pasado → expirado, no vigente", () => {
    const a = mk({ vigente_hasta: "2026-07-10" });
    expect(vigente(a, HOY)).toBe(false);
    expect(expirado(a, HOY)).toBe(true);
  });
  it("vigente_hasta hoy o futuro → vigente", () => {
    expect(vigente(mk({ vigente_hasta: HOY }), HOY)).toBe(true);
    expect(vigente(mk({ vigente_hasta: "2026-08-01" }), HOY)).toBe(true);
  });
  it("archivado → no vigente", () => {
    expect(vigente(mk({ archivado: true }), HOY)).toBe(false);
  });
});

describe("ordenarAvisos", () => {
  it("urgente > importante > normal, luego más nuevo primero", () => {
    const l = [
      mk({ id: "n", prioridad: "normal", created_at: "2026-07-05" }),
      mk({ id: "u", prioridad: "urgente", created_at: "2026-07-01" }),
      mk({ id: "i2", prioridad: "importante", created_at: "2026-07-02" }),
      mk({ id: "i1", prioridad: "importante", created_at: "2026-07-06" }),
    ];
    expect(ordenarAvisos(l).map((a) => a.id)).toEqual(["u", "i1", "i2", "n"]);
  });
});

describe("activos / archivados", () => {
  it("separa vigentes de archivados+expirados y ordena los activos", () => {
    const l = [
      mk({ id: "viv", prioridad: "urgente" }),
      mk({ id: "arch", archivado: true }),
      mk({ id: "exp", vigente_hasta: "2026-01-01" }),
    ];
    expect(activos(l, HOY).map((a) => a.id)).toEqual(["viv"]);
    expect(archivados(l, HOY).map((a) => a.id).sort()).toEqual(["arch", "exp"]);
  });
});
