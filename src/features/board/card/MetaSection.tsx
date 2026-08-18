import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { COLS, type Card, type Profile, type HistoryEntry, type RecurRule, type AppSettings } from "../../../lib/types";
import { ocurrenciasFaltantes, OCC_CONFLICT } from "../../../lib/recurrencia";
import { fmtDateTime } from "../../../lib/metrics";
import { mensajeUsuario } from "../../../lib/fallas";
import { isShared, participantes } from "../../../lib/shared";
import { categoriasEnUso, mergeCategorias } from "../../../lib/categorias";
import { etiquetasEnUso, agregarEtiqueta } from "../../../lib/etiquetas";
import { Users, AlertTriangle, X } from "lucide-react";
import { CumplimientoDiario } from "../CumplimientoDiario";
import { estadoTiempo, registrarIncumplimiento } from "../../../lib/tiempos";
import { textoTransicion } from "../../../lib/retrabajo";
import { useTiemposMax, useMigraciones } from "../../../hooks/useData";
import { tieneEtiquetas } from "../../../lib/esquema";
import { textoNoHabilitado } from "../../../lib/disponibilidad";
import { bloqueoDeTransicion } from "../../../lib/transicion";

type PatchMut = UseMutationResult<void, Error, Partial<Card>, unknown>;

// Metadatos de la tarea: estado, tarea compartida, vencimiento/prioridad/esfuerzo/categoría,
// recurrencia (presets + form + ciclo de vida) y la grilla de cumplimiento diario.
export function MetaSection({ c, cards, team, settings, patch, hist, locked }:
  { c: Card; cards: Card[]; team: Profile[]; settings: AppSettings; patch: PatchMut; hist: (txt: string) => HistoryEntry[]; locked: boolean }) {
  const qc = useQueryClient();
  const tiemposConfig = useTiemposMax();
  // Etiquetas (spec 28, fase D — review MEDIA 1): sin la migración 31 la columna
  // `cards.etiquetas` no existe, `payloadCards()` descarta el campo y el guardado NO
  // persiste nada — pero el `history` sí viaja, así que quedaría escrito "Agregó la
  // etiqueta X" para una etiqueta que nunca se guardó. Falla en silencio y encima miente.
  // Por eso el bloque entero se degrada igual que Empresas: aviso en vez de input.
  const { data: migracionesAplicadas } = useMigraciones();
  const etiquetasHabilitadas = tieneEtiquetas(migracionesAplicadas);
  const est = estadoTiempo(c, tiemposConfig, new Date().toISOString());
  const [recurTipo, setRecurTipo] = useState<RecurRule["tipo"] | "">(c.recur_rule?.tipo ?? "");
  const [recurDias, setRecurDias] = useState<number[]>(c.recur_rule?.dias ?? []);
  const [recurDiaMes, setRecurDiaMes] = useState<number>(c.recur_rule?.diaMes ?? 1);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");

  const buildRule = (): RecurRule | null => {
    if (recurTipo === "") return null;
    if (recurTipo === "diaria") return { tipo: "diaria" };
    if (recurTipo === "semanal") return { tipo: "semanal", dias: [...recurDias].sort((a, b) => a - b) };
    return { tipo: "mensual", diaMes: recurDiaMes };
  };

  // Guarda la regla en la card y materializa (idempotente) las ocurrencias del mes actual.
  // Falla si la migración 16 aún no fue aplicada — se muestra por toast sin romper la app.
  const guardarRecur = useMutation({
    mutationFn: async (rule: RecurRule | null) => {
      const { error: e1 } = await supabase.from("cards").update({ recur_rule: rule }).eq("id", c.id);
      if (e1) throw e1;
      if (rule) {
        const now = new Date();
        const year = now.getFullYear(), month = now.getMonth() + 1;
        const { data: existentes, error: e2 } = await supabase.from("task_occurrences").select("fecha").eq("card_id", c.id);
        if (e2) throw e2;
        const faltan = ocurrenciasFaltantes(rule, year, month, (existentes ?? []).map((r) => (r as { fecha: string }).fecha));
        if (faltan.length) {
          const { error: e3 } = await supabase.from("task_occurrences")
            .upsert(faltan.map((f) => ({ card_id: c.id, owner: c.owner, fecha: f })), { onConflict: OCC_CONFLICT });
          if (e3) throw e3;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Recurrencia guardada");
    },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "guardar la recurrencia")),
  });

  return (
    <>
        <div className="flex items-center gap-2 text-xs text-ink2 mb-3.5">
          <label className="flex items-center gap-1.5">Estado
            <select value={c.status} disabled={locked}
              onChange={(e) => {
                const s = e.target.value as Card["status"];
                // Mismo gate que el arrastre, el botón "Marcar terminada", el checklist, el
                // aviso de estancada y el cierre rápido: la regla vive en `transicion.ts` y la
                // consultan los seis. Este selector era el camino más cómodo para saltar de
                // Pendiente a Terminado sin pasar por En proceso.
                const falta = bloqueoDeTransicion(c, s);
                if (falta) {
                  toast.error(falta);
                  // Devolver el selector a donde estaba: si se queda mostrando el valor que no
                  // se guardó, la persona cree que sí se guardó.
                  e.target.value = c.status;
                  return;
                }
                const now = new Date().toISOString();
                if (s === "term") {
                  let h = hist("Marcó terminada");
                  const estFinal = estadoTiempo({ ...c, status: "term", done_at: now }, tiemposConfig, now);
                  const who = h[h.length - 1]?.who ?? "";
                  h = registrarIncumplimiento(h, estFinal, who, now, c.proc_at ?? null);
                  patch.mutate({ status: "term", done_at: now, history: h });
                } else {
                  // Sellar proc_at (spec 28, Task 4): igual criterio que Board.tsx (drag & drop).
                  const p: Partial<Card> = { status: s, done_at: null, history: hist(textoTransicion(c.status, s, s === "proc" ? "Pasó a En proceso" : "Volvió a Pendiente")) };
                  if (s === "proc" && !c.proc_at) p.proc_at = now;
                  else if (s === "pend") p.proc_at = null;
                  patch.mutate(p);
                }
              }}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm disabled:opacity-60">
              {COLS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
            </select>
          </label>
          {c.done_at && <span>terminada el {fmtDateTime(c.done_at)}</span>}
          {est.maxHoras != null && est.horas != null && (
            <span className={"flex items-center gap-1 font-semibold " + (est.excedido ? "text-danger" : "text-ink2")}>
              {est.excedido && <AlertTriangle size={12} />}
              {est.excedido ? `Superó el tiempo máximo (${est.horas.toFixed(1)}h de ${est.maxHoras}h)` : `${est.horas.toFixed(1)}h de ${est.maxHoras}h`}
            </span>
          )}
        </div>
        {isShared(c) && (
          <div className="flex items-center gap-2 bg-accent-soft text-accent rounded-lg px-3 py-2 text-sm mb-3.5">
            <Users size={14} className="shrink-0" />
            <span>Tarea compartida con <b>{participantes(c, cards, (id) => team.find((u) => u.id === id)?.name ?? "?").join(", ")}</b>. Al terminarla se marca para todos.</span>
          </div>
        )}

        <div className="flex gap-4 flex-wrap items-center text-sm text-ink2 mb-2">
          <label className="flex items-center gap-1.5">Vence
            <input type="date" defaultValue={c.due_date ?? ""} onChange={(e) => patch.mutate({ due_date: e.target.value || null, history: hist(e.target.value ? "Puso vencimiento" : "Quitó vencimiento") })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm" />
          </label>
          <label className="flex items-center gap-1.5">Prioridad
            <select defaultValue={c.priority} onChange={(e) => patch.mutate({ priority: e.target.value as Card["priority"], history: hist("Cambió prioridad a " + e.target.value) })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Esfuerzo
            <select defaultValue={String(c.effort ?? 1)} onChange={(e) => patch.mutate({ effort: Number(e.target.value) as Card["effort"], history: hist("Cambió esfuerzo a " + e.target.value) })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
              <option value="1">1 — Baja</option><option value="2">2 — Media</option><option value="3">3 — Alta</option><option value="5">5 — Muy alta</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Tiempo máximo (horas)
            <input type="number" min={1} step="1" placeholder="Sin límite" defaultValue={c.tiempo_max_horas ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const n = v === "" ? null : Number(v);
                if ((n ?? null) === (c.tiempo_max_horas ?? null)) return;
                patch.mutate({ tiempo_max_horas: n, history: hist(n != null ? "Puso tiempo máximo de " + n + "h" : "Quitó el tiempo máximo") });
              }}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-24" />
          </label>
          {(() => {
            // Categorías en uso por el dueño de la tarea + las definidas por el Admin (spec 21 item 11).
            const cats = mergeCategorias(categoriasEnUso(cards.filter((x) => x.owner === c.owner)), settings.categorias ?? []);
            return (
              <>
                <label className="flex items-center gap-1.5">Categoría
                  <input key={c.categoria ?? ""} list="cats-card" defaultValue={c.categoria ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (c.categoria ?? "")) return;
                      patch.mutate({ categoria: v || null, history: hist("Cambió categoría a " + (v || "ninguna")) });
                    }}
                    placeholder="Sin categoría"
                    className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-36" />
                  <datalist id="cats-card">
                    {cats.map((cat) => <option key={cat} value={cat} />)}
                  </datalist>
                </label>
                <label className="flex items-center gap-1.5">Dato de control a adjuntar
                  <input key={c.dato_control ?? ""} defaultValue={c.dato_control ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (c.dato_control ?? "")) return;
                      patch.mutate({ dato_control: v || null });
                    }}
                    className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-36" />
                </label>
              </>
            );
          })()}
        </div>

        {/* Etiquetas (spec 28, fase D, Task 5): contexto (empresa/marca puntual/cliente),
            distintas de la categoría (tipo de trabajo). Múltiples por tarea. */}
        <div className="flex items-center gap-1.5 flex-wrap text-sm mb-2">
          <span className="text-ink2 text-sm">Etiquetas</span>
          {!etiquetasHabilitadas && (
            <span className="text-ink2 text-xs">{textoNoHabilitado("las etiquetas")}</span>
          )}
          {etiquetasHabilitadas && (c.etiquetas ?? []).map((et) => (
            <span key={et} className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-full px-2.5 py-0.5 text-xs font-medium">
              {et}
              {!locked && (
                <button type="button" title={`Quitar etiqueta "${et}"`}
                  onClick={() => patch.mutate({ etiquetas: (c.etiquetas ?? []).filter((x) => x !== et), history: hist(`Quitó la etiqueta "${et}"`) })}
                  className="hover:text-danger">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {etiquetasHabilitadas && !locked && (
            <>
              <input list="etiquetas-card" value={nuevaEtiqueta} placeholder="+ etiqueta"
                onChange={(e) => setNuevaEtiqueta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const actualizadas = agregarEtiqueta(c.etiquetas ?? [], nuevaEtiqueta);
                  if (actualizadas.length !== (c.etiquetas ?? []).length) {
                    patch.mutate({ etiquetas: actualizadas, history: hist(`Agregó la etiqueta "${actualizadas[actualizadas.length - 1]}"`) });
                  }
                  setNuevaEtiqueta("");
                }}
                className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-32" />
              <datalist id="etiquetas-card">
                {etiquetasEnUso(cards).map((et) => <option key={et} value={et} />)}
              </datalist>
            </>
          )}
        </div>

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Recurrencia</h4>
        {/* Presets de 1 clic (Kaizen H3): setean el form Y guardan en el mismo clic */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {([
            ["Todos los días", { tipo: "diaria" } as RecurRule, () => { setRecurTipo("diaria"); }],
            ["Cada jueves", { tipo: "semanal", dias: [4] } as RecurRule, () => { setRecurTipo("semanal"); setRecurDias([4]); }],
            ["Día 20 de cada mes", { tipo: "mensual", diaMes: 20 } as RecurRule, () => { setRecurTipo("mensual"); setRecurDiaMes(20); }],
          ] as const).map(([lbl, rule, setForm]) => (
            <button key={lbl} disabled={guardarRecur.isPending}
              onClick={() => { setForm(); guardarRecur.mutate(rule); }}
              className="border border-line bg-surface2 rounded-full px-3 py-1 text-xs hover:border-accent disabled:opacity-60">
              {lbl}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={recurTipo} onChange={(e) => setRecurTipo(e.target.value as RecurRule["tipo"] | "")}
            className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
            <option value="">Sin recurrencia</option>
            <option value="diaria">Diaria</option>
            <option value="semanal">Semanal (días)</option>
            <option value="mensual">Mensual (día del mes)</option>
          </select>
          {recurTipo === "semanal" && (
            <div className="flex flex-wrap gap-1">
              {[["Lun", 1], ["Mar", 2], ["Mié", 3], ["Jue", 4], ["Vie", 5], ["Sáb", 6], ["Dom", 0]].map(([lbl, v]) => {
                const on = recurDias.includes(v as number);
                return (
                  <button key={lbl as string} type="button"
                    onClick={() => setRecurDias((ds) => on ? ds.filter((x) => x !== v) : [...ds, v as number])}
                    className={"rounded-lg px-2 py-1 text-xs border " + (on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface2")}>{lbl}</button>
                );
              })}
            </div>
          )}
          {recurTipo === "mensual" && (
            <label className="flex items-center gap-1.5">Día
              <input type="number" min={1} max={31} value={recurDiaMes}
                onChange={(e) => setRecurDiaMes(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm tnum" />
            </label>
          )}
          <button onClick={() => guardarRecur.mutate(buildRule())} disabled={guardarRecur.isPending}
            className="border border-line bg-surface2 rounded-lg px-3 py-1 text-sm disabled:opacity-60">
            {guardarRecur.isPending ? "Guardando…" : "Guardar recurrencia"}</button>
        </div>
        {recurTipo !== "" && <p className="text-ink2 text-xs mt-1">Genera las ocurrencias del mes en el calendario y en el cumplimiento diario.</p>}
        {(c.recurring || c.recur_rule) && (
          <div className="flex flex-wrap items-center gap-2 text-sm mt-2">
            <label className="flex items-center gap-1.5 text-ink2 text-sm">Ciclo de vida
              <select value={c.reset_policy ?? "mensual"}
                onChange={(e) => {
                  const v = e.target.value as NonNullable<Card["reset_policy"]>;
                  patch.mutate({ reset_policy: v, history: hist("Cambió ciclo de vida a " + v) });
                }}
                className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
                <option value="mensual">Reinicia cada mes</option>
                <option value="mantener">Mantiene su estado</option>
                <option value="manual">Reinicio manual</option>
              </select>
            </label>
          </div>
        )}

        {c.recur_rule?.tipo === "diaria" && (() => {
          const now = new Date();
          return (
            <div className="mt-4">
              <CumplimientoDiario cardId={c.id} owner={c.owner} year={now.getFullYear()} month={now.getMonth() + 1} requiere={!!c.requiere_resultado} />
            </div>
          );
        })()}
    </>
  );
}
