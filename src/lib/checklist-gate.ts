import type { Card, ChecklistItem } from "./types";

// ¿Se puede cerrar esta tarea con el checklist a medias?
//
// POR QUÉ ES POR TAREA Y NO UNA REGLA GLOBAL. La opción simple era: cualquier tarea con ítems
// sin tildar no se cierra. Se descartó por un motivo concreto y no por gusto — mucha gente usa
// el checklist como notas sueltas ("preguntar a Ana", "revisar el mail de ayer"), y bloquear
// siempre haría que borren los ítems para poder cerrar. O sea: se perdería exactamente el dato
// que el checklist venía a guardar, y encima nadie se enteraría de que se perdió.
//
// Con el campo por tarea, la persona que crea una conciliación de IVA decide que ahí los pasos
// son obligatorios, y la que anota recordatorios en una tarea suelta no queda trabada.
//
// Y sigue el patrón que el proyecto ya tiene: `requiere_resultado` hace lo mismo para los
// arqueos —marca una tarea como "acá no se cierra de cualquier manera"— y ya está probado que
// funciona. Inventar un segundo mecanismo para el mismo problema sería duplicación.
//
// PURO: sin fechas, sin acceso a red. Todo entra por parámetro.

/** El checklist tal como llega de la base, tolerando que venga cualquier cosa. */
function items(c: Card): ChecklistItem[] {
  // `checklist` es una columna jsonb: puede llegar `null`, un objeto, o una cadena. Ante la
  // duda se devuelve vacío, porque el costo de equivocarse para el otro lado —dejar una tarea
  // trabada por un dato mal formado— es mucho más caro que no bloquear.
  return Array.isArray(c?.checklist) ? c.checklist : [];
}

/** Cuántos ítems están tildados sobre el total. Sirve para mostrar "3/5" en la tarjeta. */
export function progresoChecklist(c: Card): { hechos: number; total: number } {
  const lista = items(c);
  return { hechos: lista.filter((i) => i?.done === true).length, total: lista.length };
}

/**
 * ¿Esta tarea NO se puede cerrar todavía por tener el checklist incompleto?
 *
 * Devuelve `false` —o sea, no bloquea— en todos los casos dudosos:
 *   - la tarea no lo exige
 *   - ya está terminada (si no, el tablero avisaría sobre tareas cerradas del mes pasado)
 *   - no tiene ningún ítem (no hay nada que completar; bloquear ahí sería un callejón sin salida)
 */
export function checklistIncompleto(c: Card): boolean {
  if (!c || c.exige_checklist !== true || c.status === "term") return false;
  const { hechos, total } = progresoChecklist(c);
  return total > 0 && hechos < total;
}

/**
 * El texto que ve la persona, o `null` si puede cerrar.
 *
 * Dice CUÁNTOS faltan y no sólo "no se puede cerrar", porque el mensaje genérico obliga a abrir
 * la tarea para averiguar por qué. Mismo criterio que `mensajeUsuario` en `fallas.ts`: un aviso
 * que no dice qué hacer es medio aviso.
 */
export function motivoChecklist(c: Card): string | null {
  if (!checklistIncompleto(c)) return null;
  const { hechos, total } = progresoChecklist(c);
  const faltan = total - hechos;
  return faltan === 1 ? "Falta 1 paso del checklist." : `Faltan ${faltan} pasos del checklist.`;
}
