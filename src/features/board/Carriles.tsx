import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Card, Profile, Status } from "../../lib/types";
import { carrilesPorGrupo, type ModoAgrupar } from "../../lib/agrupar";
import { cn } from "../../lib/ui";
import { getPref, setPref, PREF } from "../../lib/prefs";

const DOT: Record<string, string> = { pend: "bg-naranja", proc: "bg-s1", term: "bg-done" };
const colBg = { background: "color-mix(in srgb,var(--surface2) 55%,var(--bg))" };

function leerColapsados(): string[] {
  try {
    const v = JSON.parse(getPref(PREF.carrilesColapsados) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

// Carriles horizontales por grupo, que atraviesan las tres columnas de estado.
// La jerarquía es grupo → estado (y no estado → grupo como antes): así la agrupación
// deja de depender del estado. Ver carrilesPorGrupo en lib/agrupar.ts.
export function Carriles({ cards, modo, profiles, columnas, renderCard, contarPor, onDropCard }: {
  cards: Card[];
  modo: ModoAgrupar;
  profiles: Profile[];
  columnas: readonly (readonly [Status, string])[];
  renderCard: (c: Card) => ReactNode;
  contarPor?: (c: Card) => Status;
  onDropCard: (id: string, status: Status) => void;
}) {
  const [colapsados, setColapsados] = useState<string[]>(leerColapsados);
  const toggle = (g: string) => setColapsados((prev) => {
    const next = prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g];
    setPref(PREF.carrilesColapsados, JSON.stringify(next));
    return next;
  });

  // Grupos estables: el orden y la presencia de los carriles salen de agrupar el
  // conjunto COMPLETO de cards, nunca de cuántas cards tenga cada estado. Un grupo
  // con todas las tareas terminadas se sigue mostrando, con las columnas
  // pendiente/en proceso vacías, y una card que cambia de estado se mueve de columna
  // sin salir de su carril.
  const carriles = useMemo(
    () => carrilesPorGrupo(cards, modo, columnas.map(([k]) => k), {
      profiles,
      estadoDe: contarPor,
    }),
    [cards, modo, columnas, profiles, contarPor],
  );

  const dropProps = (k: Status) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-accent"); },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("ring-2", "ring-accent"),
    onDrop: (e: React.DragEvent) => {
      e.currentTarget.classList.remove("ring-2", "ring-accent");
      const id = e.dataTransfer.getData("text/plain");
      if (id) onDropCard(id, k);
    },
  });

  const totalPorEstado = (k: Status) =>
    carriles.reduce((s, c) => s + (c.porEstado[k]?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex gap-5">
        {columnas.map(([k, lbl]) => (
          <h2 key={k} className="min-w-[290px] w-[290px] shrink-0 text-xs uppercase tracking-wider text-ink2 px-3 flex items-center gap-2 font-semibold">
            <i className={cn("w-2 h-2 rounded-full", DOT[k])} />{lbl}
            <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{totalPorEstado(k)}</span>
          </h2>
        ))}
      </div>

      {carriles.map((carril) => {
        const cerrado = colapsados.includes(carril.grupo);
        return (
          <div key={carril.grupo} className="rounded-2xl border border-line/60 p-3" style={colBg}>
            <button onClick={() => toggle(carril.grupo)} title={cerrado ? "Expandir carril" : "Colapsar carril"}
              className="w-full flex items-center gap-1.5 text-[13px] font-semibold px-1 py-1 hover:text-accent transition">
              {cerrado ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
              <span className="truncate tracking-tight">{carril.grupo}</span>
              <span className="bg-chip rounded-full px-2 py-0.5 text-xs text-ink2 tnum">{carril.total}</span>
            </button>
            {!cerrado && (
              <div className="flex gap-5 items-start mt-2">
                {columnas.map(([k]) => (
                  <div key={k} {...dropProps(k)}
                    className="min-w-[290px] w-[290px] shrink-0 rounded-xl p-2 min-h-[64px] border border-line/40">
                    {(carril.porEstado[k] ?? []).map(renderCard)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
