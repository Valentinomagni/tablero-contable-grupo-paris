import { useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { useAnnouncements } from "../../hooks/useData";
import { useArca, ArcaAgenda } from "./arca";
import type { Announcement } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";
import { PREF, setPref } from "../../lib/prefs";
import { estadoVencimiento, ordenarVencimientos, CLS_TONO } from "../../lib/vencimientos";

function useMarkVisto() {
  useEffect(() => { setPref(PREF.tablon, new Date().toISOString()); }, []);
}

function dueBadge(due: string | null) {
  const e = estadoVencimiento(due, new Date());
  if (!e) return null;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tnum ${CLS_TONO[e.tono]}`}>{e.txt}</span>;
}

export function Tablon({ onGoCalendario }: { onGoCalendario?: () => void }) {
  useMarkVisto();
  const { data: annos = [] } = useAnnouncements();
  const arca = useArca();
  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const secciones: [Announcement["kind"], string, string][] = [
    ["vencimiento", "Vencimientos y fechas límite", "Hasta estas fechas se puede trabajar cada período."],
    ["aviso", "Avisos y recordatorios", ""],
    ["proceso", "Procesos y criterios unificados", "Cómo hacemos las cosas, por escrito."],
  ];

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      {secciones.map(([kind, titulo, sub]) => {
        const items = kind === "vencimiento" ? ordenarVencimientos(annos) : annos.filter((a) => a.kind === kind);
        return (
          <div key={kind}>
            <div className="flex items-center gap-3 mt-5 mb-2.5">
              <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink m-0">{titulo}</h2>
              {kind === "vencimiento" && onGoCalendario && (
                <button onClick={onGoCalendario}
                  className="flex items-center gap-1 text-accent text-[12px] font-semibold hover:underline">
                  <CalendarDays size={13} /> Ver en calendario
                </button>
              )}
            </div>
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
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mt-5 mb-1">Agenda ARCA — {mes}</h2>
        <p className="text-ink2 text-[13px] mb-2.5">Vencimientos oficiales por terminación de CUIT. Fuente: arca.gob.ar, se actualiza sola.</p>
        <ArcaAgenda items={arca} />
      </>}
    </div>
  );
}
