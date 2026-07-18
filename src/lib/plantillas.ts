import type { PlantillaTareas } from "./types";

// Plantillas reutilizables por categoría (propuesta P6).
// El jefe define una plantilla (nombre + categoría + ítems) y con un click
// genera un lote de tareas en el tablero. Cada ítem puede traer su propio
// responsable/esfuerzo/prioridad; si no, se usan los valores por defecto.

// Filas listas para insertar en la tabla `cards`. Igual que filasParaInsertar
// (plantilla de cierre): sólo se envían los campos con valor propio, el resto
// lo completan los defaults de la base.
export function filasDePlantilla(pl: PlantillaTareas, meName: string, at: string, ownerPorDefecto: string) {
  return pl.items.map((item) => ({
    owner: item.owner ?? ownerPorDefecto,
    title: item.titulo.trim(),
    status: "pend" as const,
    categoria: pl.categoria,
    effort: item.effort ?? 1,
    priority: item.priority ?? "media",
    card_type: "normal" as const,
    history: [{ who: meName, at, txt: "Generada desde plantilla " + pl.nombre }],
  }));
}
