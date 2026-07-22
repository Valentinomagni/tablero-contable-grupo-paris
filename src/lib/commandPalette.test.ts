import { describe, it, expect } from "vitest";
import { agruparItemsPalette } from "./commandPalette";

interface Item { g: string; t: string; }

const item = (g: string, t: string): Item => ({ g, t });

describe("agruparItemsPalette", () => {
  it("con 30 personas ordenadas por rol (empleados antes que encargados/jefes), los encargados y jefes aparecen igual", () => {
    const items: Item[] = [
      item("Vistas", "Resumen"), item("Vistas", "Reporte"),
      item("Acciones", "Delegar"),
      // 20 empleados, 5 encargados, 5 jefes — el orden que produce team.forEach() por rol.
      ...Array.from({ length: 20 }, (_, i) => item("Personas", `empleado${i}`)),
      ...Array.from({ length: 5 }, (_, i) => item("Personas", `encargado${i}`)),
      ...Array.from({ length: 5 }, (_, i) => item("Personas", `jefe${i}`)),
    ];
    const out = agruparItemsPalette(items);
    const personas = out.filter((i) => i.g === "Personas").map((i) => i.t);
    expect(personas).toHaveLength(30);
    expect(personas).toEqual(expect.arrayContaining(["encargado0", "encargado4", "jefe0", "jefe4"]));
  });

  it("respeta el cupo en los demás grupos (no crecen con el tamaño del equipo)", () => {
    const items: Item[] = Array.from({ length: 10 }, (_, i) => item("Tareas", `t${i}`));
    const out = agruparItemsPalette(items, 5);
    expect(out).toHaveLength(5);
    expect(out.map((i) => i.t)).toEqual(["t0", "t1", "t2", "t3", "t4"]);
  });

  it("grupos vacíos (que ni aparecen en items) no se muestran", () => {
    const items: Item[] = [item("Vistas", "a")];
    const out = agruparItemsPalette(items);
    expect(out.map((i) => i.g)).toEqual(["Vistas"]);
  });

  it("con una lista ya angosta (como la deja el filtro de búsqueda con texto) el resultado no cambia", () => {
    // Simula lo que ocurre con texto de búsqueda: pocos ítems, muy por debajo del cupo.
    const items: Item[] = [item("Personas", "juan"), item("Tareas", "cobrar")];
    const out = agruparItemsPalette(items);
    expect(out).toEqual(items);
  });

  it("el orden de los grupos se mantiene estable (orden de primera aparición, no alfabético ni por tamaño)", () => {
    const items: Item[] = [
      item("Tablón", "aviso1"),
      item("Vistas", "v1"),
      item("Personas", "p1"),
      item("Tablón", "aviso2"),
      item("Vistas", "v2"),
    ];
    const out = agruparItemsPalette(items);
    const ordenGrupos = [...new Set(out.map((i) => i.g))];
    expect(ordenGrupos).toEqual(["Tablón", "Vistas", "Personas"]);
  });

  it("el cupo por defecto en un grupo capado deja pasar exactamente 5", () => {
    const items: Item[] = Array.from({ length: 8 }, (_, i) => item("Acciones", `a${i}`));
    const out = agruparItemsPalette(items);
    expect(out).toHaveLength(5);
  });
});
