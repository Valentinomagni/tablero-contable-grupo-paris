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
// siempre existe). `descripcionSinMeta` la oculta en el textarea de Detalle para que
// el usuario no la vea ni la edite por accidente.
//
// DELIMITADOR: prefijo con Unit Separator (U+001F, ASCII 31) para evitar colisión
// accidental con texto legítimo que un usuario pueda escribir. Ej.: "ver anexo [[meta:2024]]"
// ya no se interpretará como meta porque le falta el prefijo no imprimible. Al LEER se
// detectan ambos formatos (viejo y nuevo) para compatibilidad, pero al ESCRIBIR solo
// se usa el formato nuevo. Formato: "\x1f[[meta:N]]"
const RE_META_OLD = /\n*\[\[meta:(-?\d*)\]\]\s*$/; // Formato antiguo (compatibilidad hacia atrás)
const RE_META_NEW = /\n*\x1f\[\[meta:(-?\d*)\]\]\s*$/; // Formato nuevo (no colisionable)

/** Meta cargada en la descripción, o null si no hay marca o no es un número válido.
 * Detecta ambos formatos (viejo y nuevo) para compatibilidad hacia atrás. */
export function extraerMetaCarga(description: string): number | null {
  const text = description ?? "";
  // Intenta formato nuevo primero (con prefijo no imprimible)
  let m = RE_META_NEW.exec(text);
  // Si no encuentra, intenta formato viejo (compatibilidad)
  if (!m) m = RE_META_OLD.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return m[1] !== "" && Number.isFinite(n) ? n : null;
}

/** Descripción sin la marca de meta, para mostrar en el textarea de Detalle.
 * Remueve SOLO el formato nuevo (con prefijo no imprimible). El formato viejo
 * no se remueve porque es ambiguo: no sabemos si es meta vieja guardada o texto
 * legítimo que el usuario escribió casualmente.
 *
 * La migración de meta vieja a nueva ocurre en conMetaCarga: cuando el usuario
 * edita en el textarea (donde ya no hay meta gracias a esta función) y guarda,
 * conMetaCarga reemplaza la meta vieja por la nueva si coincide. */
export function descripcionSinMeta(description: string): string {
  return (description ?? "").replace(RE_META_NEW, "");
}

/**
 * Devuelve la descripción con la meta fijada (reemplaza cualquier marca previa) o,
 * si `meta` es null, la descripción sin marca (borra la meta). Siempre escribe
 * en el formato nuevo (con prefijo no imprimible) para evitar colisión accidental.
 *
 * Compatibilidad hacia atrás:
 * - Siempre remueve formato nuevo (con prefijo)
 * - Remueve formato viejo SI coincide con la meta actual (para no duplicar en migración)
 * - Si meta es null, también remueve formato viejo (borrando la meta)
 * - Si meta no coincide con el formato viejo, lo preserva (texto legítimo del usuario)
 */
export function conMetaCarga(description: string, meta: number | null): string {
  let base = (description ?? "");
  // Remover formato nuevo (con prefijo no imprimible)
  base = base.replace(RE_META_NEW, "");
  // Remover formato viejo SOLO si coincide con la meta actual o si meta es null
  if (meta !== null) {
    // Remover SOLO si el formato viejo tiene el MISMO número (evita remover texto legítimo)
    const exactOldMetaPattern = new RegExp(`\\n*\\[\\[meta:${meta}\\]\\]\\s*$`);
    base = base.replace(exactOldMetaPattern, "");
  } else {
    // Si meta es null (borrar meta), remover cualquier formato viejo
    base = base.replace(RE_META_OLD, "");
  }
  if (meta === null) return base;
  return `${base}\n\n\x1f[[meta:${meta}]]`;
}
