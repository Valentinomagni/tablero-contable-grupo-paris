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

// ids de las cards que el RPC full-text ya dio por buenas. Quien renderiza los resultados
// debe SALTEAR su filtro de substring local para estas: la base ya las filtró, y con un
// criterio más amplio (stemming, multi-palabra, y match en la descripción, que no se
// muestra en la lista). Volver a filtrarlas por substring del título las descartaría.
//
// Ojo — se marcan TODAS las que devolvió el servidor, no sólo las "extra" que no estaban
// en memoria: una card ya cargada localmente puede haber matcheado por su descripción, y
// esa también se perdería si pasara por el filtro local.
export function idsDelServidor(delServidor: Card[]): Set<string> {
  return new Set(delServidor.map((c) => c.id));
}
