import { useState } from "react";
import { Download, ClipboardCopy, Inbox, AlarmClock, CheckCircle2, Activity } from "lucide-react";
import type { Card, Profile, ActivityLog } from "../../lib/types";
import { dueInfo, fmtDateTime } from "../../lib/metrics";
import { isBlocked } from "../../lib/deps";
import { buildCsv, standupText, cicloDelMes, cargaPorFecha, ultimos14 } from "../../lib/resumen";
import { useSnapshots } from "../../hooks/useData";
import { Avatar } from "../../lib/ui";
import { DepGraph } from "./DepGraph";

function Bars({ data, height = 110 }: { data: { lbl: string; v: number; title: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="flex items-end gap-[3px] overflow-x-auto" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} title={d.title} className="flex flex-col items-center justify-end flex-1 min-w-[14px] h-full">
          {d.v > 0 && <span className="text-[10px] text-ink2 tnum">{d.v}</span>}
          <div className="w-full rounded-t-[3px] bg-accent/85 hover:bg-accent transition-colors" style={{ height: `${Math.round((d.v / max) * 82)}%`, minHeight: d.v > 0 ? 2 : 0 }} />
          <span className="text-[9.5px] text-ink2 mt-0.5 whitespace-nowrap">{d.lbl}</span>
        </div>
      ))}
    </div>
  );
}

export function Resumen({ cards, team, activity, onOpenCard, onGoPerson }: {
  cards: Card[]; team: Profile[]; activity: ActivityLog[];
  onOpenCard: (c: Card) => void; onGoPerson: (id: string) => void;
}) {
  const now = Date.now(), day = 86400000, week = now - 7 * day;
  const norm = cards.filter((c) => c.card_type !== "operativa");
  const open = norm.filter((c) => c.status !== "term");
  const late = open.filter((c) => { const i = dueInfo(c); return i && i.days < 0; });
  const doneWeek = norm.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= week)
    .sort((a, b) => new Date(b.done_at!).getTime() - new Date(a.done_at!).getTime());
  const act7 = activity.filter((a) => now - new Date(a.at).getTime() < 7 * day).reduce((s, a) => s + a.qty, 0);
  const nom = (id: string) => team.find((u) => u.id === id)?.name ?? "?";

  // trabadas: no terminadas, vencidas o con última anotación de +2 días
  const stuck = open.filter((c) => {
    const i = dueInfo(c);
    if (i && i.days < 0) return true;
    const last = c.comments[c.comments.length - 1];
    return last && now - new Date(last.when).getTime() > 2 * day;
  });

  const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };
  const { data: snaps = [] } = useSnapshots(true);
  const [copyMsg, setCopyMsg] = useState("");
  const ciclo = cicloDelMes(cards);
  const evol = cargaPorFecha(snaps);
  const d14 = ultimos14(cards, now);
  const cargaPersona = team.map((u) => ({
    n: u.name,
    v: norm.filter((c) => c.owner === u.id && c.status !== "term").reduce((s, c) => s + (c.effort ?? 1), 0),
  })).filter((f) => f.v > 0).sort((a, b) => b.v - a.v);

  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buildCsv(cards, activity, nom)], { type: "text/csv;charset=utf-8" }));
    a.download = `tablero-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const copyStandup = async () => {
    const blockedIds = new Set(cards.filter((c) => isBlocked(c, cards, {})).map((c) => c.id));
    const txt = standupText(cards, activity, nom, blockedIds, now);
    try { await navigator.clipboard.writeText(txt); setCopyMsg("Copiado al portapapeles"); }
    catch { prompt("Copiá el resumen:", txt); }
    setTimeout(() => setCopyMsg(""), 3000);
  };

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <div className="flex gap-2 justify-end mb-2">
        {copyMsg && <span className="text-done text-[13px] self-center">{copyMsg}</span>}
        <button onClick={exportCsv} className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px]">
          <Download size={14} /> Exportar CSV</button>
        <button onClick={copyStandup} className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px]">
          <ClipboardCopy size={14} /> Copiar resumen del día</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {([["Tareas abiertas", open.length, <Inbox key="i" size={15} />, false],
           ["Vencidas", late.length, <AlarmClock key="a" size={15} />, late.length > 0],
           ["Terminadas (7 d)", doneWeek.length, <CheckCircle2 key="c" size={15} />, false],
           ["Actividad op. (7 d)", act7, <Activity key="t" size={15} />, false]] as const).map(([l, v, ic, alert]) => (
          <div key={l} className="bg-surface border border-line rounded-2xl px-5 py-4" style={cardSh}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-ink2 uppercase tracking-[0.08em] font-semibold">{l}</span>
              <span className={`grid place-items-center w-7 h-7 rounded-lg ${alert ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}>{ic}</span>
            </div>
            <b className={`block text-[32px] leading-none font-bold tracking-[-0.02em] tnum ${alert ? "text-danger" : ""}`}>{v}</b>
          </div>
        ))}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Equipo</h2>
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6" style={cardSh}>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-ink2">
            <th className="text-left px-3 py-2.5">Persona</th><th className="px-3 py-2.5">Pend.</th><th className="px-3 py-2.5">En proc.</th>
            <th className="px-3 py-2.5">Term. (7d)</th><th className="px-3 py-2.5">Esf. (7d)</th><th className="text-left px-3 py-2.5">Tarea más vieja</th>
          </tr></thead>
          <tbody>
            {team.map((u) => {
              const his = norm.filter((c) => c.owner === u.id);
              const hisOpen = his.filter((c) => c.status !== "term");
              const oldest = hisOpen.reduce<Card | null>((m, c) => (!m || c.created_at < m.created_at ? c : m), null);
              const oldDays = oldest ? Math.floor((now - new Date(oldest.created_at).getTime()) / day) : null;
              const ef = his.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= week).reduce((s, c) => s + (c.effort ?? 1), 0);
              return (
                <tr key={u.id} onClick={() => onGoPerson(u.id)} className="border-t border-line cursor-pointer hover:bg-surface2 tnum">
                  <td className="px-3 py-2.5 flex items-center gap-2"><Avatar name={u.name} size={22} /><b>{u.name}</b> <span className="text-ink2 text-xs capitalize">{u.role}</span></td>
                  <td className="px-3 py-2.5 text-center">{his.filter((c) => c.status === "pend").length}</td>
                  <td className="px-3 py-2.5 text-center">{his.filter((c) => c.status === "proc").length}</td>
                  <td className="px-3 py-2.5 text-center">{his.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= week).length}</td>
                  <td className="px-3 py-2.5 text-center">{ef}</td>
                  <td className="px-3 py-2.5 text-ink2 text-[13px]">{oldest ? `${oldest.title.slice(0, 22)} (${oldDays} d)` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Tareas trabadas o vencidas</h2>
      {stuck.length === 0 ? <p className="text-ink2 text-sm mb-6">Nada trabado.</p>
        : stuck.map((c) => {
          const i = dueInfo(c), last = c.comments[c.comments.length - 1];
          return (
            <div key={c.id} onClick={() => onOpenCard(c)} className="bg-surface border-l-[3px] border-danger rounded-lg px-3.5 py-2.5 mb-2 cursor-pointer" style={cardSh}>
              <b>{c.title}</b> <span className="text-ink2 text-xs">· {nom(c.owner)}</span>
              {i && i.days < 0 && <span className="ml-2 bg-danger-soft text-danger rounded-md px-2 py-0.5 text-xs font-semibold">Venció {i.lbl}</span>}
              {last && <p className="text-sm mt-1.5 mb-0">"{last.txt}" <span className="text-ink2 text-xs">— {last.who}, {fmtDateTime(last.when)}</span></p>}
            </div>
          );
        })}

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Ritmo de cierre — últimos 14 días (tareas cerradas)</h2>
      <div className="bg-surface border border-line rounded-xl p-3 mb-6" style={cardSh}>
        <Bars data={d14.map((d) => ({ lbl: d.lbl.slice(0, 5), v: d.count, title: `${d.lbl}: ${d.count} tarea(s) · ${d.effort} punto(s)` }))} />
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Ciclo del mes — en qué días se concentra el trabajo (histórico)</h2>
      <div className="bg-surface border border-line rounded-xl p-3 mb-2" style={cardSh}>
        {ciclo.total === 0 ? <p className="text-ink2 text-sm m-0">Todavía no hay historial de cierres suficiente.</p>
          : <>
            <Bars data={ciclo.porDia.map((v, i) => ({ lbl: (i + 1) % 5 === 0 || i === 0 ? String(i + 1) : "", v, title: `Día ${i + 1}: ${v} puntos acumulados` }))} />
            <p className="text-sm mt-2 mb-0">{ciclo.insight}</p>
          </>}
      </div>

      {evol.length >= 2 && (
        <>
          <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Evolución de la carga abierta del equipo (esfuerzo por día)</h2>
          <div className="bg-surface border border-line rounded-xl p-3 mb-2" style={cardSh}>
            <Bars data={evol.map((e) => ({ lbl: String(new Date(e.day + "T00:00:00").getDate()), v: e.v, title: `${e.day.split("-").reverse().join("/")}: ${e.v} puntos abiertos` }))} />
            <p className="text-ink2 text-[13px] mt-2 mb-0">Si la barra crece día a día, entra más trabajo del que se cierra; si baja, el equipo está liberando carga.</p>
          </div>
        </>
      )}

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Carga abierta por persona — en esfuerzo (puntos)</h2>
      <div className="bg-surface border border-line rounded-xl p-3 mb-6" style={cardSh}>
        {cargaPersona.length === 0 ? <p className="text-ink2 text-sm m-0">Sin carga abierta.</p>
          : cargaPersona.map((f) => (
            <div key={f.n} title={`${f.n}: ${f.v} puntos de esfuerzo abiertos`} className="flex items-center gap-2 py-1">
              <span className="w-[110px] text-[13px] truncate shrink-0">{f.n}</span>
              <div className="flex-1 h-3 bg-surface2 rounded-full overflow-hidden">
                <div className="h-full bg-accent/70 rounded-full" style={{ width: `${Math.round((f.v / cargaPersona[0].v) * 100)}%` }} />
              </div>
              <span className="text-[13px] tnum w-6 text-right">{f.v}</span>
            </div>
          ))}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Cadenas de dependencias entre tareas</h2>
      <div className="bg-surface border border-line rounded-xl p-3 mb-6" style={cardSh}>
        <DepGraph cards={cards} team={team} onOpenCard={onOpenCard} />
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5 mt-6">Terminadas los últimos 7 días</h2>
      {doneWeek.length === 0 ? <p className="text-ink2 text-sm">Todavía nada esta semana.</p>
        : doneWeek.slice(0, 20).map((c) => (
          <div key={c.id} onClick={() => onOpenCard(c)} className="bg-surface border border-line rounded-lg px-3.5 py-2 mb-1.5 cursor-pointer text-sm" style={cardSh}>
            <b>{c.title}</b> <span className="text-ink2 text-xs">· {nom(c.owner)} · {fmtDateTime(c.done_at)}</span>
          </div>
        ))}
    </div>
  );
}
