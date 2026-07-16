import type { Card } from "./types";

// Fila para insertar una copia de una tarea (spec 21, item 5).
// La copia nace en Pendiente, con el checklist reseteado y sin
// comentarios ni dependencias: es trabajo nuevo, no un clon del estado.
export function filaDuplicada(c: Card, meName: string, at: string) {
  return {
    owner: c.owner,
    title: c.title + " (copia)",
    status: "pend" as const,
    description: c.description,
    priority: c.priority,
    effort: c.effort,
    card_type: c.card_type,
    categoria: c.categoria ?? null,
    recur_rule: c.recur_rule ?? null,
    deps: [],
    checklist: (c.checklist ?? []).map((i) => ({ ...i, done: false, done_at: null })),
    comments: [],
    history: [{ who: meName, at, txt: `Creada duplicando "${c.title}"` }],
  };
}
