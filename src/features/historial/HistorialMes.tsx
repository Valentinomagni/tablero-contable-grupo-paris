import { useState } from "react";
import { Archive, MessageSquare } from "lucide-react";
import { useArchive } from "../../hooks/useArchive";
import { mesesDisponibles, cardsDeArchivo, mesLabel } from "../../lib/archivo";
import { fmtDateTime } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import { SkeletonVista } from "../../components/Skeleton";

// Historial mensual por empleado (spec 21, item 9): lectura de los snapshots
// de cards_archive. TODO es READ-ONLY — acá no se edita ni se borra nada.
const ESTADOS: Record<string, { lbl: string; dot: string }> = {
  pend: { lbl: "Pendiente", dot: "bg-ink2" },
  proc: { lbl: "En proceso", dot: "bg-accent" },
  term: { lbl: "Terminada", dot: "bg-done" },
};

export function HistorialMes({ ownerId }: { ownerId: string }) {
  const { data: archives = [], isLoading } = useArchive(ownerId);
  const meses = mesesDisponibles(archives);
  const [mesSel, setMesSel] = useState<string | null>(null);
  const mes = mesSel && meses.includes(mesSel) ? mesSel : meses[0];

  // La última pantalla que usaba la palabra prohibida (hallazgo 9 de la auditoría del 05/08).
  // El aviso de novedades de la v2.9.0 —que sigue visible— promete que ya no existe en ningún
  // lado: mientras esta línea decía "Cargando historial…", el changelog mentía.
  if (isLoading) return <div className="px-6 py-8"><SkeletonVista /></div>;

  if (meses.length === 0) {
    return (
      <div className="px-6 py-14 text-center text-ink2">
        <Archive size={28} className="mx-auto mb-3 opacity-60" />
        <p className="text-sm m-0">Todavía no hay meses archivados.</p>
        <p className="text-sm m-0 mt-1">El jefe archiva el mes desde Administración.</p>
      </div>
    );
  }

  const cards = cardsDeArchivo(archives, mes);

  return (
    <div className="px-6 py-4 w-full max-w-[760px]">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {meses.map((m) => (
          <button key={m} onClick={() => setMesSel(m)}
            className={cn("rounded-full px-3.5 py-1.5 text-sm border capitalize transition",
              m === mes ? "bg-accent-soft border-accent text-accent font-semibold" : "bg-surface2 border-line text-ink2")}>
            {mesLabel(m)}
          </button>
        ))}
      </div>

      <p className="text-ink2 text-xs mb-3">
        Foto de <span className="capitalize">{mesLabel(mes)}</span> · {cards.length} {cards.length === 1 ? "tarea" : "tareas"} · solo lectura
      </p>

      {cards.map((c) => {
        const est = ESTADOS[c.status] ?? ESTADOS.pend;
        return (
          <div key={c.id} className="bg-surface border border-line rounded-xl p-4 mb-2.5" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("w-2 h-2 rounded-full shrink-0", est.dot)} />
              <b className="text-sm">{c.title}</b>
              <span className="text-ink2 text-xs">{est.lbl}</span>
              {c.categoria && <span className="bg-chip rounded-full px-2 py-0.5 text-2xs">{c.categoria}</span>}
              <span className="ml-auto text-ink2 text-xs tnum">
                {c.due_date && <>vencía el {c.due_date}</>}
                {c.due_date && c.done_at && " · "}
                {c.done_at && <>terminada el {fmtDateTime(c.done_at)}</>}
              </span>
            </div>
            {c.checklist.length > 0 && (
              <div className="mt-2.5">
                {c.checklist.map((i, n) => (
                  <label key={n} className="flex items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" checked={i.done} readOnly disabled className="accent-accent w-3.5 h-3.5 shrink-0" />
                    <span className={i.done ? "line-through text-ink2" : ""}>{i.txt}</span>
                  </label>
                ))}
              </div>
            )}
            {c.comments.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-ink2 flex items-center gap-1.5">
                  <MessageSquare size={12} /> Observaciones ({c.comments.length})
                </summary>
                {c.comments.map((m, n) => (
                  <div key={n} className="bg-surface2 rounded-lg px-2.5 py-2 mt-1.5">
                    <div className="text-xs font-semibold">{m.who} <span className="font-normal text-ink2 tnum">· {fmtDateTime(m.when)}</span></div>
                    <p className="m-0 mt-0.5">{m.txt}</p>
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })}
      {cards.length === 0 && <p className="text-ink2 text-sm">No hay tareas archivadas en este mes para esta persona.</p>}
    </div>
  );
}

export default HistorialMes;
