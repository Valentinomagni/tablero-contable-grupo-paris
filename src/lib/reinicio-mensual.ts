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
