import { useEffect, useState } from "react";
import { useAnnouncements } from "../../hooks/useData";
import type { Announcement } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";

interface ArcaItem { num: number; dia: string; titulo: string; sub: string; rows: { term: string; fecha: string }[]; }

function useArca() {
  const [items, setItems] = useState<ArcaItem[]>([]);
  useEffect(() => {
    (async () => {
      for (const url of ["/arca-xml", "https://www.arca.gob.ar/vencimientos/xml/vencimientos.xml"]) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const xml = new DOMParser().parseFromString(await r.text(), "text/xml");
          const parsed = [...xml.getElementsByTagName("item")].map((it) => {
            const g = (t: string) => it.getElementsByTagName(t)[0]?.textContent ?? "";
            const html = new DOMParser().parseFromString(g("descripcion"), "text/html");
            const sub = (html.body.textContent ?? "").trim().split("\n")[0].trim();
            const rows = [...html.querySelectorAll("tr")].slice(1).map((tr) => {
              const td = tr.querySelectorAll("td");
              return { term: td[0]?.textContent?.trim() ?? "", fecha: td[1]?.textContent?.trim() ?? "" };
            }).filter((r) => r.term);
            return { num: parseInt(g("numero"), 10) || 0, dia: g("dia"), titulo: g("titulo").trim(), sub, rows };
          }).filter((x) => x.titulo).sort((a, b) => a.num - b.num);
          setItems(parsed); break;
        } catch { /* siguiente url */ }
      }
    })();
  }, []);
  return items;
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
        {arca.map((x, i) => (
          <details key={i} className="bg-surface border border-line rounded-xl mb-2 overflow-hidden" style={{ boxShadow: "var(--ring-sh)" }}>
            <summary className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer list-none hover:bg-surface2">
              <span className="w-[46px] rounded-[9px] overflow-hidden text-center shrink-0 border border-[#0b0b0d]">
                <span className="block bg-[#0b0b0d] text-white text-[9px] tracking-widest py-[2.5px] font-bold">{x.dia.toUpperCase()}</span>
                <span className="block text-lg py-0.5 bg-white text-[#0b0b0d] tnum font-semibold">{x.num}</span>
              </span>
              <span className="flex-1 min-w-0"><b className="block text-sm">{x.titulo}</b><span className="block text-xs text-ink2 truncate">{x.sub}</span></span>
            </summary>
            <table className="w-full text-[13px]"><tbody>
              <tr><th className="text-left px-4 py-[7px] text-[11px] uppercase text-ink2 border-t border-line">Terminación de CUIT</th><th className="text-left px-4 py-[7px] text-[11px] uppercase text-ink2 border-t border-line">Fecha</th></tr>
              {x.rows.map((r, j) => <tr key={j}><td className="px-4 py-[7px] border-t border-line tnum">{r.term}</td><td className="px-4 py-[7px] border-t border-line tnum">{r.fecha}</td></tr>)}
            </tbody></table>
          </details>
        ))}
      </>}
    </div>
  );
}
