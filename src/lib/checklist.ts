import type { ChecklistItem } from "./types";
export function editarItem(list: ChecklistItem[], idx: number, txt: string): ChecklistItem[] {
  return list.map((it, i) => (i === idx ? { ...it, txt } : it));
}
export function borrarItem(list: ChecklistItem[], idx: number): ChecklistItem[] {
  return list.filter((_, i) => i !== idx);
}
