import type { Card, ActivityLog } from "../../lib/types";
import { dueInfo } from "../../lib/metrics";

export function MiMes({ cards, activity, ownerId, onOpenCard }: {
  cards: Card[]; activity: ActivityLog[]; ownerId: string; onOpenCard: (c: Card) => void;
}) {
  const hoy = new Date();
  const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const pctMes = Math.round((hoy.getDate() / finMes.getDate()) * 100);

  const mias = cards.filter((c) => c.owner === ownerId && c.card_type !== "operativa");
  const cerradasMes = mias.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at) >= iniMes);
  const abiertas = mias.filter((c) => c.status !== "term");
  const totalMes = cerradasMes.length + abiertas.length;
  const pctAvance = totalMes ? Math.round((cerradasMes.length / totalMes) * 100) : 0;
  const efCerrado = cerradasMes.reduce((s, c) => s + (c.effort ?? 1), 0);
  const efAbierto = abiertas.reduce((s, c) => s + (c.effort ?? 1), 0);
  const actMes = activity.filter((a) => a.owner === ownerId && new Date(a.at) >= iniMes).reduce((s, a) => s + a.qty, 0);
  const alDia = pctAvance >= pctMes;

  const byId = (id: string) => cards.find((x) => x.id === id);
  const isBlocked = (c: Card) => c.status !== "term" && (c.deps ?? []).some((id) => (byId(id)?.status ?? "term") !== "term");
  const razones = (c: Card): string[] => {
    const r: string[] = []; const i = dueInfo(c);
    if (isBlocked(c)) r.push("⛓ bloqueada — reclamá la previa");
    if (i && i.days < 0) r.push("🔴 vencida");
    else if (i && i.days <= 3) r.push(`🟡 vence en ${i.days} día${i.days === 1 ? "" : "s"}`);
    if (cards.some((x) => (x.deps ?? []).includes(c.id) && x.status !== "term")) r.push("⏳ otros esperan esta tarea");
    if (c.priority === "alta") r.push("▲ prioridad alta");
    if ((c.effort ?? 1) === 1 && c.status === "pend") r.push("⚡ rápida de sacar");
    return r;
  };
  const score = (c: Card) => { const r = razones(c); const w = { "⛓": 90, "🔴": 0, "🟡": 1, "⏳": 2, "▲": 3, "⚡": 5 }; return r.length ? Math.min(...r.map((x) => (w as Record<string, number>)[x[0]] ?? 9)) : 9; };
  const sugeridas = abiertas.map((c) => ({ c, r: razones(c), s: score(c) })).sort((a, b) => a.s - b.s).slice(0, 5);

  const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <div className="flex gap-2.5 flex-wrap mb-4">
        {([["Cerradas este mes", `${cerradasMes.length}/${totalMes}`], ["Esfuerzo cerrado", efCerrado], ["Esfuerzo por delante", efAbierto], ...(actMes ? [["Actividad op. del mes", actMes] as const] : [])] as const).map(([l, v]) => (
          <div key={l} className="bg-surface rounded-2xl px-[18px] py-3.5" style={cardSh}>
            <b className="block text-[26px] font-bold tracking-tight tnum">{v}</b>
            <span className="text-[11.5px] text-ink2 uppercase tracking-wide">{l}</span>
          </div>
        ))}
      </div>

      <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Avance del mes</h2>
      <div className={`bg-surface rounded-2xl p-[18px] mb-6 border-l-[3px] ${alDia ? "border-done" : "border-warn"}`} style={cardSh}>
        <Bar label="Mes transcurrido" pct={pctMes} color="var(--ink2)" />
        <Bar label="Tareas cerradas" pct={pctAvance} color={alDia ? "var(--done)" : "var(--warn)"} />
        <p className="text-sm mt-1.5 mb-0">{alDia ? "✔ Vas al día: cerraste más de lo que corrió el mes." : "⚠ El mes avanza más rápido que los cierres — mirá las sugeridas de abajo."}</p>
      </div>

      <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">¿Qué conviene hacer ahora?</h2>
      {sugeridas.length === 0 ? <p className="text-ink2 text-sm">Sin tareas abiertas. 🎉</p>
        : sugeridas.map(({ c, r }) => (
          <div key={c.id} onClick={() => onOpenCard(c)} className="bg-surface border border-line rounded-lg px-3.5 py-2 mb-1.5 cursor-pointer text-sm" style={cardSh}>
            <b>{c.title}</b> <span className="text-ink2"> · {r.length ? r.join(" · ") : "sin urgencia — ordenala a tu criterio"}</span>
          </div>
        ))}
      <p className="text-ink2 text-[13px] mt-2">Criterio del orden: vencidas → por vencer → que otros esperan → prioridad alta → rápidas.</p>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-2.5 text-[13px]">
      <span className="w-[130px] text-ink2 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
      <b className="w-11 text-right tnum">{pct}%</b>
    </div>
  );
}
