// Análisis ejecutivo de cierre mensual (spec items 8 y 9). Función PURA: toda la data
// entra por parámetros (cards vivas del mes, perfiles, ocurrencias del mes, archivos
// históricos del equipo). Sin fetch. Consumida por AnalisisMensual.tsx.
import type { Card, Profile, TaskOccurrence, CardArchive } from "./types";
import { dueInfo, toARTDate } from "./metrics";
import { marcaDe } from "./segmento";
import { esVisible, archivesParaMetricas } from "./visibilidad";

export interface AnalisisMes {
  cumplimiento: number;                     // 0-100
  porMarca: { marca: string; pct: number; total: number }[];
  porSucursal: { sucursal: string; pct: number; total: number }[];
  porPersona: { id: string; nombre: string; pct: number; total: number; vencidas: number; abiertas: number }[];
  distribucion: { medianaAbiertas: number; sobrecargados: string[] };  // ids con >1.5× mediana
  arqueos: { difs: number; montoTotal: number };
  vencidas: number;
  deltaMesAnterior: number | null;          // puntos de % vs mes previo (null si no hay archivo)
  promedioHistorico: number | null;         // Rendimiento Promedio (item 9)
}

const pad = (n: number) => String(n).padStart(2, "0");

// Cards "vivas" que cuentan para cumplimiento: excluye operativas.
const vivas = (cards: Card[]) => cards.filter((c) => c.card_type !== "operativa");

// % de cumplimiento (term / total) sobre un set de cards ya filtrado.
function cumplPct(cards: Card[]): number {
  const norm = vivas(cards);
  if (!norm.length) return 0;
  const term = norm.filter((c) => c.status === "term").length;
  return Math.round((term / norm.length) * 100);
}

/**
 * ¿Esta card es trabajo DEL MES `mes` ('YYYY-MM')?
 *
 * POR QUÉ EXISTE (hallazgo 3 de la auditoría del 05/08). `analizarMes` recibía año y mes y los
 * usaba SÓLO para calcular el mes anterior: el cumplimiento salía de `terminadas / total` sobre
 * TODAS las cards vivas, sin cota temporal. Y las cards se acumulan para siempre — las "una sola
 * vez" no se reinician nunca (eso está bien) y la plantilla de cierre crea nuevas cada mes.
 * El 2 de agosto, con el reinicio recién corrido y nadie habiendo hecho nada, cuarenta puntuales
 * viejas en "Terminado" contra diez recurrentes en pendiente daban **80% de cumplimiento del
 * mes**. A los seis meses de uso el número no bajaba de 90% aunque no se trabajara. Un indicador
 * que sube solo con el paso del tiempo es peor que no tener indicador: el jefe decide con él.
 *
 * EL CRITERIO. Abierta = trabajo de ahora, cuenta siempre (aunque venga de marzo: sacarla del
 * denominador sería otra forma de inflar el número). Terminada = cuenta sólo si se cerró DENTRO
 * del mes; una cerrada en un mes anterior ya se contó en su mes y no vuelve a contar.
 *
 * POR QUÉ NO SE REUSÓ `closingCards` (cierre.ts). Ese predicado ancla por la marca de historial
 * de la plantilla, así que sólo ve las tareas que genera el cierre mensual — acá hay que medir
 * TODAS las tareas del equipo, incluidas las puntuales que nadie generó desde la plantilla.
 * Es la misma idea (acotar antes de calcular) con la cota que corresponde a este conjunto.
 *
 * EL MES SE LEE EN HORA ARGENTINA, con `toARTDate` y nunca con `done_at.slice(0, 7)`: eso es el
 * mes UTC y ya causó cinco bugs en este proyecto. Una tarea cerrada el 31/07 a las 21:30 tiene
 * `done_at` del 1 de agosto y se leería como del mes que recién arranca, inflándolo.
 *
 * Terminada SIN `done_at`: no hay forma honesta de ubicarla en un mes, así que queda afuera de
 * los dos lados de la fracción. La app escribe `done_at` en el mismo update que pone "term"
 * (Board.tsx, CardModal.tsx, cierre-rapido.ts), así que es una anomalía de datos; si aparece,
 * contarla como terminada del mes en curso sería exactamente el bug que se está corrigiendo.
 */
function esDelMes(c: Pick<Card, "status" | "done_at">, mes: string): boolean {
  if (!c) return false;
  if (c.status !== "term") return true;
  if (!c.done_at) return false;
  // Fecha basura (no debería llegar: `saneaCards` la limpia) → tampoco se puede fechar.
  // Sin esta guarda `toARTDate` tira RangeError al hacer toISOString() de un Invalid Date.
  if (!isFinite(new Date(c.done_at).getTime())) return false;
  return toARTDate(c.done_at).slice(0, 7) === mes;
}

/** Cards del mes indicado, según `esDelMes`. */
export function cardsDelMes(cards: Card[], year: number, month1a12: number): Card[] {
  const mes = `${year}-${pad(month1a12)}`;
  return (cards ?? []).filter((c) => esDelMes(c, mes));
}

function mediana(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function analizarMes(
  cards: Card[], profiles: Profile[], occs: TaskOccurrence[],
  archives: CardArchive[], year: number, month1a12: number,
): AnalisisMes {
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // COTA TEMPORAL, UNA SOLA VEZ Y ARRIBA DE TODO (hallazgo 3 de la auditoría del 05/08).
  //
  // DECISIÓN: la cota se aplica a TODO el análisis —cumplimiento, porMarca, porSucursal,
  // porPersona, distribución y vencidas— y no sólo al cumplimiento general, que era el cambio
  // más chico posible. Tres razones, en orden de peso:
  //
  //   1. Las partes tienen que cerrar con el total. Acotar sólo el número grande dejaba en la
  //      MISMA pantalla "Cumplimiento del mes 0%" arriba y "Peugeot 80%" tres centímetros más
  //      abajo. Cuando dos números de la misma pantalla no cierran, lo que se pierde no es ese
  //      número: es la confianza en los otros doce.
  //   2. Todos los rótulos de esta vista dicen "del mes" (la pantalla se llama "Análisis del
  //      mes"). Si la mitad de las filas incluye trabajo de marzo, el rótulo miente.
  //   3. Un solo punto de filtrado es un solo lugar donde puede divergir. El hallazgo 2 de esta
  //      misma auditoría existe porque el criterio estaba escrito dos veces.
  //
  // QUÉ NO CAMBIA con esto: `vencidas` y `distribucion` miran únicamente tareas ABIERTAS, y las
  // abiertas nunca se caen de la cota — o sea que dan lo mismo que antes. `arqueos` viene de las
  // ocurrencias, que ya llegan acotadas al mes desde el hook.
  const delMes = cardsDelMes(cards, year, month1a12);
  const norm = vivas(delMes);

  // 1. Cumplimiento general del mes en curso.
  const cumplimiento = cumplPct(delMes);

  // 2 y 3. Por marca / por sucursal (la card manda, hereda del dueño).
  const agrupar = (clave: (c: Card) => string | null, sinLbl: string) => {
    const grupos = new Map<string, Card[]>();
    for (const c of norm) {
      const k = clave(c) ?? sinLbl;
      (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(c);
    }
    return [...grupos.entries()]
      .map(([k, cs]) => ({ k, pct: cumplPct(cs), total: cs.length }))
      .sort((a, b) => b.total - a.total);
  };
  const porMarca = agrupar((c) => marcaDe(c, byId), "Sin marca")
    .map(({ k, pct, total }) => ({ marca: k, pct, total }));
  const porSucursal = agrupar((c) => c.sucursal ?? byId.get(c.owner)?.sucursal ?? null, "Sin sucursal")
    .map(({ k, pct, total }) => ({ sucursal: k, pct, total }));

  // 4. Por persona (excluye jefes).
  const personas = profiles.filter((p) => p.role !== "jefe" && esVisible(p));
  const porPersona = personas.map((p) => {
    const suyas = norm.filter((c) => c.owner === p.id);
    const abiertas = suyas.filter((c) => c.status !== "term");
    const term = suyas.filter((c) => c.status === "term").length;
    const vencidas = abiertas.filter((c) => { const i = dueInfo(c); return i && i.days < 0; }).length;
    return {
      id: p.id, nombre: p.name,
      pct: suyas.length ? Math.round((term / suyas.length) * 100) : 0,
      total: suyas.length, vencidas, abiertas: abiertas.length,
    };
  });

  // 5. Distribución de carga: mediana de abiertas por persona; sobrecargados > 1.5× mediana.
  const abiertasPorPersona = porPersona.map((p) => p.abiertas);
  const medianaAbiertas = mediana(abiertasPorPersona);
  const sobrecargados = medianaAbiertas > 0
    ? porPersona.filter((p) => p.abiertas > medianaAbiertas * 1.5).map((p) => p.id)
    : [];

  // 6. Diferencias de arqueo del mes (occurrences con resultado 'dif').
  // montoTotal es magnitud (faltantes negativos + sobrantes positivos no deben cancelarse
  // entre sí): usamos Math.abs de cada importe, no la suma neta.
  const difs = occs.filter((o) => o.resultado === "dif");
  const arqueos = { difs: difs.length, montoTotal: difs.reduce((s, o) => s + Math.abs(o.dif_importe ?? 0), 0) };

  // 7. Vencidas al cierre (abiertas con vencimiento pasado).
  const vencidas = norm.filter((c) => c.status !== "term").filter((c) => { const i = dueInfo(c); return i && i.days < 0; }).length;

  // 8 y 9. Histórico: cumplimiento por mes archivado.
  // Acá NO se vuelve a aplicar `cardsDelMes`, y es a propósito: `cards_archive` ya es una foto
  // por mes y su campo `mes` es la cota buena. Filtrar de nuevo por `done_at` borraría del
  // promedio meses enteros (una card archivada en junio y cerrada en mayo es de la foto de junio).
  // Mismo criterio que comparativaMensual() y concentracion(): fuera los ocultos, el
  // centinela "Sin asignar" cuenta (ver archivesParaMetricas en visibilidad.ts). Sin esto,
  // esta serie y la comparativa mostraban dos porcentajes distintos del mismo mes.
  const porMes = new Map<string, Card[]>();
  for (const a of archivesParaMetricas(archives, profiles)) {
    (porMes.get(a.mes) ?? porMes.set(a.mes, []).get(a.mes)!).push(a.card);
  }
  const cumplPorMes = new Map<string, number>();
  for (const [mes, cs] of porMes) cumplPorMes.set(mes, cumplPct(cs));

  const prevMes = month1a12 === 1 ? `${year - 1}-12` : `${year}-${pad(month1a12 - 1)}`;
  const deltaMesAnterior = cumplPorMes.has(prevMes) ? cumplimiento - cumplPorMes.get(prevMes)! : null;

  const vals = [...cumplPorMes.values()];
  const promedioHistorico = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;

  return { cumplimiento, porMarca, porSucursal, porPersona, distribucion: { medianaAbiertas, sobrecargados }, arqueos, vencidas, deltaMesAnterior, promedioHistorico };
}
