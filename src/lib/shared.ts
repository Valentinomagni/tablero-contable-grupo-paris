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

// Prefijo literal de la nota de delegación que escribe filasCompartida() más abajo. El
// matcher (RE_DELEGADA/delegadorDe) deriva de este mismo literal para que no puedan
// desincronizarse: si el texto cambia acá, el regex se genera de nuevo automáticamente.
const NOTA_DELEGADA_PREFIX = "Tarea compartida — delegada por ";
const NOTA_DELEGADA_MID = " · con ";
const RE_DELEGADA = new RegExp(
  `^${NOTA_DELEGADA_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(.+?)${NOTA_DELEGADA_MID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);

// Nombre de quien delegó, leído de la nota que escribe filasCompartida(). Única fuente de
// verdad del matcher: quien consuma esto (p. ej. delegaciones.ts) debe importarlo de acá,
// nunca reescribir el regex a mano.
export function delegadorDe(c: Pick<Card, "history">): string | null {
  const h = (c.history ?? []).find((e) => RE_DELEGADA.test(e.txt));
  if (!h) return null;
  const m = h.txt.match(RE_DELEGADA);
  return m ? m[1] : null;
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
      { who: p.delegador, at: p.at, txt: `${NOTA_DELEGADA_PREFIX}${p.delegador}${NOTA_DELEGADA_MID}${nombres}` },
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
