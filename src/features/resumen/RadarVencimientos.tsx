import { radarVencimientos, type RiesgoVto } from "../../lib/radar";
import type { Announcement, Card, Vacacion, Profile } from "../../lib/types";
import { Avatar } from "../../lib/ui";

// Radar predictivo de vencimientos fiscales (spec 28, Fase B, J3): solo para gestores.
// Anticipa vencimientos en riesgo de incumplirse, no señala a nadie — el motivo describe
// la situación (sin tarea creada, licencia, etc.), nunca juzga a la persona responsable.

const CHIP: Record<RiesgoVto, { lbl: string; cls: string }> = {
  riesgo: { lbl: "Riesgo", cls: "text-danger" },
  atencion: { lbl: "Atención", cls: "text-warn" },
  ok: { lbl: "OK", cls: "text-ink2" },
};

export function RadarVencimientos({ avisos, cards, vacaciones, profiles, hoyISO }: {
  avisos: Announcement[]; cards: Card[]; vacaciones: Vacacion[]; profiles: Profile[]; hoyISO: string;
}) {
  const items = radarVencimientos({ avisos, cards, vacaciones, profiles, hoyISO });
  if (items.length === 0) return null;

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 mb-5" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      <h2 className="text-[11px] text-ink2 uppercase tracking-[0.08em] font-semibold mb-2.5">Radar de vencimientos fiscales</h2>
      {items.map((it) => {
        const chip = CHIP[it.riesgo];
        return (
          <div key={it.aviso.id} className="flex items-start gap-2.5 py-1.5 border-b border-line last:border-0">
            <span className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide w-16 ${chip.cls}`}>{chip.lbl}</span>
            <span className="flex-1 min-w-0">
              <b className="block text-[13px]">{it.aviso.title}</b>
              <span className="block text-xs text-ink2">{it.motivo}</span>
            </span>
            {it.responsable && (
              <span className="flex items-center gap-1.5 shrink-0 text-xs text-ink2">
                <Avatar name={it.responsable.name} size={20} />{it.responsable.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
