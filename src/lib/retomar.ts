import type { Card } from "./types";

// "Retomar donde quedaste" — P3 de docs/PROPUESTAS-ADOPCION.md.
//
// PROBLEMA QUE ATACA: el arranque frío. La persona entra, ve una lista larga, no sabe por
// dónde empezar y termina trabajando desde su cuaderno en vez de desde el sistema.
//
// LA REGLA MÁS IMPORTANTE ES LO QUE **NO** HACE. Es una sola línea servicial —"ayer estabas
// con esto"— y desaparece sola cuando no aplica. El documento lo dice sin vueltas: si esa
// línea empieza a decir "hace 3 días que no entrás" o "tenés 7 vencidas", pasa a ser un
// reproche apenas se abre la app, que es el peor momento posible para dar una mala noticia.
// Por eso: sin números, sin resumen, sin saludo, y silencio total cuando no hay nada claro.
//
// PURA: la fecha entra por parámetro; sin `new Date()` adentro.

/** Desde cuándo deja de tener sentido decir "donde quedaste" (días). */
const MAX_DIAS = 7;
/** Antes de esto no hay nada que retomar: se estuvo trabajando recién. */
const MIN_HORAS = 4;

const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;

/** Última marca de trabajo propia sobre la card, o null si no hay historial. */
function ultimaSenal(c: Card): number | null {
  let ultima: string | null = null;
  for (const h of c.history ?? []) {
    if (!h?.at) continue;
    if (ultima === null || h.at > ultima) ultima = h.at;
  }
  return ultima === null ? null : new Date(ultima).getTime();
}

/**
 * La tarea que conviene ofrecer para retomar, o `null` si no hay ninguna clara.
 * Devolver `null` es el caso normal y deseable: la línea no se muestra.
 */
export function tareaParaRetomar(cards: Card[], ownerId: string, hoyISO: string): Card | null {
  if (!Array.isArray(cards) || !ownerId) return null;
  const ahora = new Date(hoyISO).getTime();
  if (!isFinite(ahora)) return null;

  let mejor: Card | null = null;
  let mejorAt = -Infinity;

  for (const c of cards) {
    if (!c || c.owner !== ownerId) continue;
    if (c.status === "term") continue;          // ya está hecha: no hay qué retomar
    if (c.card_type === "operativa") continue;  // a demanda por diseño, no se "retoma"

    const at = ultimaSenal(c);
    if (at === null) continue;                  // sin señal de trabajo, no es "donde quedaste"

    const transcurrido = ahora - at;
    // Muy reciente: se está trabajando ahora, la línea sobraría.
    if (transcurrido < MIN_HORAS * HORA_MS) continue;
    // Muy viejo: dejó de ser "donde quedaste" y recordarlo se leería como un reclamo.
    if (transcurrido > MAX_DIAS * DIA_MS) continue;

    if (at > mejorAt) { mejorAt = at; mejor = c; }
  }

  return mejor;
}
