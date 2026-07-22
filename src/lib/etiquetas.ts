import type { Card } from "./types";

// Etiquetas contextuales de una tarea (spec 28, fase D, Task 5): distintas de `categoria`
// (que es el TIPO de trabajo, una sola por tarea). Una etiqueta identifica el CONTEXTO
// —una empresa, una marca puntual, un cliente— y una tarea puede tener varias.

/**
 * Normaliza una etiqueta para guardarla: trimea los extremos y colapsa espacios internos
 * múltiples a uno solo. NO toca mayúsculas/minúsculas: son nombres propios ("Autocity",
 * "Peugeot") y cambiarlas sería alterar el dato que el usuario tipeó. La comparación de
 * duplicados (acá y en el resto de este módulo) es case-insensitive aparte, no vía esto.
 */
export function normalizarEtiqueta(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Etiquetas realmente en uso en un conjunto de cards: únicas (sin duplicar por mayúsculas:
 * "Peugeot" y "peugeot" cuentan como la misma), orden alfabético es-AR. Se conserva la
 * primera capitalización vista para cada clave case-insensitive.
 */
export function etiquetasEnUso(cards: Pick<Card, "etiquetas">[]): string[] {
  const porClave = new Map<string, string>(); // clave lowercase -> primera forma vista
  for (const c of cards) {
    for (const e of c.etiquetas ?? []) {
      const clave = e.toLowerCase();
      if (!porClave.has(clave)) porClave.set(clave, e);
    }
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Filtro de tablero: la card debe tener TODAS las etiquetas del filtro (AND), comparación
 * case-insensitive. Filtro vacío ([]) deja pasar todo (equivalente a "sin filtro").
 */
export function pasaFiltroEtiquetas(c: Pick<Card, "etiquetas">, filtro: string[]): boolean {
  if (filtro.length === 0) return true;
  const propias = new Set((c.etiquetas ?? []).map((e) => e.toLowerCase()));
  return filtro.every((f) => propias.has(f.toLowerCase()));
}

/**
 * Agrega una etiqueta nueva a la lista de una card: normaliza, ignora vacías y no duplica
 * (comparación case-insensitive contra lo que ya está). No muta `actuales`.
 */
export function agregarEtiqueta(actuales: string[], nueva: string): string[] {
  const norm = normalizarEtiqueta(nueva);
  if (!norm) return [...actuales];
  const yaEsta = actuales.some((e) => e.toLowerCase() === norm.toLowerCase());
  return yaEsta ? [...actuales] : [...actuales, norm];
}
