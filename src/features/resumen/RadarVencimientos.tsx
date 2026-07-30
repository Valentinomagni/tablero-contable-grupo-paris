import { useState } from "react";
import { radarVencimientos, type RiesgoVto } from "../../lib/radar";
import type { Announcement, Card, Vacacion, Profile } from "../../lib/types";
import { Avatar } from "../../lib/ui";

// Radar predictivo de vencimientos fiscales (spec 28, Fase B, J3): solo para gestores.
// Anticipa vencimientos en riesgo de incumplirse, no señala a nadie — el motivo describe
// la situación (sin tarea creada, licencia, etc.), nunca juzga a la persona responsable.
//
// El vínculo aviso↔card es una aproximación (coincidencia de dueño y fecha), no una relación
// formal del esquema. Por eso solo se muestran por defecto los items con señal real (riesgo o
// atención): mostrar todos los "ok" generaba ruido y el radar se ignoraba.

const CHIP: Record<RiesgoVto, { lbl: string; cls: string }> = {
  riesgo: { lbl: "Riesgo", cls: "text-danger" },
  atencion: { lbl: "Atención", cls: "text-warn" },
  ok: { lbl: "OK", cls: "text-ink2" },
};

export function RadarVencimientos({ avisos, cards, vacaciones, profiles, hoyISO }: {
  avisos: Announcement[]; cards: Card[]; vacaciones: Vacacion[]; profiles: Profile[]; hoyISO: string;
}) {
  const [mostrarOk, setMostrarOk] = useState(false);
  const items = radarVencimientos({ avisos, cards, vacaciones, profiles, hoyISO });
  if (items.length === 0) return null;

  // Tope de 6 ítems con alerta, igual que el bloque de Alertas vecino: una lista larga
  // deja de leerse y el radar se vuelve ruido. El resto se resume en una línea.
  const TOPE = 6;
  const conAlerta = items.filter((it) => it.riesgo !== "ok");
  const ok = items.filter((it) => it.riesgo === "ok");
  const conAlertaVisibles = conAlerta.slice(0, TOPE);
  const restantes = conAlerta.length - conAlertaVisibles.length;
  const visibles = mostrarOk ? [...conAlertaVisibles, ...ok] : conAlertaVisibles;

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 mb-5" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      <h2 className="text-2xs text-ink2 uppercase tracking-[0.08em] font-semibold mb-2.5">Radar de vencimientos fiscales</h2>

      {conAlerta.length === 0 ? (
        <p className="text-xs text-ink2 py-1.5">Sin alertas de vencimientos en los próximos 30 días.</p>
      ) : (
        visibles.map((it) => {
          const chip = CHIP[it.riesgo];
          return (
            <div key={it.aviso.id} className="flex items-start gap-2.5 py-1.5 border-b border-line last:border-0">
              <span className={`shrink-0 text-2xs font-semibold uppercase tracking-wide w-16 ${chip.cls}`}>{chip.lbl}</span>
              <span className="flex-1 min-w-0">
                <b className="block text-sm">{it.aviso.title}</b>
                <span className="block text-xs text-ink2">{it.motivo}</span>
              </span>
              {it.responsable && (
                <span className="flex items-center gap-1.5 shrink-0 text-xs text-ink2">
                  <Avatar name={it.responsable.name} size={20} />{it.responsable.name}
                </span>
              )}
            </div>
          );
        })
      )}

      {restantes > 0 && (
        <p className="text-xs text-ink2 pt-1.5 m-0">y {restantes} vencimiento{restantes === 1 ? "" : "s"} más con alguna señal</p>
      )}

      {ok.length > 0 && (
        <button
          type="button"
          onClick={() => setMostrarOk((v) => !v)}
          className="text-xs text-ink2 underline underline-offset-2 mt-2"
        >
          {mostrarOk
            ? "Ocultar vencimientos sin señales de alerta"
            : `${ok.length} vencimiento${ok.length === 1 ? "" : "s"} más sin señales de alerta`}
        </button>
      )}

      <p className="text-ink2 text-xs mt-2.5">
        El radar detecta la tarea vinculada por coincidencia de fecha y responsable, así que puede
        marcar como riesgo algo que en realidad ya está cubierto por otra tarea.
      </p>
    </div>
  );
}
