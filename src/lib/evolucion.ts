// Curva de evolución individual (spec 28, Fase C, Task 6). Función PURA: sin `new Date()`,
// ventana anclada en el mes más reciente CON DATOS de esa persona — mismo criterio que
// comparativaMensual en comparador.ts. Pensada para acompañar, no para calificar: ver el
// texto de la ficha en Organigrama.tsx.
import type { CardArchive } from "./types";

export interface PuntoCurva { mes: string; cumplimiento: number }

function cumplPct(cards: { status: string }[]): number | null {
  if (!cards.length) return null;
  const term = cards.filter((c) => c.status === "term").length;
  return Math.round((term / cards.length) * 100);
}

export function curvaPersona(archives: CardArchive[], ownerId: string, meses: number): PuntoCurva[] {
  const propios = archives.filter((a) => a.owner === ownerId && a.card.card_type !== "operativa");
  if (!propios.length) return [];

  const mesesUnicos = [...new Set(propios.map((a) => a.mes))].sort();
  const anchor = mesesUnicos[mesesUnicos.length - 1];
  const anchorPos = mesesUnicos.indexOf(anchor);
  const ventana = mesesUnicos.slice(Math.max(0, anchorPos - meses + 1), anchorPos + 1);
  const ventanaSet = new Set(ventana);

  const porMes = new Map<string, { status: string }[]>();
  for (const a of propios) {
    if (!ventanaSet.has(a.mes)) continue;
    (porMes.get(a.mes) ?? porMes.set(a.mes, []).get(a.mes)!).push(a.card);
  }

  return ventana.map((mes) => ({ mes, cumplimiento: cumplPct(porMes.get(mes) ?? []) ?? 0 }));
}

export function tendencia(curva: PuntoCurva[]): "sube" | "baja" | "estable" {
  if (curva.length < 2) return "estable";
  const mitad = Math.floor(curva.length / 2);
  const primera = curva.slice(0, mitad);
  const segunda = curva.slice(mitad);
  const prom = (xs: PuntoCurva[]) => xs.reduce((s, x) => s + x.cumplimiento, 0) / xs.length;
  const diff = prom(segunda) - prom(primera);
  if (diff > 5) return "sube";
  if (diff < -5) return "baja";
  return "estable";
}
