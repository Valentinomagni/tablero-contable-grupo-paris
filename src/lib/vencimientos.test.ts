import { describe, it, expect } from "vitest";
import { diasHasta, estadoVencimiento, ordenarVencimientos, proximosVencimientos, CLS_TONO } from "./vencimientos";
import type { Announcement } from "./types";

const anno = (p: Partial<Announcement>): Announcement =>
  ({ id: "1", kind: "vencimiento", title: "IIBB", detail: "", due_date: "2026-03-18", created_by: "Jefe 1", created_at: "2026-03-01T00:00:00Z", owner_id: null, visible_to: [], ...p });

const NOW = new Date("2026-03-14T15:30:00");

describe("diasHasta", () => {
  it("cuenta días calendario ignorando la hora", () => {
    expect(diasHasta("2026-03-14", NOW)).toBe(0);
    expect(diasHasta("2026-03-18", NOW)).toBe(4);
    expect(diasHasta("2026-03-13", NOW)).toBe(-1);
  });
});

describe("estadoVencimiento", () => {
  it("devuelve null sin fecha", () => {
    expect(estadoVencimiento(null, NOW)).toBeNull();
  });
  it("vencido → danger con 'Venció'", () => {
    const e = estadoVencimiento("2026-03-10", NOW)!;
    expect(e.tono).toBe("danger");
    expect(e.txt).toMatch(/^Venció 10\/0?3/); // el ICU del entorno puede omitir el cero
  });
  it("hoy → warn con 'Vence HOY'", () => {
    const e = estadoVencimiento("2026-03-14", NOW)!;
    expect(e.tono).toBe("warn");
    expect(e.txt).toBe("Vence HOY");
  });
  it("dentro de 5 días → warn con countdown", () => {
    const e = estadoVencimiento("2026-03-18", NOW)!;
    expect(e.tono).toBe("warn");
    expect(e.txt).toMatch(/^Vence 18\/0?3 · 4 d$/);
  });
  it("lejano → neutral", () => {
    expect(estadoVencimiento("2026-04-20", NOW)!.tono).toBe("neutral");
  });
  it("cada tono tiene clase de chip", () => {
    expect(CLS_TONO.danger).toContain("danger");
    expect(CLS_TONO.warn).toContain("warn");
    expect(CLS_TONO.neutral).toContain("chip");
  });
});

describe("ordenarVencimientos", () => {
  it("filtra por kind y ordena por fecha con sin-fecha al final", () => {
    const r = ordenarVencimientos([
      anno({ id: "a", due_date: "2026-03-20" }),
      anno({ id: "b", kind: "aviso", due_date: "2026-03-01" }),
      anno({ id: "c", due_date: null }),
      anno({ id: "d", due_date: "2026-03-10" }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["d", "a", "c"]);
  });
});

describe("proximosVencimientos", () => {
  it("solo futuros/hoy dentro de la ventana, ordenados", () => {
    const r = proximosVencimientos([
      anno({ id: "vencido", due_date: "2026-03-10" }),
      anno({ id: "hoy", due_date: "2026-03-14" }),
      anno({ id: "cerca", due_date: "2026-03-18" }),
      anno({ id: "lejos", due_date: "2026-05-01" }),
      anno({ id: "sinFecha", due_date: null }),
      anno({ id: "aviso", kind: "aviso", due_date: "2026-03-15" }),
    ], NOW, 30);
    expect(r.map((x) => x.id)).toEqual(["hoy", "cerca"]);
  });
  it("respeta la ventana en días", () => {
    const r = proximosVencimientos([anno({ id: "x", due_date: "2026-03-18" })], NOW, 3);
    expect(r).toHaveLength(0);
  });
});
