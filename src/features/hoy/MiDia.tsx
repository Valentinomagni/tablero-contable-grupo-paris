import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "../../components/EmptyState";
import { itemsDelDia, type MotivoDia } from "../../lib/midia";
import { cierreDelDia } from "../../lib/cierre-dia";
import { novedadesPara } from "../../lib/vacaciones";
import { toARTDate } from "../../lib/metrics";
import { mensajeUsuario } from "../../lib/fallas";
import { cn } from "../../lib/ui";
import { supabase } from "../../lib/supabase";
import { useCardOccurrences, useOccurrences } from "../../hooks/useOccurrences";
import { useVacaciones } from "../../hooks/useVacaciones";
import { ArqueoResultDialog } from "../board/ArqueoResultDialog";
import { EstancadaPrompt } from "../board/EstancadaPrompt";
import { tareaParaPreguntar } from "../../lib/estancadas";
import { tareaParaRetomar } from "../../lib/retomar";
import { resumenDeSemana } from "../../lib/tu-semana";
import { TuSemana } from "./TuSemana";
import { sePuedeCerrarRapido, patchCierreRapido, MOTIVO_NO_RAPIDO } from "../../lib/cierre-rapido";
import { pushUndo } from "../../lib/undo";
import { deshacerUltimo } from "../../lib/deshacer";
import { payloadCards } from "../../lib/esquema";
import { useMigraciones, useDiasNoLaborables } from "../../hooks/useData";
import { PREF, getPref, setPref } from "../../lib/prefs";
import type { Card, Profile } from "../../lib/types";
import { Sun, AlertTriangle, Clock, Flame, Check, CheckCircle2, Circle, Plane, RotateCcw, Lock } from "lucide-react";

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
    onError: (e: Error) => toast.error(mensajeUsuario(e, "registrar el arqueo")),
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
      <p className="font-semibold text-base tracking-tight leading-snug m-0 mb-3 break-words">{card.title}</p>
      {!dlg ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setOcc.mutate({ resultado: "ok" })} disabled={setOcc.isPending}
            className="min-h-[48px] w-full sm:flex-1 rounded-lg border border-accent/50 bg-accent-soft text-accent font-semibold text-base px-4 disabled:opacity-50 transition hover:border-accent">
            Sin diferencias
          </button>
          <button onClick={() => setDlg(true)} disabled={setOcc.isPending}
            className="min-h-[48px] w-full sm:flex-1 rounded-lg border border-warn/50 bg-warn-soft text-warn font-semibold text-base px-4 disabled:opacity-50 transition hover:border-warn">
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
  const qcRef = useQueryClient();
  // Sin la migración 29, `proc_at` no existe: payloadCards lo saca y el cierre rápido
  // funciona igual (mismo gate que usa el tablero para el drag & drop).
  const { data: migraciones } = useMigraciones();

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
  // Los feriados entran en la cuenta: sin ellos, una tarea tocada antes de un fin de semana largo
  // dispara el "¿seguís con esto?" dos días antes de tiempo, y preguntar por algo que se dejó
  // anteayer es cómo el aviso se gana que lo ignoren.
  const noLaborables = useDiasNoLaborables();
  const estancada = ownerId === meId ? tareaParaPreguntar(misCards, hoyISO, pospuestas, noLaborables) : null;
  // P3 — retomar donde quedaste. También SÓLO en la vista propia: mirar el tablero de otro
  // y que diga "venías con X" sería contarle a un tercero en qué andaba esa persona.
  const retomar = ownerId === meId ? tareaParaRetomar(misCards, meId, hoyISO) : null;
  // P4 — "Tu semana". Espejo PERSONAL: igual que las dos anteriores, sólo en la vista propia.
  // Mostrárselo a un jefe convertiría un espejo en una evaluación semanal automática, que es
  // exactamente el modo de falla que el documento marca como caro y que suena barato al pedirlo.
  // Hora de pared argentina SIN zona: "Tu semana" depende del día y la hora (viernes a la
  // tarde), y leerlos de la zona del navegador daría el viernes equivocado desde afuera.
  const ahoraART = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 19);
  const semana = ownerId === meId ? resumenDeSemana(misCards, meId, ahoraART) : null;

  // P5 — cerrar de un toque desde la lista, sin abrir la tarea.
  // Reusa `pushUndo` (la misma pila del Ctrl+Z del tablero), así el deshacer no es un
  // mecanismo nuevo que mantener: el toast sólo dispara lo que ya existía.
  const cerrarRapido = useMutation({
    mutationFn: async (c: Card) => {
      const patch = patchCierreRapido(c, nombreDe(meId), new Date().toISOString());
      const body = payloadCards(patch, migraciones);
      pushUndo(c, body);
      const { error } = await supabase.from("cards").update(body).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      qcRef.invalidateQueries({ queryKey: ["cards"] });
      toast.success(`"${c.title}" terminada`, {
        action: {
          label: "Deshacer",
          onClick: async () => { toast.message(await deshacerUltimo(qcRef)); },
        },
      });
    },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "cerrar la tarea")),
  });

  return (
    <div className="px-4 sm:px-6 pt-4 pb-10 max-w-[720px] w-full mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sun size={18} className="text-ink2 shrink-0" />
        {/* "Mi día" mirando el día de OTRA persona (hallazgo 9 de la auditoría del 05/08).
            El resto de la vista ya se comportaba bien —todo lo personal está gateado con
            `ownerId === meId`— pero el título seguía diciendo "Mi". La pestaña de al lado ya lo
            resolvía: `App.tsx` pone "Su mes" cuando el perfil no es el propio. Mismo criterio
            acá, para que las dos digan lo mismo. */}
        <h2 className="text-lg font-semibold tracking-tight m-0">
          {ownerId === meId ? "Mi día" : `El día de ${nombreDe(ownerId)}`}
        </h2>
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
              <div key={v.id} className="text-sm">
                <b className="text-ink">{nombreDe(v.owner)}</b>
                <span className="text-ink2"> · hasta {v.hasta}</span>
                <p className="text-ink2 m-0 mt-0.5 whitespace-pre-line">{v.notas}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {semana && <TuSemana resumen={semana} ownerId={meId} />}
      {/* P3 — "Retomar donde quedaste": una sola línea servicial contra el arranque frío.
          Sin números, sin resumen, sin saludo. Si no hay nada claro, no se muestra nada:
          el valor de esto está tanto en lo que dice como en cuándo se calla. */}
      {retomar && (
        <button onClick={() => onOpenCard(retomar)}
          className="flex items-center gap-2 text-left rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm text-ink2 hover:border-accent transition">
          <RotateCcw size={14} className="shrink-0" />
          <span className="min-w-0">Venías con <b className="text-ink font-semibold">{retomar.title}</b></span>
        </button>
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
            // P5: el tilde cierra sin abrir. Sólo en la vista propia y sólo cuando la tarea
            // lo admite — un control (arqueo), una protegida o una bloqueada siguen
            // exigiendo abrirla, y en vez de un botón muerto se explica por qué.
            return (
              <li key={card.id} className="flex items-stretch gap-2">
                <button onClick={() => onOpenCard(card)}
                  className="flex-1 min-w-0 text-left bg-surface rounded-xl px-3.5 py-3 border border-line/70 transition
                    hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-lg)] flex items-center gap-3"
                  style={{ boxShadow: "var(--shadow)" }}>
                  <span className="font-semibold text-sm tracking-tight leading-snug min-w-0 flex-1 break-words">{card.title}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0", chip.cls)}>
                    <Icon size={11} /> {chip.lbl}
                  </span>
                </button>
                {ownerId === meId && (
                  sePuedeCerrarRapido(card, misCards) ? (
                    <button onClick={() => cerrarRapido.mutate(card)} disabled={cerrarRapido.isPending}
                      title="Marcar terminada" aria-label={`Marcar terminada: ${card.title}`}
                      className="shrink-0 w-11 rounded-xl border border-line/70 bg-surface text-ink2 transition
                        hover:border-accent hover:text-accent disabled:opacity-50 flex items-center justify-center"
                      style={{ boxShadow: "var(--shadow)" }}>
                      <Check size={16} />
                    </button>
                  ) : (
                    <span title={MOTIVO_NO_RAPIDO(card, misCards) ?? undefined}
                      className="shrink-0 w-11 rounded-xl border border-dashed border-line/70 text-ink2/50 flex items-center justify-center">
                      <Lock size={14} />
                    </span>
                  )
                )}
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
            <h3 className="text-sm font-semibold tracking-tight text-ink">Cierre del día</h3>
            <div className="mt-3 flex flex-col gap-3">
              {cierre.pasos.map((p) => (
                <div key={p.key} className="flex items-start gap-2.5">
                  {p.estado === "ok"
                    ? <CheckCircle2 size={18} className="text-done shrink-0" />
                    : <Circle size={18} className="text-ink2 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink leading-tight">{p.lbl}</div>
                    <div className="text-xs text-ink2 leading-snug mt-0.5">{p.detalle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {cierre.listo && (
            <div className="bg-accent-soft px-4 py-2.5 sm:px-5 flex items-center gap-2 border-t border-line">
              <CheckCircle2 size={16} className="text-done shrink-0" />
              <span className="text-sm font-semibold text-ink">Tu día está cerrado.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
