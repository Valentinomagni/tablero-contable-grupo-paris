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
  const razones = (c: Card): { txt: string; w: number }[] => {
    const r: { txt: string; w: number }[] = []; const i = dueInfo(c);
    if (isBlocked(c)) r.push({ txt: "bloqueada — reclamá la previa", w: 90 });
    if (i && i.days < 0) r.push({ txt: "vencida", w: 0 });
    else if (i && i.days <= 3) r.push({ txt: `vence en ${i.days} día${i.days === 1 ? "" : "s"}`, w: 1 });
    if (cards.some((x) => (x.deps ?? []).includes(c.id) && x.status !== "term")) r.push({ txt: "otros esperan esta tarea", w: 2 });
    if (c.priority === "alta") r.push({ txt: "prioridad alta", w: 3 });
    if ((c.effort ?? 1) === 1 && c.status === "pend") r.push({ txt: "rápida de sacar", w: 5 });
    return r;
  };
  const sugeridas = abiertas.map((c) => { const r = razones(c); return { c, r: r.map((x) => x.txt), s: r.length ? Math.min(...r.map((x) => x.w)) : 9 }; })
    .sort((a, b) => a.s - b.s).slice(0, 5);

  const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {([["Cerradas este mes", `${cerradasMes.length}/${totalMes}`], ["Esfuerzo cerrado", efCerrado], ["Esfuerzo por delante", efAbierto], ...(actMes ? [["Actividad op. del mes", actMes] as const] : [])] as const).map(([l, v]) => (
          <div key={l} className="bg-surface border border-line rounded-2xl px-5 py-4" style={cardSh}>
            <span className="block text-[11px] text-ink2 uppercase tracking-[0.08em] font-semibold mb-1.5">{l}</span>
            <b className="block text-[32px] leading-none font-bold tracking-[-0.02em] tnum">{v}</b>
          </div>
        ))}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Avance del mes</h2>
      <div className={`bg-surface rounded-2xl p-[18px] mb-6 border-l-[3px] ${alDia ? "border-done" : "border-warn"}`} style={cardSh}>
        <Bar label="Mes transcurrido" pct={pctMes} color="var(--ink2)" />
        <Bar label="Tareas cerradas" pct={pctAvance} color={alDia ? "var(--done)" : "var(--warn)"} />
        <p className="text-sm mt-1.5 mb-0">{alDia ? "Vas al día: cerraste más de lo que corrió el mes." : "El mes avanza más rápido que los cierres — mirá las sugeridas de abajo."}</p>
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">¿Qué conviene hacer ahora?</h2>
      {sugeridas.length === 0 ? <p className="text-ink2 text-sm">Sin tareas abiertas.</p>
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
