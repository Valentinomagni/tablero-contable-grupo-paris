import { describe, it, expect } from "vitest";
import {
  MIGRACION_ESQUEMA_NUEVO,
  MIGRACION_ETIQUETAS,
  CAMPOS_NUEVOS_CARDS,
  CAMPOS_NUEVOS_PROFILES,
  CAMPOS_ETIQUETAS_CARDS,
  tieneEsquemaNuevo,
  tieneEtiquetas,
  payloadCompatible,
  payloadCards,
  payloadProfiles,
  tieneAdminSistema,
  tieneChecklistDiario,
  payloadOccurrences,
  CAMPOS_CHECKLIST_OCCURRENCES,
  MIGRACION_CATALOGO,
  CAMPOS_CATALOGO,
  tieneCatalogo,
  COLUMNAS_CARDS,
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

describe("tieneEtiquetas", () => {
  it("true sólo si la 31 está en la lista", () => {
    expect(tieneEtiquetas([29, 30, 31])).toBe(true);
    expect(tieneEtiquetas([MIGRACION_ETIQUETAS])).toBe(true);
  });
  it("false si la 31 no está aplicada (aunque la 29 sí)", () => {
    expect(tieneEtiquetas([28, 29, 30])).toBe(false);
  });
  it("null/undefined (desconocido) → false", () => {
    expect(tieneEtiquetas(null)).toBe(false);
    expect(tieneEtiquetas(undefined)).toBe(false);
  });
});

describe("payloadCards — gating de etiquetas (migración 31), independiente de la 29", () => {
  it("29 y 31 aplicadas: el payload va intacto, incluidas etiquetas", () => {
    const p = { title: "x", proc_at: "t", etiquetas: ["Peugeot"] };
    expect(payloadCards(p, [29, 31])).toEqual(p);
  });

  it("29 aplicada pero NO la 31: se saca sólo etiquetas, proc_at se conserva", () => {
    const p = { title: "x", proc_at: "t", etiquetas: ["Peugeot"] };
    expect(payloadCards(p, [29])).toEqual({ title: "x", proc_at: "t" });
  });

  it("31 aplicada pero NO la 29: se saca proc_at, etiquetas se conserva", () => {
    const p = { title: "x", proc_at: "t", etiquetas: ["Peugeot"] };
    expect(payloadCards(p, [31])).toEqual({ title: "x", etiquetas: ["Peugeot"] });
  });

  it("ninguna aplicada: se sacan ambos grupos de campos", () => {
    const p = { title: "x", proc_at: "t", etiquetas: ["Peugeot"] };
    expect(payloadCards(p, null)).toEqual({ title: "x" });
  });

  it("un patch que sólo toca etiquetas no rompe el guardado en una base sin la 31", () => {
    expect(payloadCards({ etiquetas: ["Autocity"] }, [29])).toEqual({});
  });

  it("CAMPOS_ETIQUETAS_CARDS es exactamente ['etiquetas']", () => {
    expect([...CAMPOS_ETIQUETAS_CARDS]).toEqual(["etiquetas"]);
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

  // Migración 33 (admin_sistema) se gatea APARTE de la 29: una base puede tener una
  // sin la otra, y mandar la columna sin que exista rompe el guardado entero (42703).
  it("con la 29 pero sin la 33: manda oculto, saca admin_sistema", () => {
    expect(payloadProfiles({ name: "Ana", oculto: true, admin_sistema: true }, [29]))
      .toEqual({ name: "Ana", oculto: true });
  });

  it("con la 33 pero sin la 29: manda admin_sistema, saca oculto", () => {
    expect(payloadProfiles({ name: "Ana", oculto: true, admin_sistema: true }, [33]))
      .toEqual({ name: "Ana", admin_sistema: true });
  });

  it("con ambas: manda todo", () => {
    const r = { name: "Ana", oculto: true, admin_sistema: true };
    expect(payloadProfiles(r, [29, 33])).toEqual(r);
  });
});

describe("tieneAdminSistema", () => {
  it("true sólo con la migración 33 aplicada", () => {
    expect(tieneAdminSistema([33])).toBe(true);
    expect(tieneAdminSistema([29, 31, 32])).toBe(false);
  });
  it("ante la duda (null/undefined) → false", () => {
    expect(tieneAdminSistema(null)).toBe(false);
    expect(tieneAdminSistema(undefined)).toBe(false);
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

describe("tieneChecklistDiario / payloadOccurrences (migración 34)", () => {
  it("true sólo con la migración 34 aplicada", () => {
    expect(tieneChecklistDiario([34])).toBe(true);
    expect(tieneChecklistDiario([29, 31, 32, 33])).toBe(false);
  });
  it("ante la duda (null/undefined) → false: la app se comporta como antes", () => {
    expect(tieneChecklistDiario(null)).toBe(false);
    expect(tieneChecklistDiario(undefined)).toBe(false);
  });
  it("sin la 34: checklist y obs NO viajan, pero el marcado del día sigue igual", () => {
    const patch = { done: true, done_at: "2026-07-28T10:00:00Z", checklist: [], obs: "algo" };
    expect(payloadOccurrences(patch, [29, 33])).toEqual({ done: true, done_at: "2026-07-28T10:00:00Z" });
  });
  it("con la 34: el payload va intacto", () => {
    const patch = { done: true, checklist: [{ txt: "a", done: false, done_at: null }], obs: null };
    expect(payloadOccurrences(patch, [34])).toEqual(patch);
  });
  it("la lista de campos cubre las columnas de la migración 34", () => {
    expect([...CAMPOS_CHECKLIST_OCCURRENCES]).toEqual(["checklist", "obs"]);
  });
});

// El daño de olvidarse este gate no se parece en nada al tamaño del campo: `estandar_id` viaja
// en el MISMO update que usa el drag & drop del tablero, así que en una base sin la migración 55
// PostgREST rechazaría con 42703 el update entero y mover cualquier tarjeta dejaría de andar.
// Por eso se prueba el caso cruzado (una migración sí, la otra no) y no sólo el feliz.
describe("tieneCatalogo / payloadCards — gating de estandar_id (migración 55)", () => {
  it("true sólo con la migración 55 aplicada", () => {
    expect(tieneCatalogo([55])).toBe(true);
    expect(tieneCatalogo([MIGRACION_CATALOGO])).toBe(true);
    expect(tieneCatalogo([29, 31, 41, 54])).toBe(false);
  });

  it("ante la duda (null/undefined) → false: no se ofrece el catálogo y crear tareas sigue igual", () => {
    expect(tieneCatalogo(null)).toBe(false);
    expect(tieneCatalogo(undefined)).toBe(false);
  });

  it("sin la 55: se saca estandar_id y el resto del update se manda igual", () => {
    const patch = { status: "proc", estandar_id: "abc" };
    expect(payloadCards(patch, [29, 31, 41, 54])).toEqual({ status: "proc" });
  });

  it("con la 55 pero sin la 54: viaja estandar_id y se sacan los campos de bloqueo", () => {
    const patch = { status: "proc", estandar_id: "abc", bloqueo_area: "Ventas", bloqueo_desde: "hoy" };
    expect(payloadCards(patch, [29, 31, 41, 55])).toEqual({ status: "proc", estandar_id: "abc" });
  });

  it("con todas aplicadas: el payload va intacto", () => {
    const patch = { status: "proc", proc_at: "t", etiquetas: ["Peugeot"], estandar_id: "abc" };
    expect(payloadCards(patch, [29, 31, 41, 54, 55])).toEqual(patch);
  });

  it("estandar_id está en COLUMNAS_CARDS: sin eso llega undefined y la comparación no existe", () => {
    expect(COLUMNAS_CARDS.split(",")).toContain("estandar_id");
  });

  it("la lista de campos cubre la columna de la migración 55", () => {
    expect([...CAMPOS_CATALOGO]).toEqual(["estandar_id"]);
  });
});
