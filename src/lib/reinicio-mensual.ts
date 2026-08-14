import type { Card } from "./types";
import { toARTDate } from "./metrics";

// ============================================================
// ¿Corrió el reinicio mensual?
//
// El 04/08/2026 arrancó agosto y el equipo seguía viendo sus tareas de julio en "Terminado".
// El reinicio lo hace un cron de Supabase y había fallado EN SILENCIO: nadie se enteró hasta
// que alguien miró la pantalla y no entendió nada.
//
// El problema de fondo no es que el cron falle. Es que falla sin que nadie se entere: un cron
// que falla callado es peor que no tener cron, porque genera confianza en algo que no está
// pasando. Esta lib es lo que hace visible esa falla.
//
// La migración 37 agrega `reinicios_mensuales`: una fila por mes cerrado, la escriban el cron
// o el reinicio manual. Si falta la fila del mes pasado, es que el mes pasado no se cerró.
// ============================================================

export interface Reinicio {
  mes: string;              // 'YYYY-MM' del mes que se cerró
  corrido_at: string;
  origen: string;           // 'cron' | 'manual'
  archivadas: number | null;
  reseteadas: number | null;
}

/**
 * El mes anterior al de `hoyISO`, en formato 'YYYY-MM'.
 *
 * El día se deriva con `toARTDate` y no con la zona del navegador: el 1 de agosto a la 01:00
 * UTC en Argentina todavía es 31 de julio, y un navegador en UTC diría que el mes anterior es
 * julio cuando en realidad el equipo sigue trabajando junio. Ya hubo bugs por esto.
 */
export function mesAnterior(hoyISO: string): string {
  const dia = toARTDate(hoyISO);            // 'YYYY-MM-DD' en hora argentina
  const y = Number(dia.slice(0, 4));
  const m = Number(dia.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * ¿Falta el reinicio del mes pasado? `null` si está todo bien; si no, el mes que falta.
 *
 * DEFENSIVO a propósito: esto se dibuja arriba del tablero de todos. Si `reinicios` no es un
 * arreglo (la tabla no existe, la query falló, PostgREST devolvió otra cosa) o trae elementos
 * nulos, se tratan como lista vacía / se saltean. Un aviso de más nunca puede costar una
 * pantalla en blanco.
 *
 * CONTRAINTUITIVO Y DELIBERADO: la tabla arranca VACÍA. Los reinicios viejos no dejaron rastro
 * y completarlos ahora sería inventar historia — mejor que la tabla diga "no sé" a que mienta.
 * Consecuencia: el primer mes va a avisar aunque el reinicio quizá sí haya corrido. Es el lado
 * correcto para equivocarse. Un aviso de más se cierra en dos segundos; un reinicio que no
 * ocurrió y que nadie ve cuesta media mañana de gente confundida mirando datos del mes pasado.
 */
export function reinicioPendiente(reinicios: Reinicio[], hoyISO: string): string | null {
  const mes = mesAnterior(hoyISO);
  const filas = Array.isArray(reinicios) ? reinicios : [];
  const corrio = filas.some((r) => r != null && typeof r === "object" && (r as Reinicio).mes === mes);
  return corrio ? null : mes;
}

// ============================================================
// ¿QUÉ tarjetas reinicia la base, y quedó alguna sin reiniciar?
//
// Lo de arriba responde "¿corrió el proceso?" leyendo `reinicios_mensuales`. Esto responde algo
// distinto y complementario: "¿el resultado es el esperado?", mirando las tarjetas mismas.
//
// HACE FALTA PORQUE EL SEMÁFORO DEL CIERRE DABA VERDE JUSTO EN EL CASO DEL INCIDENTE DEL 04/08
// (hallazgo 2 de la auditoría del 05/08). Veinte recurrentes seguían en "Terminado" de julio y
// la única pantalla diseñada para detectarlo mostraba el paso en verde, con el texto "Las
// tareas recurrentes arrancaron el mes en cero".
//
// Un semáforo que sólo sabe decir que sí es peor que no tener semáforo: no se limita a fallar,
// da permiso para no mirar.
//
// LAS DOS RAZONES POR LAS QUE MENTÍA, las dos en seis líneas de `Cierre.tsx`:
//
//   1. Filtraba por `recur_rule != null`, pero el reinicio de la base usa
//      `(recurring = true OR recur_rule is not null)`. Una tarea creada desde el modal con "se
//      repite cada mes" queda con `recurring: true` y SIN `recur_rule`: el chequeo no la veía.
//      Son, justamente, las que carga el equipo a mano.
//
//   2. Comparaba `done_at.slice(0, 7)`, que es el mes UTC. Una tarea cerrada el 31/07 a las
//      21:30 hora argentina tiene `done_at` del 1 de agosto y se leía como de agosto.
//
// El predicado estaba escrito dos veces —una en SQL y otra en TypeScript— y eso permitió que
// divergieran sin que nadie se enterara. Que viva acá no garantiza que siga igual al de la
// base, pero deja un solo lugar donde mirar cuando haya que compararlos.
// ============================================================

/**
 * ¿La base reinicia esta tarjeta cuando arranca el mes?
 *
 * Réplica del `where` de `reset_recurrentes_seguro` (migración 24, repetido en la 29):
 *
 *     (c.recurring = true or c.recur_rule is not null)
 *       and coalesce(c.reset_policy, 'mensual') = 'mensual'
 */
export function seReiniciaCadaMes(c: Pick<Card, "recurring" | "recur_rule" | "reset_policy">): boolean {
  if (!c) return false;
  const esRecurrente = c.recurring === true || c.recur_rule != null;
  if (!esRecurrente) return false;
  return (c.reset_policy ?? "mensual") === "mensual";
}

/**
 * ¿Quedó alguna recurrente terminada en el mes anterior? `true` significa que el reinicio NO
 * pasó y que el semáforo tiene que estar en rojo.
 *
 * `mesPrevio` viene en formato 'YYYY-MM'. La fecha se compara con `toARTDate` y no con
 * `slice(0, 7)` sobre el ISO crudo, por la razón 2 de arriba.
 */
export function quedanRecurrentesSinReiniciar(cards: Card[], mesPrevio: string): boolean {
  if (!Array.isArray(cards) || !mesPrevio) return false;
  return cards.some(
    (c) => c && seReiniciaCadaMes(c) && c.status === "term" && !!c.done_at &&
      toARTDate(c.done_at).slice(0, 7) === mesPrevio,
  );
}

// ============================================================
// "ESE MES YA SE CERRÓ": LA RESPUESTA QUE PROTEGE EL ARCHIVO
//
// HALLAZGO 1 DE LA AUDITORÍA DEL 05/08, Y ERA IRREVERSIBLE. Volver a apretar "Reiniciar mes"
// DESTRUÍA el archivo del mes. `reset_mes_manual` borraba la foto de `cards_archive` y la
// rehacía desde `cards`… que el paso siguiente de esa misma función ya había puesto todo en
// pendiente. O sea: la primera corrida guardaba la foto buena, y la segunda la reemplazaba por
// la foto ya reiniciada. El mes quedaba archivado con TODO sin hacer — 0% de cumplimiento para
// siempre, en el historial, en el promedio, en la comparativa entre meses y en el bus factor.
// No hay forma de recuperarlo: `cards` ya no tiene los `done_at` que se borraron.
//
// Y era un escenario probable, no rebuscado: esta tabla arranca vacía a propósito (ver arriba),
// así que el aviso "el mes pasado no se reinició" aparece igual aunque el cron haya archivado
// bien. Quien lo ve aprieta el botón, que es exactamente lo que el cartel le sugiere hacer.
//
// LA MIGRACIÓN 50 le pone una guarda a la función: si ya hay fila en `reinicios_mensuales` para
// ese mes, no toca NADA y contesta con la marca de abajo. Esto es el lado del front: reconocer
// esa respuesta y decirle a la persona qué pasó, en castellano.
// ============================================================

/**
 * Prefijo con el que `reset_mes_manual` (migración 50) avisa "ese mes ya estaba cerrado".
 *
 * POR QUÉ UNA MARCA Y NO EL TEXTO. La función no lanza una excepción a propósito: la misma
 * guarda la usa el cron, y un cron que aborta con error para decir "no había nada que hacer"
 * ensucia el registro y termina ignorándose. Como entonces la respuesta viaja por el camino del
 * éxito, hace falta algo que el front pueda MIRAR sin leer prosa. Es un código, no un mensaje:
 * lo que ve la persona lo escribe `textoYaCerrado`.
 */
export const MARCA_YA_CERRADO = "ya_cerrado:";

/**
 * ¿La base contestó que ese mes ya estaba cerrado y no hizo nada?
 *
 * DEFENSIVA A PROPÓSITO: si la base todavía no tiene la migración 50 contesta el texto viejo, y
 * ahí esto da `false` y el botón se comporta igual que antes. Nada de lo que llegue por acá
 * puede tirar la pantalla abajo.
 */
export function yaEstabaCerrado(respuesta: unknown): boolean {
  return typeof respuesta === "string" && respuesta.startsWith(MARCA_YA_CERRADO);
}

/**
 * Lo que se le muestra a la persona cuando el mes ya estaba cerrado.
 *
 * ENCUADRE. No hizo nada mal: apretó el botón que el cartel le ofrecía. El texto describe el
 * estado del sistema y —esto es lo importante— dice que el archivo quedó intacto, que es
 * justamente la pregunta que uno se hace cuando un botón contesta "no hice nada".
 *
 * `etiqueta` viene de `periodoLabel`: "Julio 2026". Se pasa a minúscula porque entra en el medio
 * de una oración.
 */
export function textoYaCerrado(etiqueta: string): string {
  return `El cierre de ${String(etiqueta ?? "").toLowerCase()} ya estaba hecho, así que no se ` +
    `tocó nada. El archivo de ese mes queda como estaba.`;
}
