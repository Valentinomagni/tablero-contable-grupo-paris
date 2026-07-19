import type { Card, Status } from "./types";

// ---- resolución de dependencias (port de app.js resolveDeps/depInfoOf/isBlocked/dependentsOf) ----
export interface DepInfo { id: string; title: string; status: Status; owner_name: string; }
export type DepMap = Record<string, DepInfo>;
export interface RevDep extends DepInfo { dep_id: string; }

export function missingDepIds(cards: Card[]): string[] {
  const known = new Set(cards.map((c) => c.id));
  return [...new Set(cards.flatMap((c) => c.deps ?? []).filter((id) => !known.has(id)))];
}

export function depInfoOf(id: string, cards: Card[], nameOf: (ownerId: string) => string, depMap: DepMap): DepInfo | undefined {
  const local = cards.find((c) => c.id === id);
  if (local) return { id, title: local.title, status: local.status, owner_name: nameOf(local.owner) };
  return depMap[id];
}

// devuelve los TÍTULOS de las tareas de las que `c` depende y que aún no están terminadas
export function bloqueadaPorTitulos(c: Card, cards: Card[]): string[] {
  return (c.deps ?? [])
    .map((id) => cards.find((x) => x.id === id))
    .filter((d): d is Card => !!d && d.status !== "term")
    .map((d) => d.title);
}

export function isBlocked(c: Card, cards: Card[], depMap: DepMap): boolean {
  return c.status !== "term" && (c.deps ?? []).some((id) => (depInfoOf(id, cards, () => "", depMap)?.status ?? "term") !== "term");
}

export function dependentsOf(cardId: string, cards: Card[], nameOf: (ownerId: string) => string, revDeps: RevDep[], isJefe: boolean): DepInfo[] {
  const locales = cards.filter((x) => (x.deps ?? []).includes(cardId))
    .map((x) => ({ id: x.id, title: x.title, status: x.status, owner_name: nameOf(x.owner) }));
  return isJefe ? locales : [...locales, ...revDeps.filter((r) => r.dep_id === cardId)];
}

// ---- layout del grafo (port de depGraphHTML) ----
interface GraphNode { id: string; x: number; y: number; title: string; owner_name: string; done: boolean; }
interface GraphEdge { from: string; to: string; x1: number; y1: number; x2: number; y2: number; done: boolean; }
export interface GraphLayout { w: number; h: number; nw: number; nh: number; gx: number; nodes: GraphNode[]; edges: GraphEdge[]; }

const NW = 210, NH = 44, GX = 70, GY = 26, PAD = 14;

export function depGraphLayout(cards: Card[], depMap: DepMap, nameOf: (ownerId: string) => string = () => ""): GraphLayout | null {
  const info = (id: string) => depInfoOf(id, cards, nameOf, depMap);
  const involved = new Set<string>();
  cards.forEach((c) => (c.deps ?? []).forEach((id) => { if (info(id)) { involved.add(c.id); involved.add(id); } }));
  if (!involved.size) return null;

  const depsOf = (id: string) => ((cards.find((x) => x.id === id)?.deps) ?? []).filter((d) => involved.has(d));
  const depthMemo: Record<string, number> = {};
  const depth = (id: string, seen = new Set<string>()): number => {
    if (id in depthMemo) return depthMemo[id];
    if (seen.has(id)) return 0; // guarda contra ciclos
    seen.add(id);
    const ds = depsOf(id);
    const v = ds.length ? 1 + Math.max(...ds.map((d) => depth(d, seen))) : 0;
    depthMemo[id] = v; return v;
  };

  const cols: Record<number, string[]> = {};
  [...involved].forEach((id) => { const d = depth(id); (cols[d] ??= []).push(id); });
  const maxDepth = Math.max(...Object.keys(cols).map(Number));
  const maxRows = Math.max(...Object.values(cols).map((a) => a.length));
  const w = PAD * 2 + (maxDepth + 1) * NW + maxDepth * GX;
  const h = PAD * 2 + maxRows * NH + (maxRows - 1) * GY;
  const pos: Record<string, { x: number; y: number }> = {};
  Object.entries(cols).forEach(([d, ids]) => ids.forEach((id, i) => {
    pos[id] = { x: PAD + Number(d) * (NW + GX), y: PAD + i * (NH + GY) };
  }));

  const edges: GraphEdge[] = [...involved].flatMap((id) => depsOf(id).map((dep) => {
    const a = pos[dep], b = pos[id];
    return {
      from: dep, to: id,
      x1: a.x + NW, y1: a.y + NH / 2, x2: b.x, y2: b.y + NH / 2,
      done: info(dep)?.status === "term",
    };
  }));

  const nodes: GraphNode[] = [...involved].map((id) => {
    const d = info(id)!, p = pos[id];
    return { id, x: p.x, y: p.y, title: d.title, owner_name: d.owner_name, done: d.status === "term" };
  });

  return { w, h, nw: NW, nh: NH, gx: GX, nodes, edges };
}
