// Qué pantallas tienen que esperar a que carguen las tareas antes de dibujarse.
//
// EL PROBLEMA QUE RESUELVE (hallazgo 7 de la auditoría del 05/08). La guarda de carga estaba en
// el anteúltimo lugar de la cadena de `App.tsx`: sólo el tablero esperaba. Todas las vistas que
// se evalúan antes —Resumen, Reporte, Director, Cierre, Mi día— se renderizaban con la lista
// vacía mientras la consulta seguía en vuelo.
//
// LO QUE SE VE con una conexión lenta: "Salud del equipo 0%", "Avance 0%", "Vencidas 0", "Nada
// trabado", "Nada urgente para hoy".
//
// Eso no es un vacío mudo, y ahí está el daño: es un tablero que **afirma con seguridad que no
// pasa nada**. Alguien que lo mira dos segundos y cierra la pestaña se va con la idea de que
// está todo al día. Un esqueleto no miente; un cero, sí.
//
// POR QUÉ ES UNA LISTA Y NO UN "ESPERAR SIEMPRE": el Tablón y las Anotaciones no leen tareas, y
// hacerles mostrar un esqueleto los volvería más lentos a cambio de nada. La decisión vive acá,
// en una función con tests, y no repartida en catorce ramas de un ternario encadenado donde ya
// se demostró que nadie la revisa.

/** Vistas del menú lateral que NO leen la lista de tareas. */
const VISTAS_SIN_TAREAS = new Set(["__tablon", "__notas"]);

/**
 * Modos del tablero de una persona que NO leen la lista de tareas.
 *
 * `obj` trae sus objetivos por su cuenta, y `hist` lee `cards_archive` con su propia consulta y
 * su propio esqueleto: hacerlos esperar a `cards` sería esperar por algo que no van a usar.
 */
const MODOS_SIN_TAREAS = new Set(["obj", "hist"]);

/**
 * ¿Esta pantalla tiene que mostrar un esqueleto en vez de números?
 *
 * `board` queda AFUERA a propósito: ya tiene su propia guarda con `BoardSkeleton`, que imita las
 * columnas y es mejor que el esqueleto genérico. Devolver `true` acá se lo comería.
 */
export function esperaTareas(view: string, mode: string, cargando: boolean): boolean {
  if (!cargando) return false;
  if (typeof view === "string" && VISTAS_SIN_TAREAS.has(view)) return false;
  // Las vistas del menú (las que empiezan con "__") ignoran el modo: el modo sólo manda cuando
  // se está mirando el tablero de una persona.
  if (typeof view === "string" && view.startsWith("__")) return true;
  if (mode === "board") return false;
  return !MODOS_SIN_TAREAS.has(mode);
}
