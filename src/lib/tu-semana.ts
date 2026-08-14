import type { Card } from "./types";
import { toARTDate, entregadaATiempo } from "./metrics";

// "Tu semana" — P4 de docs/PROPUESTAS-ADOPCION.md.
//
// PROBLEMA QUE ATACA: el trabajo contable es invisible. Se terminan veinte cosas y el
// viernes no queda registro de ninguna. Sin devolución, actualizar el sistema es puro costo
// para quien lo actualiza.
//
// LA REGLA DURA, TEXTUAL DEL DOCUMENTO: **"si la semana estuvo mal, la tarjeta se calla,
// no reta"**. Esto NO es un tablero personal de rendimiento. Por eso:
//   - Sólo lo positivo. Nunca se cuenta lo vencido, lo que quedó abierto ni lo tarde.
//   - Sin comparación con nadie: no entra el equipo, no entra un promedio, no entra un puesto.
//   - Es un espejo privado. Si alguna vez existe una versión que el jefe pueda ver por
//     persona, deja de ser un espejo y pasa a ser evaluación semanal automática — y la
//     reacción previsible es cerrar tareas de mentira los viernes a la tarde.
//   - Si no hay nada bueno que mostrar, devuelve `null` y no se muestra nada. El silencio
//     es una respuesta válida y deseable, no un caso borde.
//
// PURA: la fecha entra por parámetro; sin `new Date()` de "ahora" adentro.
//
// `hoyISO` es la hora de pared ARGENTINA sin zona (ej. "2026-07-24T17:00:00"). Importa que
// sea sin zona: el día de la semana y la hora se leen tal cual, sin depender de dónde esté
// el navegador. El helper para calcularla vive en el llamador (ver `MiDia.tsx`).

/** Títulos que se listan como máximo. Más que esto deja de leerse y pasa a ser un informe. */
export const MAX_TITULOS = 8;
/** Desde qué hora del viernes tiene sentido cerrar la semana. */
const HORA_VIERNES = 15;

export interface ResumenSemana {
  /** Lunes de la semana, ISO (YYYY-MM-DD). */
  desde: string;
  /** Domingo de la semana, ISO (YYYY-MM-DD). */
  hasta: string;
  /** Títulos de lo terminado, del más reciente al más viejo. Recortado a MAX_TITULOS. */
  titulos: string[];
  /** Cuántas terminó en total (puede ser mayor que `titulos.length`). */
  total: number;
  /** Cuántas de esas cerró dentro de la fecha. Nunca se informa la contracara. */
  enFecha: number;
  /** Semanas seguidas (incluida esta) sin cerrar nada tarde. 0 = no se muestra racha. */
  racha: number;
}

const DIA_MS = 86400000;

function aFecha(iso: string): Date | null {
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d : null;
}

/** YYYY-MM-DD de una fecha, en hora local. */
function isoDia(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Lunes 00:00 de la semana que contiene a `d` (la semana laboral arranca el lunes). */
function lunesDe(d: Date): Date {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = l.getDay(); // 0 = domingo
  const retroceso = dow === 0 ? 6 : dow - 1;
  l.setDate(l.getDate() - retroceso);
  return l;
}

/**
 * ¿Es momento de mostrar el resumen? Viernes a la tarde y el fin de semana.
 * El resto de los días la semana todavía está pasando y el resumen no significa nada.
 */
export function esMomentoDeResumen(hoyISO: string): boolean {
  const d = aFecha(hoyISO);
  if (!d) return false;
  const dow = d.getDay();
  if (dow === 6 || dow === 0) return true;      // sábado y domingo
  if (dow === 5) return d.getHours() >= HORA_VIERNES; // viernes a la tarde
  return false;
}

// Esta función vivía acá y era la ÚNICA de las cinco copias que estaba bien: usaba el día
// calendario argentino en vez de la medianoche del navegador. Se mudó a `metrics.ts` como
// `entregadaATiempo` para que las otras cuatro pudieran usarla en vez de repetirla mal
// (hallazgo 8 de la auditoría del 05/08).

/** Cards propias, no operativas, terminadas dentro del rango [desde, hasta] de días ISO. */
function terminadasEntre(cards: Card[], ownerId: string, desde: string, hasta: string): Card[] {
  const out: Card[] = [];
  for (const c of cards) {
    if (!c || c.owner !== ownerId) continue;
    if (c.status !== "term" || !c.done_at) continue;
    // Las operativas son a demanda y de volumen alto: inflarían la lista y taparían el resto.
    if (c.card_type === "operativa") continue;
    const dia = toARTDate(c.done_at);
    if (dia < desde || dia > hasta) continue;
    out.push(c);
  }
  return out;
}

/**
 * Semanas seguidas, hacia atrás desde la actual, en las que todo lo terminado se cerró en
 * fecha. Una semana SIN actividad no rompe la racha pero tampoco la alarga: nadie tuvo una
 * buena semana por no haber trabajado, y romper la racha por estar de vacaciones sería un
 * reproche encubierto.
 */
function calcularRacha(cards: Card[], ownerId: string, lunes: Date): number {
  let racha = 0;
  for (let i = 0; i < 12; i++) {
    const ini = new Date(lunes.getTime() - i * 7 * DIA_MS);
    const fin = new Date(ini.getTime() + 6 * DIA_MS);
    const hechas = terminadasEntre(cards, ownerId, isoDia(ini), isoDia(fin));
    if (hechas.length === 0) continue; // semana vacía: ni suma ni corta
    if (hechas.every(entregadaATiempo)) racha++;
    else break;
  }
  return racha;
}

/**
 * El resumen de la semana de una persona, o `null` cuando no corresponde mostrarlo.
 * Devolver `null` es el caso normal de lunes a jueves y también el de una semana sin nada
 * terminado: ahí callarse es exactamente lo correcto.
 */
export function resumenDeSemana(cards: Card[], ownerId: string, hoyISO: string): ResumenSemana | null {
  if (!Array.isArray(cards) || !ownerId) return null;
  const hoy = aFecha(hoyISO);
  if (!hoy) return null;
  if (!esMomentoDeResumen(hoyISO)) return null;

  const lunes = lunesDe(hoy);
  const domingo = new Date(lunes.getTime() + 6 * DIA_MS);
  const desde = isoDia(lunes);
  const hasta = isoDia(domingo);

  const hechas = terminadasEntre(cards, ownerId, desde, hasta);
  // Semana sin nada terminado: silencio. No hay versión "floja" de esta tarjeta.
  if (hechas.length === 0) return null;

  hechas.sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  return {
    desde,
    hasta,
    titulos: hechas.slice(0, MAX_TITULOS).map((c) => c.title),
    total: hechas.length,
    enFecha: hechas.filter(entregadaATiempo).length,
    // Una sola semana buena no es una racha; recién desde la segunda vale contarlo.
    racha: (() => { const r = calcularRacha(cards, ownerId, lunes); return r >= 2 ? r : 0; })(),
  };
}
