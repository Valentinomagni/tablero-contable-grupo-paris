import { describe, it, expect } from "vitest";
import { armarLibroAnalisis } from "./excel";
import { ENCUADRE_REPARTO } from "./encuadre";
import type { AnalisisMes } from "./analisis";

const base: AnalisisMes = {
  cumplimiento: 82,
  porMarca: [{ marca: "Peugeot", pct: 90, total: 10 }, { marca: "Honda", pct: 70, total: 5 }],
  porSucursal: [{ sucursal: "Merlo", pct: 85, total: 8 }],
  porPersona: [
    { id: "ana", nombre: "Ana", pct: 100, total: 4, vencidas: 0, abiertas: 0 },
    { id: "bo", nombre: "Bo", pct: 50, total: 4, vencidas: 1, abiertas: 2 },
  ],
  distribucion: { medianaAbiertas: 1, sobrecargados: [] },
  arqueos: { difs: 2, montoTotal: 1500 },
  vencidas: 3,
  deltaMesAnterior: 5,
  promedioHistorico: 78,
};

describe("armarLibroAnalisis", () => {
  it("produce las 4 hojas con los nombres esperados", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    expect(libro.hojas.map((h) => h.nombre)).toEqual(["Resumen", "Por persona", "Por marca", "Por sucursal"]);
  });

  it("Resumen: título con mesLabel y sin segmento cuando es null", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const resumen = libro.hojas.find((h) => h.nombre === "Resumen")!;
    expect(resumen.filas[0][0]).toContain("julio 2026");
    expect(resumen.filas[0][0]).not.toContain("null");
  });

  it("Resumen: título incluye el segmento cuando está presente", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: "Peugeot — Merlo" });
    const resumen = libro.hojas.find((h) => h.nombre === "Resumen")!;
    expect(String(resumen.filas[0][0])).toContain("Peugeot — Merlo");
  });

  it("Resumen: filas de KPI con los valores correctos", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const resumen = libro.hojas.find((h) => h.nombre === "Resumen")!;
    const buscar = (etiqueta: string) => resumen.filas.find((f) => f[0] === etiqueta);
    expect(buscar("Cumplimiento %")?.[1]).toBe(82);
    expect(buscar("Evolución vs mes anterior")?.[1]).toBe(5);
    expect(buscar("Rendimiento promedio histórico")?.[1]).toBe(78);
    expect(buscar("Tareas vencidas")?.[1]).toBe(3);
    expect(buscar("Arqueos con diferencias")?.[1]).toBe(2);
    expect(buscar("Monto diferencias")?.[1]).toBe(1500);
  });

  it("Resumen: deltaMesAnterior y promedioHistorico null se muestran como '—'", () => {
    const a: AnalisisMes = { ...base, deltaMesAnterior: null, promedioHistorico: null };
    const libro = armarLibroAnalisis(a, { mesLabel: "julio 2026", segmento: null });
    const resumen = libro.hojas.find((h) => h.nombre === "Resumen")!;
    const buscar = (etiqueta: string) => resumen.filas.find((f) => f[0] === etiqueta);
    expect(buscar("Evolución vs mes anterior")?.[1]).toBe("—");
    expect(buscar("Rendimiento promedio histórico")?.[1]).toBe("—");
  });

  // El aserto viejo era `filas[0] === [header]` y `filas.length === 3`. Cambió de significado:
  // la hoja ahora arranca con el encuadre no punitivo (fila 0) y una fila en blanco, así que el
  // header pasó a la fila 2. Los valores por persona no se tocaron.
  it("Por persona: header y una fila por persona con los valores correctos", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const hoja = libro.hojas.find((h) => h.nombre === "Por persona")!;
    expect(hoja.filas[2]).toEqual(["Nombre", "Cerradas %", "Total", "Vencidas", "Abiertas"]);
    expect(hoja.filas.length).toBe(5); // encuadre + blanco + header + 2 personas
    const anaFila = hoja.filas.find((f) => f[0] === "Ana")!;
    expect(anaFila).toEqual(["Ana", 100, 4, 0, 0]);
    const boFila = hoja.filas.find((f) => f[0] === "Bo")!;
    expect(boFila).toEqual(["Bo", 50, 4, 1, 2]);
  });

  // ============================================================
  // ENCUADRE NO PUNITIVO EN EL EXCEL (hallazgo 3 de la auditoría del 05/08, segunda parte).
  //
  // El PDF del Reporte lleva el encuadre pegado al título de la tabla por persona; el Excel
  // salía pelado. Y un Excel es peor que un PDF para esto: circula solo, se abre sin la pantalla
  // que lo explica, y la columna "Cerradas %" se ordena de mayor a menor con un clic — o sea que
  // cualquiera puede fabricarse el podio que el proyecto decidió no tener.
  // ============================================================
  it("Por persona: la hoja arranca con el MISMO encuadre que el PDF", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const hoja = libro.hojas.find((h) => h.nombre === "Por persona")!;
    expect(String(hoja.filas[0][0])).toContain(ENCUADRE_REPARTO);
  });

  it("Por persona: la hoja pide bloquear el orden; las otras no", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    expect(libro.hojas.find((h) => h.nombre === "Por persona")!.bloquearOrden).toBe(true);
    expect(libro.hojas.find((h) => h.nombre === "Por marca")!.bloquearOrden).toBeFalsy();
    expect(libro.hojas.find((h) => h.nombre === "Resumen")!.bloquearOrden).toBeFalsy();
  });

  it("Por marca: header y filas", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const hoja = libro.hojas.find((h) => h.nombre === "Por marca")!;
    expect(hoja.filas[0]).toEqual(["Marca", "Cumplimiento %", "Total"]);
    expect(hoja.filas).toContainEqual(["Peugeot", 90, 10]);
    expect(hoja.filas).toContainEqual(["Honda", 70, 5]);
  });

  it("Por sucursal: header y filas", () => {
    const libro = armarLibroAnalisis(base, { mesLabel: "julio 2026", segmento: null });
    const hoja = libro.hojas.find((h) => h.nombre === "Por sucursal")!;
    expect(hoja.filas[0]).toEqual(["Sucursal", "Cumplimiento %", "Total"]);
    expect(hoja.filas).toContainEqual(["Merlo", 85, 8]);
  });
});
