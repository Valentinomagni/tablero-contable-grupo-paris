// Qué recurrencia recibe una tarea al crearla.
//
// EL PROBLEMA. `NuevaTareaModal` no preguntaba nada, y la base asume `reset_policy = 'mensual'`
// cuando el campo viene vacío. Así, una tarea cargada para resolver algo puntual quedaba en el
// tablero para siempre, y nadie podía distinguir "falta hacerla" de "nadie la borró". Basura
// acumulándose, que es exactamente lo contrario de Seiri.
//
// EL DEFAULT ES "UNA VEZ", y es la decisión importante de este archivo. Lo reversible va
// primero: marcar después que una tarea se repite cuesta un click; darse cuenta seis meses
// más tarde de que veinte tareas puntuales vienen reapareciendo cuesta una limpieza entera.

export type TipoAlta = "una-vez" | "cada-mes";

/** El default seguro. Ver el comentario de arriba: no es una preferencia, es reversibilidad. */
export const TIPO_ALTA_POR_DEFECTO: TipoAlta = "una-vez";

/**
 * Los campos que van al insert. `manual` y no `mensual` para la tarea de una sola vez: es lo
 * que hace que el reinicio mensual la ignore (ver `reset_recurrentes_seguro`, migración 24).
 */
export function camposDeAlta(tipo: TipoAlta): { recurring: boolean; reset_policy: "mensual" | "manual" } {
  return tipo === "cada-mes"
    ? { recurring: true, reset_policy: "mensual" }
    : { recurring: false, reset_policy: "manual" };
}
