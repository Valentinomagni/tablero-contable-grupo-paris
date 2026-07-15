import type { Card, Status } from "./types";

// Tareas compartidas / delegadas: una tarjeta ESPEJO por participante (cada uno la ve en su
// board y suma en sus métricas), vinculadas por una marca en el historial. Completar una
// sincroniza a las hermanas (best-effort en la app + trigger SECURITY DEFINER en la DB).
export const SHARED_PREFIX = "compartida:";

export function sharedLinkId(c: Pick<Card, "history">): string | null {
  const h = (c.history ?? []).find((e) => e.txt.startsWith(SHARED_PREFIX));
  return h ? h.txt.slice(SHARED_PREFIX.length) : null;
}

export function isShared(c: Pick<Card, "history">): boolean {
  return sharedLinkId(c) !== null;
}

// ids de las tarjetas hermanas (mismo vínculo), excluyendo la propia
export function siblingIds(c: Card, cards: Card[]): string[] {
  const id = sharedLinkId(c);
  if (!id) return [];
  return cards.filter((x) => x.id !== c.id && sharedLinkId(x) === id).map((x) => x.id);
}

// nombres de los participantes de una tarea compartida (dueños de todas las hermanas)
export function participantes(c: Card, cards: Card[], nameOf: (ownerId: string) => string): string[] {
  const id = sharedLinkId(c);
  if (!id) return [];
  const owners = cards.filter((x) => sharedLinkId(x) === id).map((x) => x.owner);
  return [...new Set(owners)].map(nameOf);
}

export interface NuevaCompartida {
  linkId: string; title: string; owners: string[]; delegador: string;
  due_date: string | null; effort: 1 | 2 | 3 | 5; priority: "alta" | "media" | "baja";
  at: string; nameOf: (ownerId: string) => string;
}

// filas a insertar (una por participante) para crear una tarea compartida
export function filasCompartida(p: NuevaCompartida) {
  const nombres = p.owners.map(p.nameOf).join(", ");
  return p.owners.map((owner) => ({
    owner, title: p.title.trim(), status: "pend" as const, priority: p.priority,
    effort: p.effort, due_date: p.due_date, card_type: "normal" as const,
    history: [
      { who: p.delegador, at: p.at, txt: `${SHARED_PREFIX}${p.linkId}` },
      { who: p.delegador, at: p.at, txt: `Tarea compartida — delegada por ${p.delegador} · con ${nombres}` },
    ],
  }));
}

// patches para las hermanas cuando la principal cambia de estado (solo las que difieren, evita loops)
export function siblingSyncPatches(primary: Card, cards: Card[], newStatus: Status, at: string): { id: string; patch: Partial<Card> }[] {
  const id = sharedLinkId(primary);
  if (!id) return [];
  return cards
    .filter((x) => x.id !== primary.id && sharedLinkId(x) === id && x.status !== newStatus)
    .map((x) => ({ id: x.id, patch: { status: newStatus, done_at: newStatus === "term" ? at : null } as Partial<Card> }));
}
