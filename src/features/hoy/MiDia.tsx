import { EmptyState } from "../../components/EmptyState";
import { itemsDelDia, type MotivoDia } from "../../lib/midia";
import { toARTDate } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import type { Card } from "../../lib/types";
import { Sun, AlertTriangle, Clock, Flame } from "lucide-react";

const CHIP: Record<MotivoDia, { lbl: string; cls: string; icon: typeof Clock }> = {
  vencida: { lbl: "Vencida", cls: "bg-danger-soft text-danger", icon: AlertTriangle },
  "vence-hoy": { lbl: "Vence hoy", cls: "bg-warn-soft text-warn", icon: Clock },
  alta: { lbl: "Prioridad alta", cls: "bg-chip text-ink2", icon: Flame },
};

// "Mi día" (propuesta P4): agenda personal priorizada para HOY del owner.
export function MiDia({ ownerId, cards, onOpenCard }: {
  ownerId: string; cards: Card[]; onOpenCard: (c: Card) => void;
}) {
  const hoyISO = toARTDate(new Date().toISOString());
  const items = itemsDelDia(cards.filter((c) => c.owner === ownerId), hoyISO);

  return (
    <div className="px-4 sm:px-6 pt-4 pb-10 max-w-[720px] w-full mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sun size={18} className="text-ink2 shrink-0" />
        <h2 className="text-lg font-semibold tracking-tight m-0">Mi día</h2>
        {items.length > 0 && <span className="ml-auto bg-chip rounded-full px-2 py-0.5 text-xs tnum text-ink2">{items.length}</span>}
      </div>
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
