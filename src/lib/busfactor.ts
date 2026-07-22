// Concentración de conocimiento por categoría — "bus factor" (spec 28, Fase C, Task 10).
// Función PURA sobre el histórico completo de cards_archive. Encuadre: esto es riesgo de
// continuidad del negocio (qué pasa si esa persona se enferma, se toma vacaciones o se va),
// NO una evaluación de nadie. La acción sugerida es formar un backup / compartir el
// conocimiento, no sacarle trabajo a quien concentra la categoría.
import type { CardArchive, Profile } from "./types";
import { esVisible } from "./visibilidad";

export interface Concentracion { categoria: string; personas: number; principal: string; pct: number }

export function concentracion(archives: CardArchive[], profiles: Profile[]): Concentracion[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const visibles = new Set(profiles.filter((p) => esVisible(p)).map((p) => p.id));

  const vivos = archives.filter(
    (a) => visibles.has(a.owner) && a.card.card_type !== "operativa" && !!a.card.categoria,
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
    if (!total) continue;
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
