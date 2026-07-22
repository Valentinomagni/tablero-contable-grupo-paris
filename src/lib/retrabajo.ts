// Índice de retrabajo (spec 28 Fase B, J1): cuántas veces se reabrió una tarea ya
// dada por terminada. Señal de calidad del trabajo o de criterios poco claros — NO es
// un ranking de culpables (ver encuadre en AnalisisMensual.tsx). Función PURA.
import type { Card, Profile } from "./types";
import { esVisible } from "./visibilidad";

const TXT_REAPERTURA = "Reabrió la tarea";

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
