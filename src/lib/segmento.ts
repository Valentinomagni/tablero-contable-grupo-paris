// Segmentación por marca/sucursal (spec 26 item 1): la card manda; si no tiene,
// hereda la del dueño. null/undefined en el filtro = no filtrar por ese eje.
import type { Card, Profile } from "./types";

export function filtrarPorSegmento(
  cards: Card[], profiles: Profile[],
  seg: { marca?: string | null; sucursal?: string | null },
): Card[] {
  if (!seg.marca && !seg.sucursal) return cards;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return cards.filter((c) => {
    const dueño = byId.get(c.owner);
    const marca = c.marca ?? dueño?.marca ?? null;
    const sucursal = c.sucursal ?? dueño?.sucursal ?? null;
    if (seg.marca && marca !== seg.marca) return false;
    if (seg.sucursal && sucursal !== seg.sucursal) return false;
    return true;
  });
}
