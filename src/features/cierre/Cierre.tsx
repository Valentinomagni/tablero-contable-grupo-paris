import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarPlus, CheckCircle2, Circle, Clock, AlarmClock, Link2, AlertTriangle } from "lucide-react";
import type { Card, Profile, AppSettings } from "../../lib/types";
import { dueInfo } from "../../lib/metrics";
import { isBlocked } from "../../lib/deps";
import { supabase } from "../../lib/supabase";
import { closingCards, cierreStats, ordenarCierre, shiftMonth, MESES } from "../../lib/cierre";
import { estadoCierre } from "../../lib/cierre-unificado";
import { faltantesDePlantilla, filasParaInsertar } from "../../lib/plantilla";
import { useArchiveEquipo } from "../../hooks/useArchive";
import { Avatar } from "../../lib/ui";

const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };

export function Cierre({ cards, team, isJefe, meName, settings, onOpenCard }: {
  cards: Card[]; team: Profile[]; isJefe: boolean; meName: string;
  settings: AppSettings; onOpenCard: (c: Card) => void;
}) {
  const hoy = new Date();
  const [ym, setYm] = useState({ year: hoy.getFullYear(), month: hoy.getMonth() + 1 });
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const template = settings.closing_template ?? [];
  const closing = closingCards(cards, ym.year, ym.month);
  const stats = cierreStats(closing);
  const orden = ordenarCierre(closing);
  const nom = (id: string) => team.find((u) => u.id === id)?.name ?? "?";
  const nav = (delta: number) => setYm(shiftMonth(ym.year, ym.month, delta));

  // Semáforo de cierre unificado (alternativa A): junta checklist + archivo del mes
  // previo + reinicio de recurrentes en una sola lectura. DEFENSIVO: sin datos → pendiente.
  const archives = useArchiveEquipo().data ?? [];
  const prev = shiftMonth(ym.year, ym.month, -1);
  const mesPrevio = `${prev.year}-${String(prev.month).padStart(2, "0")}`;
  const archivadoMesPrevio = archives.some((a) => a.mes === mesPrevio);
  const recurrentesMensuales = cards.filter(
    (c) => c.recur_rule != null && (c.reset_policy == null || c.reset_policy === "mensual"),
  );
  const recurrentesOk = !recurrentesMensuales.some(
    (c) => c.status === "term" && !!c.done_at && c.done_at.slice(0, 7) === mesPrevio,
  );
  const semaforo = estadoCierre({
    checklist: closing.length ? stats : null,
    archivadoMesPrevio,
    recurrentesOk,
  });

  async function generar() {
    const faltan = faltantesDePlantilla(template, cards, ym.year, ym.month);
    if (!faltan.length) { toast(`El cierre de ${MESES[ym.month - 1]} ya está generado.`); return; }
    setBusy(true);
    const { error } = await supabase.from("cards").insert(filasParaInsertar(faltan, ym.year, ym.month, meName));
    setBusy(false);
    if (error) { toast.error("No se pudo generar: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["cards"] });
    toast.success(`${faltan.length} tarea(s) de cierre generadas`);
  }

  const StatChip = ({ label, value, tone }: { label: string; value: number; tone?: "danger" | "done" | "warn" }) => (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 flex-1 min-w-[110px]" style={cardSh}>
      <div className="text-[11px] text-ink2 uppercase tracking-[0.07em] font-semibold mb-1">{label}</div>
      <b className="text-[26px] leading-none font-bold tnum tracking-[-0.02em]"
        style={{ color: tone === "danger" ? "var(--danger)" : tone === "done" ? "var(--done)" : tone === "warn" ? "var(--warn)" : undefined }}>{value}</b>
    </div>
  );

  const PasoIcon = ({ estado }: { estado: "ok" | "pendiente" | "atencion" }) =>
    estado === "ok" ? <CheckCircle2 size={18} className="text-done shrink-0" />
      : estado === "atencion" ? <AlertTriangle size={18} className="text-warn shrink-0" />
      : <Circle size={18} className="text-ink2 shrink-0" />;

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      {/* Cierre unificado (alternativa A): un solo semáforo responde "¿cerré el mes?" */}
      {/* El semáforo solo es relevante para el mes actual; datos de meses pasados son históricos y no se deben evaluar */}
      {ym.year === hoy.getFullYear() && ym.month === hoy.getMonth() + 1 && (
      <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-5" style={cardSh}>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-bold tracking-[-0.01em]">Cierre del mes</h3>
          <div className="mt-3 flex flex-col gap-3">
            {semaforo.pasos.map((p) => (
              <div key={p.key} className="flex items-start gap-2.5">
                <PasoIcon estado={p.estado} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink leading-tight">{p.lbl}</div>
                  <div className="text-[12px] text-ink2 leading-snug mt-0.5">{p.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {semaforo.cerrado && (
          <div className="bg-accent-soft px-5 py-2.5 flex items-center gap-2 border-t border-line">
            <CheckCircle2 size={16} className="text-done shrink-0" />
            <span className="text-[13px] font-semibold text-ink">Mes cerrado</span>
          </div>
        )}
      </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => nav(-1)} className="border border-line bg-surface2 rounded-lg p-1.5" title="Mes anterior"><ChevronLeft size={16} /></button>
        <h2 className="text-[16px] font-bold tracking-[-0.01em] capitalize min-w-[190px] text-center">{MESES[ym.month - 1]} de {ym.year}</h2>
        <button onClick={() => nav(1)} className="border border-line bg-surface2 rounded-lg p-1.5" title="Mes siguiente"><ChevronRight size={16} /></button>
        {isJefe && template.length > 0 && (
          <button onClick={generar} disabled={busy}
            className="flex items-center gap-1.5 ml-auto bg-accent text-[color:var(--accent-ink)] rounded-lg px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50">
            <CalendarPlus size={14} /> {busy ? "Generando…" : `Generar cierre de ${MESES[ym.month - 1]}`}</button>
        )}
      </div>

      {closing.length === 0 ? (
        <EmptyState title={`No hay cierre generado para ${MESES[ym.month - 1]}.`}
          hint={template.length === 0
            ? "Definí primero la plantilla de cierre en Administración (las tareas que se repiten cada mes: IVA, sueldos, F931, conciliaciones)."
            : isJefe ? "Apretá “Generar cierre” y se crean todas las tareas del mes con responsable, vencimiento y esfuerzo."
            : "Todavía no lo generó un jefe. En cuanto esté, vas a ver acá el avance del cierre."} />
      ) : (
        <>
          {/* progreso (Kaizen: el avance se ve y se mide) */}
          <div className="bg-surface border border-line rounded-2xl p-5 mb-4" style={cardSh}>
            <div className="flex items-end justify-between mb-2">
              <div>
                <span className="text-[13px] text-ink2">Avance del cierre</span>
                <div className="text-[34px] font-bold leading-none tnum tracking-[-0.02em] mt-1">{stats.pct}%</div>
              </div>
              <div className="text-right text-[13px] text-ink2">
                <div><b className="text-ink tnum">{stats.done}</b> de <b className="text-ink tnum">{stats.total}</b> tareas</div>
                {stats.onTimePct !== null && <div>Adherencia (en fecha): <b style={{ color: stats.onTimePct >= 85 ? "var(--done)" : stats.onTimePct >= 60 ? "var(--warn)" : "var(--danger)" }}>{stats.onTimePct}%</b></div>}
              </div>
            </div>
            <div className="h-2.5 bg-surface2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${stats.pct}%`, background: stats.overdue ? "var(--warn)" : "var(--done)" }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <StatChip label="Terminadas" value={stats.done} tone="done" />
            <StatChip label="En proceso" value={stats.proc} />
            <StatChip label="Pendientes" value={stats.pend} />
            <StatChip label="Vencidas" value={stats.overdue} tone={stats.overdue ? "danger" : undefined} />
          </div>

          <div className="bg-surface border border-line rounded-xl overflow-hidden" style={cardSh}>
            {orden.map((c, idx) => {
              const i = dueInfo(c);
              const late = c.status !== "term" && i && i.days < 0;
              const blocked = c.status !== "term" && isBlocked(c, cards, {});
              const Icon = c.status === "term" ? CheckCircle2 : c.status === "proc" ? Clock : Circle;
              return (
                <div key={c.id} onClick={() => onOpenCard(c)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface2 ${idx ? "border-t border-line" : ""}`}>
                  <Icon size={17} style={{ color: c.status === "term" ? "var(--done)" : "var(--ink2)" }} className="shrink-0" />
                  <span className={`flex-1 min-w-0 truncate ${c.status === "term" ? "line-through text-ink2" : "text-ink"} font-medium`}>{c.title}</span>
                  {blocked && <span className="flex items-center gap-1 text-warn text-[11px] font-semibold shrink-0"><Link2 size={12} /> Bloqueada</span>}
                  {late && <span className="flex items-center gap-1 bg-danger-soft text-danger rounded-md px-2 py-0.5 text-[11px] font-semibold shrink-0"><AlarmClock size={11} /> Venció {i!.lbl}</span>}
                  {!late && i && c.status !== "term" && <span className="text-ink2 text-[12px] tnum shrink-0">vence {i.lbl}</span>}
                  <span className="flex items-center gap-1.5 shrink-0 w-[130px] justify-end"><span className="text-ink2 text-[12px] truncate">{nom(c.owner)}</span><Avatar name={nom(c.owner)} size={22} /></span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
