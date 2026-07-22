// Concentración de conocimiento por categoría — "bus factor" (spec 28, Fase C, Task 10).
// Función PURA sobre el histórico completo de cards_archive. Encuadre: esto es riesgo de
// continuidad del negocio (qué pasa si esa persona se enferma, se toma vacaciones o se va),
// NO una evaluación de nadie. La acción sugerida es formar un backup / compartir el
// conocimiento, no sacarle trabajo a quien concentra la categoría.
import type { CardArchive, Profile } from "./types";
import { archivesParaMetricas } from "./visibilidad";

export interface Concentracion { categoria: string; personas: number; principal: string; pct: number }

// Volumen mínimo de cards únicas para hablar de concentración. Por debajo de esto (p.ej. una
// categoría con 1-3 cards históricas) no hay evidencia suficiente: es ruido, no un riesgo real.
const VOLUMEN_MINIMO = 4;

export function concentracion(archives: CardArchive[], profiles: Profile[]): Concentracion[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // IMPORTANTE — dedupe por card, exclusivo de este archivo:
  // cards_archive guarda un snapshot POR MES de cada card, así que una card que vivió N meses
  // aparece N veces. concentracion() agrega sobre TODO el histórico, así que hay que contar cada
  // card una sola vez (usando el owner de su snapshot más reciente, el dueño final que la hizo).
  // comparador.ts y evolucion.ts trabajan mes a mes — ahí cada snapshot ES la foto de ese mes y
  // contar una vez por mes es correcto. No "arreglar" esos archivos por analogía con este.
  const ultimoPorCard = new Map<string, CardArchive>();
  for (const a of archives) {
    const prev = ultimoPorCard.get(a.card.id);
    if (!prev || a.mes > prev.mes) ultimoPorCard.set(a.card.id, a);
  }

  // Criterio único de métricas históricas (visibilidad.ts): fuera los ocultos, el centinela
  // "Sin asignar" cuenta — una categoría que quedó concentrada en tareas huérfanas es
  // exactamente el riesgo de continuidad que esta función busca.
  const vivos = archivesParaMetricas([...ultimoPorCard.values()], profiles).filter(
    (a) => a.card.card_type !== "operativa" && !!a.card.categoria,
  );

  const porCategoria = new Map<string, Map<string, number>>();
  for (const a of vivos) {
    const cat = a.card.categoria!;
    const porOwner = porCategoria.get(cat) ?? porCategoria.set(cat, new Map()).get(cat)!;
    porOwner.set(a.owner, (porOwner.get(a.owner) ?? 0) + 1);
  }

  const out: Concentracion[] = [];
  for (const [categoria, porOwner] of porCategoria) {
    const total = [...porOwner.values()].reduce((s, n) => s + n, 0);
    if (total < VOLUMEN_MINIMO) continue;
    let ownerTop = "", maxN = -1;
    for (const [owner, n] of porOwner) {
      if (n > maxN) { maxN = n; ownerTop = owner; }
    }
    const pct = Math.round((maxN / total) * 100);
    if (pct < 80) continue;
    out.push({ categoria, personas: porOwner.size, principal: byId.get(ownerTop)?.name ?? ownerTop, pct });
  }

  return out.sort((a, b) => b.pct - a.pct);
}
