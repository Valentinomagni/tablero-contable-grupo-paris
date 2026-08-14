import type { Card, CardPeriodo } from "./types";
import { toARTDate } from "./metrics";
import { mesLegible } from "./periodos";

// Helpers PUROS de LECTURA para el modelo de períodos (propuesta de períodos, Fase 0 —
// ver docs/PROPUESTA-PERIODOS.md). No hacen fetch: la Fase 1 los va a consumir con los
// datos que ya trae la app (cards + card_periodos).
//
// Idea central (Alternativa C): `cards` es la DEFINICIÓN estable de la tarea (título,
// dueño, recurrencia, prioridad, esfuerzo, deps, categoría, etiquetas). El ESTADO de
// trabajo de cada mes (status/checklist/comments/history/tiempos) vive en su propia
// fila `card_periodos`. Estos helpers arman la "vista" de una card en un período
// combinando ambas cosas.
//
// DEFENSIVO: sin la migración 32 aplicada, `card_periodos` llega [] y todo cae al
// fallback (la card tal cual). Nunca lanza. La app funciona como hoy.

/** 'YYYY-MM' del mes de hoy en zona Argentina (ART). */
export function periodoVigente(hoyISO: string): string {
  return toARTDate(hoyISO).slice(0, 7);
}

/**
 * Adónde hay que mover la selección de período cuando el mes vigente cambió, o `null` si no hay
 * que moverla.
 *
 * QUÉ ARREGLA (hallazgo 5 de la auditoría del 05/08). La selección se fijaba una sola vez, al
 * montar la app, y el vigente se recalcula en cada render: nada los volvía a sincronizar.
 *
 * El escenario es de todos los meses. Alguien deja la app abierta el 31/08 y vuelve el 01/09. El
 * vigente pasa a septiembre y la selección se queda en agosto. Como el mes vigente lee y escribe
 * en `cards` y los no vigentes leen de `card_periodos`, agosto —que hasta ayer era el vigente y
 * por eso no tiene filas de período— aparece **entero en pendiente, sin checklist y sin
 * historial**. La persona cree que perdió el mes.
 *
 * Y lo que sigue es peor que el susto: si vuelve a marcar las tareas, esas ediciones se escriben
 * ahora en el período de agosto en vez de en las tarjetas. Quedan dos verdades distintas para el
 * mismo mes, y ninguna pantalla avisa cuál es la buena.
 *
 * POR QUÉ NO ALCANZA CON "SIEMPRE AL VIGENTE". Mirar un mes cerrado es una decisión deliberada:
 * el 1/9 alguien puede estar revisando junio a propósito. Arrastrarlo a septiembre le sacaría de
 * la pantalla justo lo que fue a buscar. Por eso la condición es angosta —sólo se mueve a quien
 * estaba parado en el mes que **dejó** de ser vigente— y ante cualquier otra cosa no toca nada.
 */
export function reencuadrarPeriodo(
  seleccionado: string, vigenteAnterior: string, vigenteNuevo: string,
): string | null {
  if (!seleccionado || !vigenteAnterior || !vigenteNuevo) return null;
  // Sin cambio de mes no hay nada que hacer, y devolver un valor acá dispararía un setState en
  // cada render: la app se colgaría en un bucle.
  if (vigenteAnterior === vigenteNuevo) return null;
  return seleccionado === vigenteAnterior ? vigenteNuevo : null;
}

/** 'YYYY-MM' del mes siguiente a `periodo`. Maneja el corte de año. Formato inválido → tal cual. */
export function mesSiguiente(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo ?? "");
  if (!m) return periodo ?? "";
  let y = Number(m[1]);
  let mo = Number(m[2]) + 1;
  if (mo > 12) { mo = 1; y += 1; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/**
 * Instancia EN BLANCO de una card para un mes NUEVO todavía sin fila en `card_periodos`
 * (adelantar un mes futuro): arranca en 'pend', con el checklist destildado y sin
 * observaciones ni historial del mes anterior — para que el mes que viene no se vea como
 * una copia del mes en curso. Respeta `reset_policy`: 'mantener' conserva el estado actual
 * (tareas que se arrastran de un mes al otro); cualquier otro valor arranca limpio.
 */
export function instanciaEnBlanco(card: Card): Card {
  if (card.reset_policy === "mantener") return card;
  return {
    ...card,
    status: "pend",
    checklist: (card.checklist ?? []).map((i) => ({ ...i, done: false, done_at: null })),
    comments: [],
    history: [],
    done_at: null,
    proc_at: null,
  };
}

/**
 * Vista de una card con el estado de su período. Si `cp` existe, el status/checklist/
 * comments/history/done_at/proc_at/due_date salen del período; si es null, la card tal
 * cual (fallback para períodos aún sin fila). Los campos de DEFINICIÓN (title, owner,
 * recur_rule, priority, effort, deps, categoria, etiquetas, ...) SIEMPRE de la card.
 */
export function mergeCardPeriodo(card: Card, cp: CardPeriodo | null): Card {
  if (!cp) return card;
  return {
    ...card,
    status: cp.status,
    checklist: cp.checklist ?? [],
    comments: cp.comments ?? [],
    history: cp.history ?? [],
    done_at: cp.done_at,
    proc_at: cp.proc_at,
    due_date: cp.due_date,
  };
}

/**
 * Board de un período: para cada card NO operativa, la mergea con su `card_periodos` de
 * ese período (o fallback a la card si no hay fila). Las cards operativas se devuelven
 * tal cual, sin tocar (no tienen instancia por período).
 *
 * ENFOQUE CONSERVADOR (Fase 2): si `vigente` coincide con `periodo`, se devuelven las
 * cards CRUDAS sin mergear. El mes vigente sigue teniendo su fuente de verdad en `cards`
 * (ahí escribe el flujo diario de siempre); sólo los meses NO vigentes leen su estado de
 * `card_periodos`. Así el mes en curso nunca se muestra desde una copia que podría quedar
 * desactualizada, y los meses adelantados se ven independientes. `vigente` es opcional
 * para no romper llamadas viejas (sin él, mergea todos los períodos como antes).
 */
export function cardsDelPeriodo(cards: Card[], periodos: CardPeriodo[], periodo: string, vigente?: string): Card[] {
  if (!Array.isArray(cards)) return [];
  if (vigente !== undefined && periodo === vigente) return cards;
  const porCard = new Map<string, CardPeriodo>();
  if (Array.isArray(periodos)) {
    for (const p of periodos) {
      // Las filas YA VOLCADAS se ignoran (migración 51, hallazgo 4 de la auditoría del 05/08).
      // `card_periodos` es el borrador de un mes que todavía no llegó; cuando ese mes pasa a ser
      // el vigente, el reinicio vuelca su contenido sobre `cards` y marca `aplicado_at`.
      //
      // Si igual se siguieran leyendo, el día que ese mes deje de ser vigente esta vista
      // mergearía la foto adelantada POR ENCIMA de todo lo que se hizo durante el mes. Se
      // salvaría el trabajo adelantado a costa de tapar el trabajo real: un bug cambiado por
      // otro peor. Desde que se volcó, la verdad de ese mes vive en la tarjeta.
      if (p?.periodo === periodo && p?.card_id && !p.aplicado_at) porCard.set(p.card_id, p);
    }
  }
  return cards.map((c) => {
    if (c.card_type === "operativa") return c;
    const cp = porCard.get(c.id) ?? null;
    // Con fila → estado guardado de ese mes. Sin fila (mes futuro recién abierto) →
    // instancia EN BLANCO, para que el mes que viene no se vea como copia del actual.
    return cp ? mergeCardPeriodo(c, cp) : instanciaEnBlanco(c);
  });
}

/**
 * Períodos ofrecibles en el selector: los que tienen datos en `card_periodos` más el
 * vigente, únicos y en orden descendente (el más reciente primero). Con `card_periodos`
 * vacío devuelve al menos el vigente, para que el selector nunca quede sin opciones.
 *
 * `incluirFuturo` agrega el MES SIGUIENTE aunque todavía no tenga datos, para poder
 * navegar a él y empezar a adelantar trabajo (si no, un mes futuro nunca aparecería porque
 * aparecer depende de tener datos, y tener datos depende de poder entrar — círculo vicioso).
 * Sólo debe activarse cuando la migración 32 está aplicada (si no, escribir en ese mes
 * caería sobre `cards`); esa decisión la toma quien llama (App, con tienePeriodos()).
 */
export function periodosDisponibles(periodos: CardPeriodo[], hoyISO: string, incluirFuturo = false): string[] {
  const set = new Set<string>();
  const vig = periodoVigente(hoyISO);
  set.add(vig);
  if (incluirFuturo) set.add(mesSiguiente(vig));
  if (Array.isArray(periodos)) {
    for (const p of periodos) {
      if (p?.periodo && /^\d{4}-\d{2}$/.test(p.periodo)) set.add(p.periodo);
    }
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * Etiqueta legible de un período para el selector del tablero: "Julio 2026".
 * Defensivo: si `periodo` no tiene forma 'YYYY-MM', devuelve el valor tal cual.
 */
export function periodoLabel(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo ?? "");
  if (!m) return periodo ?? "";
  const nombre = mesLegible(periodo);
  if (!nombre) return periodo;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${m[1]}`;
}
