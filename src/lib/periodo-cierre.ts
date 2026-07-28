import type { CierrePeriodo } from "./types";

// Cierre de período: qué meses están cerrados y por lo tanto son de SÓLO LECTURA
// (propuesta de períodos, Fase 3 — ver docs/PROPUESTA-PERIODOS.md sección 4).
//
// QUÉ CAMBIA: hasta ahora "cerrar el mes" era una marca DECLARATIVA — decía que cerraste,
// pero no congelaba nada: se podía seguir editando como si nada. Con `card_periodos` en su
// lugar (Fase 0-2), el cierre por fin puede congelar de verdad el mes, que es lo que le da
// sentido: un cierre que se puede deshacer sin querer no es un cierre, es un post-it.
//
// EL CIERRE ES POR PERSONA Y POR MES. Los dos ejes importan: en contabilidad conviven varios
// meses abiertos a la vez y cada persona cierra el suyo cuando termina. Que Carolina haya
// cerrado julio no cierra el julio de nadie más, y cerrar julio no toca agosto.
//
// PURA: recibe el array de cierres, sin fetch. La reapertura ya existe (`useReabrirMes` en
// hooks/usePeriodos.ts) y no se toca: siempre tiene que haber forma de volver atrás.

/** ¿`owner` cerró el mes `periodo` ('YYYY-MM')? */
export function periodoCerrado(cierres: CierrePeriodo[], owner: string, periodo: string): boolean {
  if (!Array.isArray(cierres) || !owner || !periodo) return false;
  return cierres.some((c) => c?.owner === owner && c?.mes === periodo);
}

/** Meses que `owner` tiene cerrados, del más reciente al más viejo. */
export function periodosCerradosDe(cierres: CierrePeriodo[], owner: string): string[] {
  if (!Array.isArray(cierres) || !owner) return [];
  return cierres
    .filter((c) => c?.owner === owner && !!c?.mes)
    .map((c) => c.mes)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
