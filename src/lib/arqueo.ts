import type { TaskOccurrence, Profile } from "./types";
import { esVisible } from "./visibilidad";

// Seguimiento de Arqueo de Caja (spec24 item 9). Sobre las ocurrencias (task_occurrences)
// de una card de control, calcula el cumplimiento del mes: cuántas se hicieron sin diferencias
// ('ok') vs con diferencias ('dif'). Puro y determinístico → testeable (TDD).

export interface StatsArqueo {
  total: number;       // ocurrencias done del mes
  ok: number;          // resultado === "ok"
  dif: number;         // resultado === "dif"
  pctOk: number;       // ok/total * 100, 2 decimales
  pctDif: number;      // dif/total * 100, 2 decimales
  diasCorrectos: number; // = ok
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Filtra ocurrencias del mes (fecha empieza con mesPrefix "YYYY-MM") que estén done,
// y computa el cumplimiento. Si no hay done → pcts 0.
export function statsArqueo(occs: TaskOccurrence[], mesPrefix: string): StatsArqueo {
  const done = occs.filter((o) => o.done && o.fecha.startsWith(mesPrefix));
  const total = done.length;
  const ok = done.filter((o) => o.resultado === "ok").length;
  const dif = done.filter((o) => o.resultado === "dif").length;
  const pctOk = total === 0 ? 0 : round2((ok / total) * 100);
  const pctDif = total === 0 ? 0 : round2((dif / total) * 100);
  return { total, ok, dif, pctOk, pctDif, diasCorrectos: ok };
}

// Prefijo "YYYY-MM" del mes anterior a un prefijo dado.
function mesAnterior(mesPrefix: string): string {
  const [y, m] = mesPrefix.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// El usuario siempre carga el importe en positivo; el signo lo decide el tipo elegido
// ("falta" o "sobra"). Falta → negativo (faltó plata), sobra → positivo (sobró plata).
export function importeConSigno(monto: number, tipo: "falta" | "sobra"): number {
  const abs = Math.abs(monto);
  return tipo === "falta" ? (abs === 0 ? 0 : -abs) : abs;
}

// Texto de una diferencia de arqueo para la UI. El signo es semántica, no un número a mostrar:
// "diferencia $-500" se lee mal y obliga a interpretar el menos. Negativo → falta plata,
// positivo → sobra. null/0 → sin diferencia.
export function textoDiferencia(importe: number | null): string {
  const n = importe ?? 0;
  if (n === 0) return "sin diferencia";
  const abs = Math.abs(n).toLocaleString("es-AR");
  return n < 0 ? `falta $${abs}` : `sobra $${abs}`;
}

export interface DiferenciaHistorial { fecha: string; importe: number; obs: string | null; }
export interface ResumenDiferencias { cantidad: number; total: number; faltantes: number; sobrantes: number; }

// Historial personal de diferencias de arqueo (Task 1, spec28 fase B): de las ocurrencias
// de un owner desde una fecha, sólo las con resultado 'dif' (las 'ok' no aportan diferencia).
// Orden descendente por fecha (más reciente primero). dif_importe null → 0 (no rompe).
export function historialDiferencias(occs: TaskOccurrence[], ownerId: string, desdeISO: string): DiferenciaHistorial[] {
  return (occs ?? [])
    .filter((o) => o.owner === ownerId && o.resultado === "dif" && o.fecha >= desdeISO)
    .map((o) => ({ fecha: o.fecha, importe: o.dif_importe ?? 0, obs: o.dif_obs ?? null }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// Resumen del historial: cantidad de diferencias, total ACUMULADO EN MAGNITUD, y el desglose
// por signo (faltantes = suma de importes negativos, sobrantes = suma de importes positivos).
// total usa Math.abs a propósito (igual que analisis.ts y tendenciaDiferencias): un mes con
// −$500 y +$500 no es un mes sin diferencias, son dos diferencias de $500 cada una; el neto
// las cancelaría y escondería justamente lo que hay que revisar.
export function resumenDiferencias(items: DiferenciaHistorial[]): ResumenDiferencias {
  const cantidad = items.length;
  const total = items.reduce((s, i) => s + Math.abs(i.importe), 0);
  const faltantes = items.filter((i) => i.importe < 0).reduce((s, i) => s + i.importe, 0);
  const sobrantes = items.filter((i) => i.importe > 0).reduce((s, i) => s + i.importe, 0);
  return { cantidad, total, faltantes, sobrantes };
}

// Últimos n meses hasta hastaMesPrefix (inclusive), de más viejo a más nuevo,
// con el pctOk de cada uno según sus ocurrencias done.
export function evolucionMensual(
  occs: TaskOccurrence[],
  hastaMesPrefix: string,
  n = 6,
): { mes: string; pctOk: number }[] {
  const meses: string[] = [];
  let cur = hastaMesPrefix;
  for (let i = 0; i < n; i++) {
    meses.unshift(cur);
    cur = mesAnterior(cur);
  }
  return meses.map((mes) => ({ mes, pctOk: statsArqueo(occs, mes).pctOk }));
}

export interface TendenciaDiferencias {
  serie: { mes: string; cantidad: number; total: number }[];
  reincidentes: { id: string; nombre: string; meses: number; cantidad: number; total: number }[];
}

// Tendencia y reincidencia de diferencias de arqueo (Task 6, spec28 fase B). Sirve para
// detectar un problema de proceso o una necesidad de capacitación, NO para señalar personas:
// una diferencia recurrente casi siempre indica un procedimiento mal diseñado.
// La ventana de mesesAtras se ancla en el mes más reciente con diferencias visibles
// (no en "hoy") para que la función sea pura y determinística. Usa Math.abs para el monto
// (si no, faltantes y sobrantes se cancelarían entre sí, igual que en analisis.ts).
export function tendenciaDiferencias(
  occs: TaskOccurrence[],
  profiles: Profile[],
  mesesAtras = 6,
): TendenciaDiferencias {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const esOwnerVisible = (ownerId: string) => {
    const p = byId.get(ownerId);
    return p ? esVisible(p) : false;
  };

  const difs = (occs ?? []).filter((o) => o.resultado === "dif" && esOwnerVisible(o.owner));
  if (difs.length === 0) return { serie: [], reincidentes: [] };

  const mesDe = (o: TaskOccurrence) => o.fecha.slice(0, 7);
  const anchor = difs.reduce((max, o) => (mesDe(o) > max ? mesDe(o) : max), mesDe(difs[0]));

  const meses: string[] = [];
  let cur = anchor;
  for (let i = 0; i < mesesAtras; i++) {
    meses.unshift(cur);
    cur = mesAnterior(cur);
  }
  const mesSet = new Set(meses);
  const enVentana = difs.filter((o) => mesSet.has(mesDe(o)));

  const serie = meses.map((mes) => {
    const delMes = enVentana.filter((o) => mesDe(o) === mes);
    return {
      mes,
      cantidad: delMes.length,
      total: delMes.reduce((s, o) => s + Math.abs(o.dif_importe ?? 0), 0),
    };
  });

  const porOwner = new Map<string, { meses: Set<string>; cantidad: number; total: number }>();
  for (const o of enVentana) {
    const acc = porOwner.get(o.owner) ?? { meses: new Set<string>(), cantidad: 0, total: 0 };
    acc.meses.add(mesDe(o));
    acc.cantidad++;
    acc.total += Math.abs(o.dif_importe ?? 0);
    porOwner.set(o.owner, acc);
  }

  const reincidentes = [...porOwner.entries()]
    .filter(([, v]) => v.meses.size >= 2)
    .map(([id, v]) => ({ id, nombre: byId.get(id)?.name ?? id, meses: v.meses.size, cantidad: v.cantidad, total: v.total }))
    // ORDEN ALFABÉTICO. Decía `.sort((a, b) => b.meses - a.meses || b.total - a.total)`: quien
    // acumulaba más meses con faltantes de caja quedaba arriba de todo, desempatado por MONTO.
    //
    // Y el monto es justamente el dato que la vista decidió no mostrar al lado de un nombre,
    // porque "convierte la tabla en un ranking". Se ocultó la columna y se dejó el criterio de
    // orden, que hace lo mismo sin que se vea. Con dos o tres filas el orden no aporta ninguna
    // lectura; lo único que aporta es jerarquía.
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { serie, reincidentes };
}
