import type { CierrePeriodo, Profile, Card } from "./types";
import { marcaPlantilla } from "./plantilla";
import { MESES } from "./cierre";

// Cierre mensual POR PERSONA (spec 28, task 6).
//
// La regla del negocio: cada quien cierra SU mes cuando terminó su trabajo, y puede
// haber varios meses abiertos a la vez sin conflicto (junio todavía abierto mientras
// ya se arrancó julio). Cerrar julio no toca junio: son filas independientes de
// `cierre_periodos`, con unique(owner, mes).
//
// Un mes está ABIERTO para una persona si tiene trabajo de ese mes y NO tiene fila
// en `cierre_periodos`. Un mes sin trabajo no está abierto ni cerrado: no existe.
//
// DEFENSIVO: sin la migración 29 aplicada, `periodos` llega [] (o undefined) y todo
// esto devuelve vacío / pct 0. Nunca lanza.

export function mesCerradoPor(periodos: CierrePeriodo[], ownerId: string, mes: string): CierrePeriodo | null {
  if (!Array.isArray(periodos) || !ownerId || !mes) return null;
  return periodos.find((p) => p?.owner === ownerId && p?.mes === mes) ?? null;
}

// Cota temporal: sin esto, las cards de meses viejos nunca se borran y el día que se
// aplique la migración 29 el chip diría "Tenés 7 meses abiertos: enero, febrero, ...".
// Sólo se listan como abiertos los últimos 6 meses (incluido el actual) respecto de
// `mesActual`; meses anteriores a esa ventana no cuentan aunque no tengan fila de cierre.
function ultimosSeisMeses(mesActual: string): Set<string> {
  const m = /^(\d{4})-(\d{2})$/.exec(mesActual ?? "");
  if (!m) return new Set();
  let year = Number(m[1]);
  let month = Number(m[2]);
  const out = new Set<string>();
  for (let i = 0; i < 6; i++) {
    out.add(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
  }
  return out;
}

export function mesesAbiertos(
  periodos: CierrePeriodo[],
  ownerId: string,
  mesesConTrabajo: string[],
  mesActual: string = new Date().toISOString().slice(0, 7),
): string[] {
  if (!ownerId || !Array.isArray(mesesConTrabajo)) return [];
  const ventana = ultimosSeisMeses(mesActual);
  const unicos = Array.from(new Set(mesesConTrabajo.filter(Boolean)));
  return unicos
    .filter((mes) => ventana.has(mes))
    .filter((mes) => mesCerradoPor(periodos, ownerId, mes) === null)
    .sort();
}

export function resumenEquipo(periodos: CierrePeriodo[], personas: Profile[], mes: string): {
  cerraron: Profile[]; pendientes: Profile[]; pct: number;
} {
  if (!Array.isArray(personas) || personas.length === 0) return { cerraron: [], pendientes: [], pct: 0 };
  const cerraron: Profile[] = [];
  const pendientes: Profile[] = [];
  for (const p of personas) {
    if (mesCerradoPor(periodos, p.id, mes)) cerraron.push(p);
    else pendientes.push(p);
  }
  return { cerraron, pendientes, pct: Math.round((cerraron.length / personas.length) * 100) };
}

// Meses (YYYY-MM) en los que esa persona tiene tareas de cierre generadas.
// Se ancla a la marca de historial de la plantilla — la misma clave de idempotencia
// que usa `closingCards`, así "tener trabajo" significa exactamente lo mismo en toda la app.
export function mesesConTrabajoDe(cards: Card[], ownerId: string): string[] {
  if (!Array.isArray(cards) || !ownerId) return [];
  const meses = new Set<string>();
  for (const c of cards) {
    if (c?.owner !== ownerId) continue;
    for (const h of c.history ?? []) {
      const m = /^(\d{4})-(\d{2})$/.exec((h?.txt ?? "").slice(-7));
      if (m && h.txt === marcaPlantilla(Number(m[1]), Number(m[2]))) meses.add(m[0]);
    }
  }
  return Array.from(meses).sort();
}

// 'YYYY-MM' → 'junio'. Si no se puede interpretar, devuelve la entrada tal cual.
export function mesLegible(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (!m) return mes ?? "";
  const idx = Number(m[2]) - 1;
  return MESES[idx] ?? mes;
}

// Formatea una lista de meses para mostrar ("junio, julio"), agregando el año a cada
// uno ("junio 2025, junio 2026") sólo cuando la lista mezcla años distintos — evita
// mostrar "junio, junio" cuando hay meses homónimos de años diferentes.
export function formatearMeses(meses: string[]): string {
  if (!Array.isArray(meses) || meses.length === 0) return "";
  const anios = new Set(meses.map((m) => /^(\d{4})-\d{2}$/.exec(m ?? "")?.[1]).filter(Boolean));
  if (anios.size <= 1) return meses.map(mesLegible).join(", ");
  return meses.map((m) => {
    const anio = /^(\d{4})-\d{2}$/.exec(m ?? "")?.[1] ?? "";
    return anio ? `${mesLegible(m)} ${anio}` : mesLegible(m);
  }).join(", ");
}
