export function nuevaCantidad(actual: number, delta: number): number {
  return Math.max(0, actual + delta);
}

/**
 * Meta de carga (spec 28, Fase C, Task 3): un administrativo carga lotes de
 * comprobantes (remitos, facturas...) y necesita saber si le faltan — "23 de 30" en
 * vez de un contador ciego. `pct` es null sin meta cargada; nunca se divide por cero
 * (meta <= 0 se trata como "sin meta"); si `actual` supera la `meta` el pct topea en
 * 100 pero el texto muestra el número real.
 */
export function progresoCarga(actual: number, meta: number | null): { pct: number | null; texto: string } {
  if (meta === null || meta <= 0) return { pct: null, texto: String(actual) };
  const pct = Math.min(100, Math.round((actual / meta) * 100));
  return { pct, texto: `${actual} de ${meta}` };
}

// --- Persistencia de la meta (sin columna nueva en `cards`) ---
//
// DECISIÓN: hay 4 migraciones de esquema sin aplicar todavía (spec 28); sumar una
// quinta solo para guardar un número entero por card no se justifica. Se descartaron:
//   - `settings` (AppSettings): es global al tablero, no por card — no sirve.
//   - `dato_control` (migración 29, todavía sin aplicar en producción): ya tiene un
//     significado propio ("dato de control libre") mostrado en su propia UI; abusarlo
//     para la meta sería confuso y además requeriría la migración 29 aplicada.
// Se guarda la meta como una marca estructurada al final de `description` (columna que
// siempre existe): "[[meta:30]]". `descripcionSinMeta` la oculta en el textarea de
// Detalle para que el usuario no la vea ni la edite por accidente.
const RE_META = /\n*\[\[meta:(-?\d*)\]\]\s*$/;

/** Meta cargada en la descripción, o null si no hay marca o no es un número válido. */
export function extraerMetaCarga(description: string): number | null {
  const m = RE_META.exec(description ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return m[1] !== "" && Number.isFinite(n) ? n : null;
}

/** Descripción sin la marca de meta, para mostrar en el textarea de Detalle. */
export function descripcionSinMeta(description: string): string {
  return (description ?? "").replace(RE_META, "");
}

/**
 * Devuelve la descripción con la meta fijada (reemplaza cualquier marca previa) o,
 * si `meta` es null, la descripción sin marca (borra la meta).
 */
export function conMetaCarga(description: string, meta: number | null): string {
  const base = descripcionSinMeta(description);
  if (meta === null) return base;
  return `${base}\n\n[[meta:${meta}]]`;
}
