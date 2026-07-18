import { Download } from "lucide-react";
import type { Card, Profile, ActivityLog } from "../../lib/types";
import { dueInfo, saludScore } from "../../lib/metrics";
import { Donut, Gauge, Legend, type Seg } from "../../components/charts";
import { Avatar } from "../../lib/ui";
import { useSnapshots } from "../../hooks/useData";
import { utilizacionEquipo } from "../../lib/ociosidad";
import { useArqueoStats } from "../../hooks/useArqueo";

// Semáforo del cumplimiento de arqueo (SOLO sobre el número, marca monocroma).
const colorArqueo = (pct: number) => (pct >= 98 ? "var(--done)" : pct >= 95 ? "var(--warn)" : "var(--danger)");
const mesActualPrefix = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// Paleta categórica del donut de personas: escala de GRISES (marca monocroma).
// El segmento mayor lleva el acento; el resto, grises distinguibles entre sí.
const CAT = ["#3f3f46", "#a1a1aa", "#71717a", "#d4d4d8", "#52525b", "#8b8b93"];

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
  const saludTxt = salud >= 75 ? "Saludable" : salud >= 50 ? "Atención" : "Crítico";
  // Métrica única → gris; el color de estado queda SOLO en el texto del veredicto cuando es negativo.
  const saludTxtColor = salud >= 75 ? undefined : salud >= 50 ? "var(--warn)" : "var(--danger)";

  const estSegs: Seg[] = [
    { label: "Pendiente", val: norm.filter((c) => c.status === "pend").length, color: "var(--ink2)" },
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

  // Utilización del tiempo (planificación de carga): últimos 30 días hasta hoy, días hábiles.
  const snaps = useSnapshots(true).data ?? [];
  const hastaISO = new Date(now).toISOString().slice(0, 10);
  const desdeISO = new Date(now - 30 * day).toISOString().slice(0, 10);
  const util = utilizacionEquipo(team.filter((u) => u.role !== "jefe"), cards, activity, snaps, desdeISO, hastaISO);

  // Controles de caja (arqueo) — cumplimiento del mes actual por card de control (P1).
  const arqueo = useArqueoStats(cards, mesActualPrefix());

  const card = "bg-surface rounded-2xl p-[18px]";
  const cardSh = { boxShadow: "var(--ring),var(--shadow)" };

  return (
    <div className="px-6 py-4 w-full max-w-[940px] flex flex-col gap-4" id="reporte-print">
      {/* Al imprimir/PDF: ocultamos sidebar/topbar/botones y mostramos un encabezado con la marca (P5) */}
      <style>{`
        .rep-print-header { display: none; }
        @media print {
          aside, .no-print, #reporte-print button { display: none !important; }
          body { background: #fff !important; }
          #reporte-print { max-width: 100% !important; padding: 0 !important; }
          #reporte-print .rep-print-header { display: flex !important; }
        }
      `}</style>
      <div className="rep-print-header items-center gap-3 pb-3 mb-1 border-b border-line">
        <img src="/brand/isotipo-negro.svg" width={38} height={38} alt="Grupo Paris" />
        <div className="leading-tight">
          <b className="text-lg">Grupo Paris</b>
          <div className="text-ink2 text-xs">Reporte ejecutivo — Equipo Contable · {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight m-0">Reporte ejecutivo — Equipo Contable</h1>
          <p className="text-ink2 text-sm m-0">Generado {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })} · últimos 30 días</p>
        </div>
        <button onClick={() => window.print()} className="no-print flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]" style={cardSh}>
          <Download size={16} /> Imprimir / PDF
        </button>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {([["Salud del equipo", <Gauge key="g" pct={salud} color="var(--s1)" />, <b style={{ color: saludTxtColor }}>{saludTxt}</b>],
          ["Avance del período", <Gauge key="g" pct={pctAvance} color="var(--s1)" />, <b>{term30.length}/{total} tareas</b>],
          ["Entregado a tiempo", <Gauge key="g" pct={pctTiempo ?? 0} color="var(--s1)" />, <b>{pctTiempo !== null ? pctTiempo + "%" : "sin datos"}</b>]] as const)
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

      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Utilización del tiempo (30 días)</h3>
        {util.length ? util.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
            <Avatar name={p.name} size={26} />
            <span className="w-[170px] shrink-0 truncate">{p.name}</span>
            <div className="flex-1 h-[9px] bg-surface2 rounded-full overflow-hidden min-w-[60px]"><div className="h-full rounded-full" style={{ width: `${Math.round(p.indice * 100)}%`, background: "var(--s1)" }} /></div>
            <span className="shrink-0 tnum font-semibold text-[13px] w-[44px] text-right">{Math.round(p.indice * 100)}%</span>
            <span className="shrink-0 text-ink2 text-[12px] w-[150px] text-right">{p.diasSinActividad} días sin actividad registrada</span>
          </div>
        )) : <p className="text-ink2 text-sm">Sin datos de utilización.</p>}
        <p className="text-[11px] text-ink2 mt-3">Indicador de planificación de carga — no mide presencia ni productividad individual</p>
      </div>

      {arqueo.length > 0 && (
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Controles de caja (arqueo)</h3>
          {arqueo.map(({ card: c, stats }) => {
            const owner = team.find((u) => u.id === c.owner);
            return (
              <div key={c.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
                {owner && <Avatar name={owner.name} size={26} />}
                <span className="flex-1 min-w-0 truncate">{c.title} <span className="text-ink2">· {owner?.name ?? "Sin responsable"}</span></span>
                <span className="shrink-0 tnum font-semibold text-[15px] w-[64px] text-right" style={{ color: colorArqueo(stats.pctOk) }}>{stats.pctOk}%</span>
                <span className="shrink-0 text-ink2 text-[12px] w-[140px] text-right">{stats.ok}/{stats.total} sin diferencias</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
