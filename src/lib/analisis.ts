// Análisis ejecutivo de cierre mensual (spec items 8 y 9). Función PURA: toda la data
// entra por parámetros (cards vivas del mes, perfiles, ocurrencias del mes, archivos
// históricos del equipo). Sin fetch. Consumida por AnalisisMensual.tsx.
import type { Card, Profile, TaskOccurrence, CardArchive } from "./types";
import { dueInfo } from "./metrics";
import { marcaDe } from "./segmento";

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
  const norm = vivas(cards);

  // 1. Cumplimiento general del mes en curso.
  const cumplimiento = cumplPct(cards);

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
  const personas = profiles.filter((p) => p.role !== "jefe");
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
  const difs = occs.filter((o) => o.resultado === "dif");
  const arqueos = { difs: difs.length, montoTotal: difs.reduce((s, o) => s + (o.dif_importe ?? 0), 0) };

  // 7. Vencidas al cierre (abiertas con vencimiento pasado).
  const vencidas = norm.filter((c) => c.status !== "term").filter((c) => { const i = dueInfo(c); return i && i.days < 0; }).length;

  // 8 y 9. Histórico: cumplimiento por mes archivado.
  const porMes = new Map<string, Card[]>();
  for (const a of archives) (porMes.get(a.mes) ?? porMes.set(a.mes, []).get(a.mes)!).push(a.card);
  const cumplPorMes = new Map<string, number>();
  for (const [mes, cs] of porMes) cumplPorMes.set(mes, cumplPct(cs));

  const prevMes = month1a12 === 1 ? `${year - 1}-12` : `${year}-${pad(month1a12 - 1)}`;
  const deltaMesAnterior = cumplPorMes.has(prevMes) ? cumplimiento - cumplPorMes.get(prevMes)! : null;

  const vals = [...cumplPorMes.values()];
  const promedioHistorico = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;

  return { cumplimiento, porMarca, porSucursal, porPersona, distribucion: { medianaAbiertas, sobrecargados }, arqueos, vencidas, deltaMesAnterior, promedioHistorico };
}
