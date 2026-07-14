import type { Card } from "./types";

// Plantilla de cierre mensual (5S — Seiketsu: estandarizar el proceso repetitivo).
// Se guarda en settings.value.closing_template; un click genera las tareas del mes.
export interface TemplateItem {
  title: string;
  owner: string;            // profile id
  due_day: number | null;   // día del mes de vencimiento (1-31) o null
  effort: 1 | 2 | 3 | 5;
  priority: "alta" | "media" | "baja";
}

export function validarPlantilla(items: TemplateItem[]): string | null {
  if (!items.length) return "La plantilla está vacía.";
  for (const it of items) {
    if (!it.title.trim()) return "Hay un ítem sin título.";
    if (!it.owner) return `"${it.title}" no tiene responsable.`;
    if (it.due_day !== null && (it.due_day < 1 || it.due_day > 31)) return `"${it.title}" tiene un día de vencimiento inválido.`;
  }
  return null;
}

// due_date del ítem para un mes dado (clampa al último día real del mes)
export function dueDateDe(item: TemplateItem, year: number, month1a12: number): string | null {
  if (item.due_day === null) return null;
  const last = new Date(year, month1a12, 0).getDate();
  const day = Math.min(item.due_day, last);
  return `${year}-${String(month1a12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// qué ítems de la plantilla FALTAN generar (evita duplicados si se aprieta dos veces):
// existe = misma persona + mismo título + creada o venciendo en ese mes
export function faltantesDePlantilla(items: TemplateItem[], cards: Card[], year: number, month1a12: number): TemplateItem[] {
  const pref = `${year}-${String(month1a12).padStart(2, "0")}`;
  return items.filter((it) => !cards.some((c) =>
    c.owner === it.owner &&
    c.title.trim().toLowerCase() === it.title.trim().toLowerCase() &&
    ((c.due_date ?? "").startsWith(pref) || c.created_at.startsWith(pref))
  ));
}

export function filasParaInsertar(items: TemplateItem[], year: number, month1a12: number, whoName: string) {
  return items.map((it) => ({
    owner: it.owner,
    title: it.title.trim(),
    status: "pend" as const,
    priority: it.priority,
    effort: it.effort,
    due_date: dueDateDe(it, year, month1a12),
    history: [{ who: whoName, at: new Date().toISOString(), txt: "Generada desde la plantilla de cierre mensual" }],
  }));
}
