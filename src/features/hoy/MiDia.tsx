import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "../../components/EmptyState";
import { itemsDelDia, type MotivoDia } from "../../lib/midia";
import { cierreDelDia } from "../../lib/cierre-dia";
import { novedadesPara } from "../../lib/vacaciones";
import { toARTDate } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import { supabase } from "../../lib/supabase";
import { useCardOccurrences, useOccurrences } from "../../hooks/useOccurrences";
import { useVacaciones } from "../../hooks/useVacaciones";
import { ArqueoResultDialog } from "../board/ArqueoResultDialog";
import { EstancadaPrompt } from "../board/EstancadaPrompt";
import { tareaParaPreguntar } from "../../lib/estancadas";
import { PREF, getPref, setPref } from "../../lib/prefs";
import type { Card, Profile } from "../../lib/types";
import { Sun, AlertTriangle, Clock, Flame, Check, CheckCircle2, Circle, Plane } from "lucide-react";

const CHIP: Record<MotivoDia, { lbl: string; cls: string; icon: typeof Clock }> = {
  vencida: { lbl: "Vencida", cls: "bg-danger-soft text-danger", icon: AlertTriangle },
  "vence-hoy": { lbl: "Vence hoy", cls: "bg-warn-soft text-warn", icon: Clock },
  alta: { lbl: "Prioridad alta", cls: "bg-chip text-ink2", icon: Flame },
};

// Arqueo rápido del día (propuesta P10): para una card de control con ocurrencia HOY,
// dos botones grandes ("sin/con diferencias") para que el cajero cierre el arqueo sin
// entrar al kanban. DEFENSIVO: si la ocurrencia de hoy no existe → no renderiza nada.
function ArqueoHoyCard({ card, owner, hoyISO }: { card: Card; owner: string; hoyISO: string }) {
  const [y, m] = hoyISO.split("-").map(Number);
  const { data: ocurrencias = [] } = useCardOccurrences(card.id, y, m);
  const [dlg, setDlg] = useState(false);
  const qc = useQueryClient();

  const hoy = ocurrencias.find((o) => o.fecha === hoyISO);

  // Mismo patrón que CumplimientoDiario: marca la ocurrencia con el resultado del arqueo.
  const setOcc = useMutation({
    mutationFn: async (extra: { resultado: "ok" | "dif"; dif_importe?: number; dif_obs?: string }) => {
      const payload = {
        done: true,
        done_at: new Date().toISOString(),
        resultado: extra.resultado,
        dif_importe: extra.dif_importe ?? null,
        dif_obs: extra.dif_obs ?? null,
      };
      if (hoy) {
        const { error } = await supabase.from("task_occurrences").update(payload).eq("id", hoy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_occurrences")
          .upsert({ card_id: card.id, owner, fecha: hoyISO, ...payload }, { onConflict: "card_id,fecha" });
        if (error) throw error;
      }
    },
    onSuccess: (_d, extra) => {
      qc.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success(extra.resultado === "ok" ? "Arqueo registrado sin diferencias." : "Arqueo registrado con diferencias.");
    },
    onError: (e: Error) => toast.error("No se pudo registrar el arqueo: " + e.message),
  });

  // Sin ocurrencia hoy → no hay arqueo pendiente que mostrar.
  if (!hoy) return null;

  // Ya hecho → chip discreto.
  if (hoy.done) {
    return (
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink2">
        <Check size={13} className="text-accent shrink-0" /> Arqueo de hoy: hecho
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-accent/40 bg-surface p-3.5 sm:p-4" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs uppercase tracking-wide text-ink2 font-semibold">Arqueo de hoy</span>
      </div>
      <p className="font-semibold text-[14px] tracking-tight leading-snug m-0 mb-3 break-words">{card.title}</p>
      {!dlg ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setOcc.mutate({ resultado: "ok" })} disabled={setOcc.isPending}
            className="min-h-[48px] w-full sm:flex-1 rounded-lg border border-accent/50 bg-accent-soft text-accent font-semibold text-[14px] px-4 disabled:opacity-50 transition hover:border-accent">
            Sin diferencias
          </button>
          <button onClick={() => setDlg(true)} disabled={setOcc.isPending}
            className="min-h-[48px] w-full sm:flex-1 rounded-lg border border-warn/50 bg-warn-soft text-warn font-semibold text-[14px] px-4 disabled:opacity-50 transition hover:border-warn">
            Con diferencias
          </button>
        </div>
      ) : (
        <ArqueoResultDialog
          onResolve={(r) => { setOcc.mutate(r); setDlg(false); }}
          onCancel={() => setDlg(false)} />
      )}
    </div>
  );
}

// "Mi día" (propuesta P4): agenda personal priorizada para HOY del owner.
export function MiDia({ ownerId, meId, cards, team, onOpenCard }: {
  ownerId: string; meId: string; cards: Card[]; team: Profile[]; onOpenCard: (c: Card) => void;
}) {
  const hoyISO = toARTDate(new Date().toISOString());
  const misCards = cards.filter((c) => c.owner === ownerId);

  // Novedades de quienes cubro (spec 28 fase C, task 4): DEFENSIVA — useVacaciones ya
  // devuelve [] si la migración 23 no está aplicada. Solo se muestran en "mi" propio día.
  const { data: vacs = [] } = useVacaciones();
  const novedades = ownerId === meId ? novedadesPara(vacs, meId, hoyISO) : [];
  const nombreDe = (id: string) => team.find((u) => u.id === id)?.name ?? "—";
  const items = itemsDelDia(misCards, hoyISO);
  // Cards de control (arqueo): defensivo — sin migración 23, requiere_resultado undefined → [].
  const controles = misCards.filter((c) => c.requiere_resultado);

  // Cierre del día (spec 28, task 2): repaso de fin de jornada, no un control.
  // DEFENSIVA: useOccurrences ya devuelve [] ante cualquier error de la tabla.
  const [yHoy, mHoy] = hoyISO.split("-").map(Number);
  const { data: ocurrenciasMes = [] } = useOccurrences(yHoy, mHoy);
  const ocurrenciasHoy = ocurrenciasMes.filter((o) => o.fecha === hoyISO);

  const controlIds = new Set(controles.map((c) => c.id));
  const ocurrenciasControlHoy = ocurrenciasHoy.filter((o) => controlIds.has(o.card_id));
  const arqueoHoy = {
    existe: ocurrenciasControlHoy.length > 0,
    hecho: ocurrenciasControlHoy.length > 0 && ocurrenciasControlHoy.every((o) => o.done),
  };

  // Solo tareas normales: las operativas ya tienen su propio paso, y una card de control
  // (requiere_resultado) nunca pasa a "term", así que el paso quedaría pendiente para siempre.
  const vencenHoyCards = misCards.filter(
    (c) => c.due_date === hoyISO && c.card_type !== "operativa" && c.requiere_resultado !== true);
  const vencenHoy = {
    total: vencenHoyCards.length,
    cerradas: vencenHoyCards.filter((c) => c.status === "term").length,
  };

  const operativasCards = misCards.filter((c) => c.card_type === "operativa");
  const operativasIds = new Set(operativasCards.map((c) => c.id));
  // Solo cuento operativas que tienen ocurrencia para hoy (mismo patrón que arqueoHoy).
  const ocurrenciasOperativasHoy = ocurrenciasHoy.filter((o) => operativasIds.has(o.card_id));
  const operativas = {
    total: ocurrenciasOperativasHoy.length,
    conActividadHoy: ocurrenciasOperativasHoy.filter((o) => o.done).length,
  };

  const cierre = cierreDelDia({ arqueoHoy, vencenHoy, operativas });

  // P1 — confirmación de tarea estancada. SÓLO en la vista propia (ownerId === meId): la
  // misma pregunta mirando el día de otra persona deja de ser una ayuda y pasa a ser control.
  // Las pospuestas viven en localStorage namespaced por owner (decisión personal, no dato).
  const claveSnooze = PREF.estancadasPospuestas(meId);
  const [pospuestas, setPospuestas] = useState<string[]>(() => {
    try { const v = JSON.parse(getPref(claveSnooze) ?? "[]"); return Array.isArray(v) ? v : []; }
    catch { return []; }
  });
  const posponer = (id: string) => {
    const next = [...pospuestas, id];
    setPospuestas(next);
    setPref(claveSnooze, JSON.stringify(next));
  };
  // UNA sola tarea, la más estancada: preguntar por varias garantiza que se ignoren todas.
  const estancada = ownerId === meId ? tareaParaPreguntar(misCards, hoyISO, pospuestas) : null;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-10 max-w-[720px] w-full mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sun size={18} className="text-ink2 shrink-0" />
        <h2 className="text-lg font-semibold tracking-tight m-0">Mi día</h2>
        {items.length > 0 && <span className="ml-auto bg-chip rounded-full px-2 py-0.5 text-xs tnum text-ink2">{items.length}</span>}
      </div>
      {novedades.length > 0 && (
        <div className="mb-4 rounded-xl border border-line bg-surface2/40 p-3.5 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plane size={15} className="text-ink2 shrink-0" />
            <span className="text-xs uppercase tracking-wide text-ink2 font-semibold">Novedades de quien cubrís</span>
          </div>
          <div className="flex flex-col gap-2">
            {novedades.map((v) => (
              <div key={v.id} className="text-[13px]">
                <b className="text-ink">{nombreDe(v.owner)}</b>
                <span className="text-ink2"> · hasta {v.hasta}</span>
                <p className="text-ink2 m-0 mt-0.5 whitespace-pre-line">{v.notas}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {estancada && (
        <EstancadaPrompt card={estancada.card} diasSinMover={estancada.diasSinMover}
          quien={nombreDe(meId)} onAbrir={onOpenCard} onPosponer={posponer} />
      )}
      {controles.map((c) => (
        <ArqueoHoyCard key={c.id} card={c} owner={ownerId} hoyISO={hoyISO} />
      ))}
      {items.length === 0 ? (
        <EmptyState icon={<Sun size={22} />} title="Nada urgente para hoy."
          hint="Buen día para adelantar tareas de fondo." />
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {items.map(({ card, motivo }) => {
            const chip = CHIP[motivo];
            const Icon = chip.icon;
            return (
              <li key={card.id}>
                <button onClick={() => onOpenCard(card)}
                  className="w-full text-left bg-surface rounded-xl px-3.5 py-3 border border-line/70 transition
                    hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-lg)] flex items-center gap-3"
                  style={{ boxShadow: "var(--shadow)" }}>
                  <span className="font-semibold text-[13.5px] tracking-tight leading-snug min-w-0 flex-1 break-words">{card.title}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0", chip.cls)}>
                    <Icon size={11} /> {chip.lbl}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Cierre del día: repaso personal al final de la jornada, no un control de supervisión.
          Por eso habla en segunda persona y SOLO se muestra cuando mirás tu propio día:
          un gestor viendo el "Hoy" de otra persona no es el destinatario de estos copys.
          Un paso que no aplica no se muestra; si no aplica ninguno, no hay nada que cerrar. */}
      {ownerId === meId && cierre.pasos.length > 0 && (
        <div className="mt-6 bg-surface border border-line rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
          <div className="px-4 pt-3.5 pb-3 sm:px-5">
            <h3 className="text-[13px] font-semibold tracking-tight text-ink">Cierre del día</h3>
            <div className="mt-3 flex flex-col gap-3">
              {cierre.pasos.map((p) => (
                <div key={p.key} className="flex items-start gap-2.5">
                  {p.estado === "ok"
                    ? <CheckCircle2 size={18} className="text-done shrink-0" />
                    : <Circle size={18} className="text-ink2 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink leading-tight">{p.lbl}</div>
                    <div className="text-[12px] text-ink2 leading-snug mt-0.5">{p.detalle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {cierre.listo && (
            <div className="bg-accent-soft px-4 py-2.5 sm:px-5 flex items-center gap-2 border-t border-line">
              <CheckCircle2 size={16} className="text-done shrink-0" />
              <span className="text-[13px] font-semibold text-ink">Tu día está cerrado.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
