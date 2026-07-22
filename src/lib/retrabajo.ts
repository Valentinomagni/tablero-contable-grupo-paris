// Índice de retrabajo (spec 28 Fase B, J1): cuántas veces se reabrió una tarea ya
// dada por terminada. Señal de calidad del trabajo o de criterios poco claros — NO es
// un ranking de culpables (ver encuadre en AnalisisMensual.tsx). Función PURA.
import type { Card, Profile, Status } from "./types";
import { esVisible } from "./visibilidad";

// El índice cuenta reaperturas matcheando este texto en el history. Hay tres caminos de UI
// que sacan una tarea de "term" (botón Reabrir del modal, drag & drop y el selector de Estado
// del modal); los tres deben escribir exactamente este texto para que el índice los detecte —
// usar textoTransicion() en cada uno en vez de un literal suelto.
// IMPORTANTE: esto rige desde que se unificó (spec 28 Fase B, fix de los tres caminos) en
// adelante. El historial viejo registrado como "Movió la tarea" / "Volvió a Pendiente" no se
// puede reclasificar retroactivamente (no sabemos si esas transiciones partían de "term"), así
// que el índice es fiable desde esta versión en adelante, no para datos históricos previos.
export const TXT_REAPERTURA = "Reabrió la tarea";

// Función pura que decide qué texto de historial corresponde a una transición de estado.
// Cualquier transición que parta de "term" hacia otro estado es una reapertura, sin importar
// por qué camino de la UI se hizo (drag & drop, selector de Estado, botón Reabrir).
export function textoTransicion(anterior: Status, nuevo: Status, textoPorDefecto: string): string {
  if (anterior === "term" && nuevo !== "term") return TXT_REAPERTURA;
  return textoPorDefecto;
}

export interface IndiceRetrabajo {
  general: { reaperturas: number; terminadas: number; pct: number | null };
  porPersona: { id: string; nombre: string; reaperturas: number; terminadas: number; pct: number | null }[];
  masReabiertas: { id: string; title: string; veces: number }[];
}

// Cuenta cuántas veces se registró una reapertura en el history de una card.
export function reaperturasDe(c: Pick<Card, "history">): number {
  const history = c.history ?? [];
  return history.filter((h) => h.txt === TXT_REAPERTURA).length;
}

function pct(reaperturas: number, terminadas: number): number | null {
  if (terminadas === 0) return null;
  return Math.round((reaperturas / terminadas) * 100);
}

export function indiceRetrabajo(cards: Card[], profiles: Profile[]): IndiceRetrabajo {
  const terminadas = cards.filter((c) => c.status === "term");
  const reaperturasTotal = terminadas.reduce((sum, c) => sum + reaperturasDe(c), 0);

  const personas = profiles.filter((p) => p.role !== "jefe" && esVisible(p));
  const porPersona = personas.map((p) => {
    const suyas = terminadas.filter((c) => c.owner === p.id);
    const reaperturas = suyas.reduce((sum, c) => sum + reaperturasDe(c), 0);
    return { id: p.id, nombre: p.name, reaperturas, terminadas: suyas.length, pct: pct(reaperturas, suyas.length) };
  });

  const masReabiertas = terminadas
    .map((c) => ({ id: c.id, title: c.title, veces: reaperturasDe(c) }))
    .filter((c) => c.veces >= 2)
    .sort((a, b) => b.veces - a.veces)
    .slice(0, 5);

  return {
    general: { reaperturas: reaperturasTotal, terminadas: terminadas.length, pct: pct(reaperturasTotal, terminadas.length) },
    porPersona,
    masReabiertas,
  };
}
