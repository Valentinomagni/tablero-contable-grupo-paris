import type { Card } from "./types";

// pila LIFO de deshacer: guarda el valor previo de los campos tocados (máx. 30)
interface UndoEntry { id: string; prev: Partial<Card>; }
const stack: UndoEntry[] = [];

export function pushUndo(card: Card, patch: Partial<Card>): void {
  const prev: Partial<Card> = {};
  (Object.keys(patch) as (keyof Card)[]).forEach((k) => {
    (prev as Record<string, unknown>)[k] = structuredClone(card[k] ?? null);
  });
  stack.push({ id: card.id, prev });
  if (stack.length > 30) stack.shift();
}

export function popUndo(): UndoEntry | undefined {
  return stack.pop();
}
