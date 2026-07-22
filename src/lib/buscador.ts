import type { Card } from "./types";

// Código de error de PostgREST cuando el RPC no está expuesto (función inexistente
// o no recargada en el schema cache). Distinto de PGRST205 (tabla inexistente).
export function funcionNoExiste(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "PGRST202" || code === "42883";
}

// Combina las cards ya presentes en memoria (instantáneas) con las que trajo el RPC
// full-text, sin duplicar por id. Las de memoria van primero y mantienen su orden
// (para que la lista no "salte" mientras el usuario tipea); las del servidor se
// agregan al final, sólo las que no estaban ya.
export function combinarResultadosCards(enMemoria: Card[], delServidor: Card[]): Card[] {
  const ids = new Set(enMemoria.map((c) => c.id));
  const extra = delServidor.filter((c) => !ids.has(c.id));
  return [...enMemoria, ...extra];
}
