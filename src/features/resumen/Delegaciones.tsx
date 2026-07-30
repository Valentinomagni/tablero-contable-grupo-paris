import { Users } from "lucide-react";
import type { Card, Profile } from "../../lib/types";
import { delegacionesVivas } from "../../lib/delegaciones";

// Panel de seguimiento de delegaciones (spec 28 Fase C, J7): el jefe delega y pierde el
// rastro. Esto es seguimiento de TAREAS, no vigilancia de personas — el copy habla de
// "esta tarea", nunca evalúa a quién se le delegó.
export function Delegaciones({ cards, team, hoyISO, onOpenCard }: {
  cards: Card[]; team: Profile[]; hoyISO: string; onOpenCard: (c: Card) => void;
}) {
  const items = delegacionesVivas(cards, team, hoyISO).sort((a, b) => b.diasSinMover - a.diasSinMover);
  if (items.length === 0) return null;

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 mb-5" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      <h2 className="flex items-center gap-1.5 text-2xs text-ink2 uppercase tracking-[0.08em] font-semibold mb-2.5">
        <Users size={13} /> Delegaciones en curso
      </h2>
      {items.map(({ card, de, a, diasSinMover, trabada }) => (
        // Botón real: la delegación se abre con Enter. text-left/w-full la dejan igual.
        <button type="button" key={card.id} onClick={() => onOpenCard(card)}
          className="text-left w-full flex items-start gap-2.5 py-1.5 border-b border-line last:border-0 cursor-pointer">
          <span className="flex-1 min-w-0">
            <b className="block text-sm">{card.title}</b>
            <span className="block text-xs text-ink2">
              De {de?.name ?? "?"} a {a.length ? a.map((p) => p.name).join(", ") : "?"} · {diasSinMover === 0 ? "sin movimiento hoy" : `${diasSinMover} día${diasSinMover === 1 ? "" : "s"} sin movimiento`}
            </span>
          </span>
          {trabada && (
            <span className="shrink-0 text-2xs font-semibold text-warn bg-warn/15 rounded-full px-2 py-0.5">
              Esta tarea lleva {diasSinMover} días sin movimiento
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
