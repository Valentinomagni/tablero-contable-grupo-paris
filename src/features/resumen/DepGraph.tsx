import type { Card, Profile } from "../../lib/types";
import { depGraphLayout } from "../../lib/deps";

export function DepGraph({ cards, team, onOpenCard }: { cards: Card[]; team: Profile[]; onOpenCard: (c: Card) => void }) {
  const nameOf = (id: string) => team.find((u) => u.id === id)?.name ?? "";
  const g = depGraphLayout(cards, {}, nameOf);
  if (!g) return <p className="text-ink2 text-[13px]">Sin dependencias definidas. Se vinculan desde cada tarea, sección "Depende de".</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <svg width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-label="Grafo de dependencias entre tareas">
          <defs>
            <marker id="flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--ink2)" />
            </marker>
          </defs>
          {g.edges.map((e) => (
            <path key={e.from + e.to}
              d={`M${e.x1},${e.y1} C${e.x1 + g.gx / 2},${e.y1} ${e.x2 - g.gx / 2},${e.y2} ${e.x2},${e.y2}`}
              fill="none" stroke={e.done ? "var(--done)" : "var(--warn)"} strokeWidth="2" markerEnd="url(#flecha)" />
          ))}
          {g.nodes.map((n) => {
            const local = cards.find((c) => c.id === n.id);
            const titulo = n.title.length > 24 ? n.title.slice(0, 23) + "…" : n.title;
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}
                style={{ cursor: local ? "pointer" : "default" }}
                onClick={() => local && onOpenCard(local)}>
                <rect width={g.nw} height={g.nh} rx="9" fill="var(--surface)" stroke={n.done ? "var(--done)" : "var(--warn)"} strokeWidth="1.5" />
                <text x="12" y="19" fontSize="12" fontWeight="600" fill="var(--ink)">{titulo}</text>
                <text x="12" y="35" fontSize="11" fill="var(--ink2)">{n.owner_name} · {n.done ? "terminada" : "pendiente"}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-ink2 text-[13px] mt-1.5">Cada flecha significa "habilita a": si la tarea de origen no está terminada, la de destino queda bloqueada.</p>
    </>
  );
}
