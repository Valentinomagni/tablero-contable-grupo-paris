import { useState } from "react";
import { useObjectives } from "../../hooks/useData";
import { kpiPct, kpiClass } from "../../lib/metrics";
import type { Objective } from "../../lib/types";
import { ObjModal } from "./ObjModal";

const KPI_COLOR: Record<string, string> = {
  "kpi-rojo": "var(--danger)", "kpi-amarillo": "var(--warn)", "kpi-verde": "var(--done)", "kpi-azul": "#3b82c4",
};

export function Objetivos({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const { data: objectives = [] } = useObjectives();
  const [editing, setEditing] = useState<Objective | null | "new">(null);
  const mine = objectives.filter((o) => o.owner === ownerId);
  const total = mine.reduce((s, o) => s + o.weight, 0);
  const banner = total === 100 ? { cls: "bg-accent-soft text-accent", txt: "Los pesos suman 100%" }
    : total > 100 ? { cls: "bg-danger-soft text-danger", txt: `Suman ${total}% — bajá ${total - 100}%` }
    : { cls: "bg-warn-soft text-warn", txt: `Suman ${total}% — falta asignar ${100 - total}%` };

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <div className={`rounded-lg px-4 py-3 font-semibold text-sm mb-3.5 ${banner.cls}`}>{banner.txt}</div>
      {mine.length === 0 && <p className="text-ink2 text-sm">Sin objetivos cargados para {ownerName}.</p>}
      {mine.map((o) => {
        const pct = kpiPct(o), cls = kpiClass(pct);
        return (
          // Botón real: el objetivo se abre con Enter. text-left/w-full lo dejan igual.
          <button type="button" key={o.id} onClick={() => setEditing(o)} className="block text-left w-full bg-surface border border-line rounded-xl px-4 py-3 mb-2.5 cursor-pointer" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
            <div className="flex justify-between items-center gap-2.5">
              <b>{o.title}</b><span className="bg-chip rounded-full px-2.5 py-0.5 font-bold tnum shrink-0">{o.weight}%</span>
            </div>
            {o.description && <span className="block text-ink2 text-sm mt-1.5">{o.description}</span>}
            {o.kpi_name && (
              <>
                <div className="flex justify-between items-center gap-2.5 mt-2 text-sm tnum">
                  <span>{o.kpi_name}: <b>{o.kpi_current}{o.kpi_unit}</b> / {o.kpi_target ?? "?"}{o.kpi_unit}</span>
                  {pct !== null && <span className="font-bold rounded-md px-2" style={{ color: KPI_COLOR[cls], background: "color-mix(in srgb," + KPI_COLOR[cls] + " 15%,transparent)" }}>{pct}%</span>}
                </div>
                {pct !== null && <div className="h-2 bg-surface2 rounded-full mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: KPI_COLOR[cls] }} /></div>}
              </>
            )}
            {o.notes && <span className="block text-ink2 text-sm mt-1.5">{o.notes}</span>}
          </button>
        );
      })}
      <button onClick={() => setEditing("new")}
        className="w-full border border-dashed border-line bg-surface2/50 rounded-xl px-4 py-2.5 text-sm text-ink2 hover:bg-surface2">
        + Añadir objetivo
      </button>
      {editing && (
        <ObjModal obj={editing === "new" ? null : editing} ownerId={ownerId} ownerName={ownerName}
          otherWeight={mine.filter((x) => editing === "new" || x.id !== editing.id).reduce((s, x) => s + x.weight, 0)}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
