import { useEffect, useState } from "react";

// Agenda ARCA: feed XML oficial vía proxy Netlify (/arca-xml → arca.gob.ar).
// En local falla por CORS y la sección se oculta sola.
export interface ArcaItem { num: number; dia: string; titulo: string; sub: string; rows: { term: string; fecha: string }[]; }

export function useArca() {
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

export function ArcaAgenda({ items }: { items: ArcaItem[] }) {
  return (
    <>
      {items.map((x, i) => (
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
    </>
  );
}
