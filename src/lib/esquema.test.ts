import { describe, it, expect } from "vitest";
import {
  MIGRACION_ESQUEMA_NUEVO,
  CAMPOS_NUEVOS_CARDS,
  CAMPOS_NUEVOS_PROFILES,
  tieneEsquemaNuevo,
  payloadCompatible,
  payloadCards,
  payloadProfiles,
} from "./esquema";

describe("tieneEsquemaNuevo", () => {
  it("true sólo si la 29 está en la lista", () => {
    expect(tieneEsquemaNuevo([28, 29])).toBe(true);
    expect(tieneEsquemaNuevo([MIGRACION_ESQUEMA_NUEVO])).toBe(true);
  });
  it("false si la 29 no está aplicada", () => {
    expect(tieneEsquemaNuevo([13, 14, 25, 26, 27, 28])).toBe(false);
  });
  it("null/undefined (desconocido) → false: se asume esquema VIEJO", () => {
    expect(tieneEsquemaNuevo(null)).toBe(false);
    expect(tieneEsquemaNuevo(undefined)).toBe(false);
  });
  it("lista vacía → false", () => {
    expect(tieneEsquemaNuevo([])).toBe(false);
  });
});

describe("payloadCards", () => {
  const patch = { status: "proc", done_at: null, proc_at: "2026-07-21T10:00:00Z", history: [] };

  it("esquema nuevo: el payload va intacto", () => {
    expect(payloadCards(patch, [29])).toEqual(patch);
  });

  it("esquema viejo: saca proc_at y conserva el resto (drag & drop sigue funcionando)", () => {
    expect(payloadCards(patch, [28])).toEqual({ status: "proc", done_at: null, history: [] });
  });

  it("esquema desconocido (null): saca proc_at", () => {
    expect(payloadCards(patch, null)).toEqual({ status: "proc", done_at: null, history: [] });
  });

  it("esquema viejo: el insert de una tarea nueva pierde dato_control pero se crea", () => {
    const row = { owner: "ana", title: "Conciliación", status: "pend", dato_control: "REF-1" };
    expect(payloadCards(row, null)).toEqual({ owner: "ana", title: "Conciliación", status: "pend" });
  });

  it("esquema viejo: saca tiempo_max_horas también", () => {
    expect(payloadCards({ title: "x", tiempo_max_horas: 8 }, null)).toEqual({ title: "x" });
  });

  it("no muta el objeto original", () => {
    const orig = { status: "pend", proc_at: null };
    payloadCards(orig, null);
    expect(orig).toEqual({ status: "pend", proc_at: null });
  });

  it("un payload sin campos nuevos queda igual en ambos esquemas", () => {
    const p = { status: "term", done_at: "x" };
    expect(payloadCards(p, null)).toEqual(p);
    expect(payloadCards(p, [29])).toEqual(p);
  });
});

describe("payloadProfiles", () => {
  const row = { name: "Ana", role: "empleado", marca: "Paris", oculto: true };

  it("esquema nuevo: manda oculto", () => {
    expect(payloadProfiles(row, [29])).toEqual(row);
  });

  it("esquema viejo: saca oculto y el perfil se guarda igual", () => {
    expect(payloadProfiles(row, [26, 27, 28])).toEqual({ name: "Ana", role: "empleado", marca: "Paris" });
  });

  it("esquema desconocido: saca oculto y last_seen", () => {
    expect(payloadProfiles({ name: "Ana", oculto: false, last_seen: "x" }, null)).toEqual({ name: "Ana" });
  });
});

describe("payloadCompatible", () => {
  it("respeta la lista de campos que se le pase", () => {
    expect(payloadCompatible({ a: 1, b: 2 }, null, ["b"])).toEqual({ a: 1 });
  });
  it("es defensivo ante payloads no-objeto", () => {
    expect(payloadCompatible(null as unknown as object, null, ["a"])).toBe(null);
  });
  it("las listas de campos cubren las columnas de la migración 29", () => {
    expect([...CAMPOS_NUEVOS_CARDS]).toEqual(["proc_at", "tiempo_max_horas", "dato_control"]);
    expect([...CAMPOS_NUEVOS_PROFILES]).toEqual(["oculto", "last_seen"]);
  });
});
