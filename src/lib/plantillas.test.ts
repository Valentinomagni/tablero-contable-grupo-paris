import { describe, it, expect } from "vitest";
import { filasDePlantilla } from "./plantillas";
import type { PlantillaTareas } from "./types";

const pl: PlantillaTareas = {
  nombre: "IVA por marca",
  categoria: "Impuestos",
  items: [
    { titulo: "IVA Paris", owner: "u2", effort: 3, priority: "alta" },
    { titulo: "IVA Falabella" }, // sin owner/effort/priority → defaults
  ],
};

describe("filasDePlantilla", () => {
  const filas = filasDePlantilla(pl, "Ana", "2020-08-01T00:00:00Z", "u1");

  it("genera una fila por ítem con la categoría de la plantilla", () => {
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.categoria === "Impuestos")).toBe(true);
    expect(filas.every((f) => f.status === "pend" && f.card_type === "normal")).toBe(true);
  });

  it("usa el owner/effort/priority del ítem cuando existen", () => {
    expect(filas[0]).toMatchObject({ owner: "u2", title: "IVA Paris", effort: 3, priority: "alta" });
  });

  it("cae al ownerPorDefecto y a los defaults cuando el ítem no los trae", () => {
    expect(filas[1]).toMatchObject({ owner: "u1", title: "IVA Falabella", effort: 1, priority: "media" });
  });

  it("registra el history con el nombre de la plantilla y quién/cuándo", () => {
    expect(filas[0].history).toEqual([{ who: "Ana", at: "2020-08-01T00:00:00Z", txt: "Generada desde plantilla IVA por marca" }]);
  });
});
