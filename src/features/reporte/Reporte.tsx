import { Download } from "lucide-react";
import type { Card, Profile, ActivityLog } from "../../lib/types";
import { dueInfo, saludScore } from "../../lib/metrics";
import { Donut, Gauge, Legend, type Seg } from "../../components/charts";
import { Avatar } from "../../lib/ui";

// Paleta categórica SOLO para el donut de personas: la marca es monocroma, pero acá
// necesitamos distinguir de un vistazo quién concentra la carga. Tonos sobrios, no chillones.
const CAT = ["#4f7cff", "#e6892b", "#12a67a", "#d9455f", "#8b5cf6", "#0891b2", "#c026d3", "#65a30d"];

export function Reporte({ cards, team, activity }: { cards: Card[]; team: Profile[]; activity: ActivityLog[] }) {
  const now = Date.now(), day = 86400000, mes = now - 30 * day;
  const norm = cards.filter((c) => c.card_type !== "operativa");
  const abiertas = norm.filter((c) => c.status !== "term");
  const term30 = norm.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= mes);
  const vencidas = abiertas.filter((c) => { const i = dueInfo(c); return i && i.days < 0; });
  const bloqueadas = abiertas.filter((c) => (c.deps ?? []).some((id) => { const d = cards.find((x) => x.id === id); return d && d.status !== "term"; }) && c.status !== "term");
  const actMes = activity.filter((a) => new Date(a.at).getTime() >= mes).reduce((s, a) => s + a.qty, 0);

  const conVto = term30.filter((c) => c.due_date);
  const aTiempo = conVto.filter((c) => c.done_at && new Date(c.done_at) <= new Date(c.due_date + "T23:59:59"));
  const pctTiempo = conVto.length ? Math.round((aTiempo.length / conVto.length) * 100) : null;
  const total = abiertas.length + term30.length;
  const pctAvance = total ? Math.round((term30.length / total) * 100) : 0;
  const salud = saludScore(abiertas, term30);
  const saludColor = salud >= 75 ? "var(--done)" : salud >= 50 ? "var(--warn)" : "var(--danger)";
  const saludTxt = salud >= 75 ? "Saludable" : salud >= 50 ? "Atención" : "Crítico";

  const estSegs: Seg[] = [
    { label: "Pendiente", val: norm.filter((c) => c.status === "pend").length, color: "var(--naranja)" },
    { label: "En proceso", val: norm.filter((c) => c.status === "proc").length, color: "var(--s1)" },
    { label: "Terminado", val: norm.filter((c) => c.status === "term").length, color: "var(--done)" },
  ];
  const personaSegs: Seg[] = team.map((u) => ({ label: u.name, val: abiertas.filter((c) => c.owner === u.id).length, color: "" }))
    .filter((s) => s.val > 0).sort((a, b) => b.val - a.val)
    .map((s, i) => ({ ...s, color: CAT[i % CAT.length] }));

  const rank = team.map((u) => ({
    u, ef: term30.filter((c) => c.owner === u.id).reduce((s, c) => s + (c.effort ?? 1), 0),
    n: term30.filter((c) => c.owner === u.id).length,
    act: activity.filter((a) => a.owner === u.id && new Date(a.at).getTime() >= mes).reduce((s, a) => s + a.qty, 0),
  })).sort((a, b) => b.ef - a.ef);
  const maxEf = Math.max(1, ...rank.map((r) => r.ef));

  const card = "bg-surface rounded-2xl p-[18px]";
  const cardSh = { boxShadow: "var(--ring),var(--shadow)" };

  return (
    <div className="px-6 py-4 w-full max-w-[940px] flex flex-col gap-4" id="reporte-print">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight m-0">Reporte ejecutivo — Equipo Contable</h1>
          <p className="text-ink2 text-sm m-0">Generado {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })} · últimos 30 días</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]" style={cardSh}>
          <Download size={16} /> Imprimir / PDF
        </button>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {([["Salud del equipo", <Gauge key="g" pct={salud} color={saludColor} />, <b style={{ color: saludColor }}>{saludTxt}</b>],
          ["Avance del período", <Gauge key="g" pct={pctAvance} color="var(--s1)" />, <b>{term30.length}/{total} tareas</b>],
          ["Entregado a tiempo", <Gauge key="g" pct={pctTiempo ?? 0} color={(pctTiempo ?? 0) >= 80 ? "var(--done)" : "var(--warn)"} />, <b>{pctTiempo !== null ? pctTiempo + "%" : "sin datos"}</b>]] as const)
          .map(([l, g, b], i) => (
            <div key={i} className="bg-surface rounded-2xl p-4 flex flex-col items-center gap-1.5" style={cardSh}>
              <span className="text-[11.5px] uppercase tracking-wide text-ink2">{l}</span>{g}<span className="text-[15px] font-semibold">{b}</span>
            </div>
          ))}
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
        {([["Vencidas", vencidas.length, vencidas.length ? "border-l-danger" : "border-l-done"],
          ["Bloqueadas", bloqueadas.length, bloqueadas.length ? "border-l-warn" : "border-l-done"],
          ["Abiertas", abiertas.length, "border-l-line"], ["Cerradas (30d)", term30.length, "border-l-line"],
          ["Actividad op.", actMes, "border-l-line"], ["Personas", team.filter((u) => u.role !== "jefe").length, "border-l-line"]] as const)
          .map(([l, v, b], i) => (
            <div key={i} className={`bg-surface rounded-[14px] px-4 py-3.5 border-l-[3px] ${b}`} style={cardSh}>
              <b className="block text-2xl font-bold tracking-tight tnum">{v}</b>
              <span className="text-[11.5px] text-ink2 uppercase tracking-wide">{l}</span>
            </div>
          ))}
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Tareas por estado</h3>
          <div className="flex items-center gap-[18px] flex-wrap"><Donut segs={estSegs} centerTop={`${norm.length}`} centerBot="tareas" /><Legend segs={estSegs} /></div>
        </div>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Carga abierta por persona</h3>
          <div className="flex items-center gap-[18px] flex-wrap"><Donut segs={personaSegs} centerTop={`${abiertas.length}`} centerBot="abiertas" />
            {personaSegs.length ? <Legend segs={personaSegs.slice(0, 6)} /> : <span className="text-ink2 text-sm">Sin carga abierta.</span>}</div>
        </div>
      </div>

      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Ranking de productividad (esfuerzo cerrado, 30 días)</h3>
        {rank.filter((r) => r.ef > 0 || r.act > 0).map((r, i) => (
          <div key={r.u.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
            <span className="w-5 text-center font-bold text-ink2 tnum">{i + 1}</span><Avatar name={r.u.name} size={26} />
            <span className="w-[170px] shrink-0 truncate">{r.u.name} <span className="text-ink2 capitalize">{r.u.role}</span></span>
            <div className="flex-1 h-[9px] bg-surface2 rounded-full overflow-hidden min-w-[60px]"><div className="h-full rounded-full" style={{ width: `${Math.round((r.ef / maxEf) * 100)}%`, background: "linear-gradient(90deg,var(--s1),var(--accent))" }} /></div>
            <span className="shrink-0 tnum font-semibold text-[13px]">{r.ef} pts <span className="text-ink2 font-normal">· {r.n} tareas{r.act ? ` · ${r.act} op.` : ""}</span></span>
          </div>
        ))}
        {rank.every((r) => r.ef === 0 && r.act === 0) && <p className="text-ink2 text-sm">Sin actividad en el período.</p>}
      </div>
    </div>
  );
}
