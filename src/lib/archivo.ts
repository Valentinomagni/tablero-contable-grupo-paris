import type { Card, CardArchive } from "./types";

// Archivo mensual (spec 21, item 9): helpers puros para leer los snapshots
// jsonb de cards_archive. El historial se consulta desde acá; NADA se pisa.

// Meses únicos con archivo, del más nuevo al más viejo ('YYYY-MM' ordena lexicográfico).
export function mesesDisponibles(archives: CardArchive[]): string[] {
  return [...new Set(archives.map((a) => a.mes))].sort().reverse();
}

// Parsea los snapshots jsonb de un mes a Cards renderizables.
// TOLERANTE: el snapshot puede venir de versiones viejas de la tabla cards
// (campos faltantes) — se completa con defaults seguros, nunca crashea.
export function cardsDeArchivo(archives: CardArchive[], mes: string): Card[] {
  return archives
    .filter((a) => a.mes === mes)
    .map((a) => {
      const c = (a.card ?? {}) as Partial<Card>;
      return {
        id: c.id ?? a.id,
        owner: c.owner ?? a.owner,
        title: c.title ?? "(sin título)",
        status: c.status === "proc" || c.status === "term" ? c.status : "pend",
        description: c.description ?? "",
        checklist: Array.isArray(c.checklist) ? c.checklist : [],
        comments: Array.isArray(c.comments) ? c.comments : [],
        history: Array.isArray(c.history) ? c.history : [],
        done_at: c.done_at ?? null,
        due_date: c.due_date ?? null,
        recurring: !!c.recurring,
        priority: c.priority === "alta" || c.priority === "baja" ? c.priority : "media",
        effort: c.effort === 2 || c.effort === 3 || c.effort === 5 ? c.effort : 1,
        card_type: c.card_type === "operativa" ? "operativa" : "normal",
        deps: Array.isArray(c.deps) ? c.deps : [],
        created_at: c.created_at ?? "",
        recur_rule: c.recur_rule ?? null,
        protected: c.protected,
        categoria: c.categoria ?? null,
        reset_policy: c.reset_policy,
      };
    });
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-06" → "junio 2026". Si el formato no cierra, devuelve el string tal cual.
export function mesLabel(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${MESES[idx]} ${m[1]}`;
}
