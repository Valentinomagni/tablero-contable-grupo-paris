import { useEffect } from "react";
import { useAnnouncements } from "../../hooks/useData";
import { useArca, ArcaAgenda } from "./arca";
import type { Announcement } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";

function useMarkVisto() {
  useEffect(() => { localStorage.setItem("tablon-visto", new Date().toISOString()); }, []);
}

function dueBadge(due: string | null) {
  if (!due) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00"), days = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  const lbl = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const cls = days < 0 ? "bg-danger-soft text-danger" : days <= 5 ? "bg-warn-soft text-warn" : "bg-chip text-ink2";
  const txt = days < 0 ? `Venció ${lbl}` : days === 0 ? "Vence HOY" : `Vence ${lbl} · ${days} d`;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tnum ${cls}`}>{txt}</span>;
}

export function Tablon() {
  useMarkVisto();
  const { data: annos = [] } = useAnnouncements();
  const arca = useArca();
  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const secciones: [Announcement["kind"], string, string][] = [
    ["vencimiento", "📅 Vencimientos y fechas límite", "Hasta estas fechas se puede trabajar cada período."],
    ["aviso", "📢 Avisos y recordatorios", ""],
    ["proceso", "📖 Procesos y criterios unificados", "Cómo hacemos las cosas, por escrito."],
  ];

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      {secciones.map(([kind, titulo, sub]) => {
        let items = annos.filter((a) => a.kind === kind);
        if (kind === "vencimiento") items = [...items].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
        return (
          <div key={kind}>
            <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mt-5 mb-2.5">{titulo}</h2>
            {sub && <p className="text-ink2 text-[13px] -mt-1 mb-2.5">{sub}</p>}
            {items.length === 0 && <p className="text-ink2 text-sm">Nada publicado todavía.</p>}
            {items.map((a) => (
              <div key={a.id} className="bg-surface border border-line rounded-xl px-4 py-3 mb-2" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
                <div className="flex justify-between items-center gap-2.5 flex-wrap">
                  <b>{a.title}</b>{kind === "vencimiento" && dueBadge(a.due_date)}
                </div>
                {a.detail && (kind === "proceso"
                  ? <details className="my-1.5"><summary className="cursor-pointer text-accent text-[13px] font-semibold">Ver procedimiento</summary><p className="text-sm mt-1 whitespace-pre-line">{a.detail}</p></details>
                  : <p className="text-sm my-1.5 whitespace-pre-line">{a.detail}</p>)}
                <span className="text-ink2 text-xs">Publicado por {a.created_by} · {fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        );
      })}

      {arca.length > 0 && <>
        <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mt-5 mb-1">🏛 Agenda ARCA — {mes}</h2>
        <p className="text-ink2 text-[13px] mb-2.5">Vencimientos oficiales por terminación de CUIT. Fuente: arca.gob.ar, se actualiza sola.</p>
        <ArcaAgenda items={arca} />
      </>}
    </div>
  );
}
