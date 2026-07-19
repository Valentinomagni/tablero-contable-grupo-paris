import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "../../components/EmptyState";
import { itemsDelDia, type MotivoDia } from "../../lib/midia";
import { toARTDate } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import { supabase } from "../../lib/supabase";
import { useCardOccurrences } from "../../hooks/useOccurrences";
import { ArqueoResultDialog } from "../board/ArqueoResultDialog";
import type { Card } from "../../lib/types";
import { Sun, AlertTriangle, Clock, Flame, Check } from "lucide-react";

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
export function MiDia({ ownerId, cards, onOpenCard }: {
  ownerId: string; cards: Card[]; onOpenCard: (c: Card) => void;
}) {
  const hoyISO = toARTDate(new Date().toISOString());
  const misCards = cards.filter((c) => c.owner === ownerId);
  const items = itemsDelDia(misCards, hoyISO);
  // Cards de control (arqueo): defensivo — sin migración 23, requiere_resultado undefined → [].
  const controles = misCards.filter((c) => c.requiere_resultado);

  return (
    <div className="px-4 sm:px-6 pt-4 pb-10 max-w-[720px] w-full mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sun size={18} className="text-ink2 shrink-0" />
        <h2 className="text-lg font-semibold tracking-tight m-0">Mi día</h2>
        {items.length > 0 && <span className="ml-auto bg-chip rounded-full px-2 py-0.5 text-xs tnum text-ink2">{items.length}</span>}
      </div>
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
    </div>
  );
}
