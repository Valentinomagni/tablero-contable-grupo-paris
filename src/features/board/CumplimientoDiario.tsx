import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { TaskOccurrence } from "../../lib/types";
import { useCardOccurrences, useCardOccurrencesAll } from "../../hooks/useOccurrences";
import { claveFecha } from "../../lib/calendario";
import { statsArqueo, evolucionMensual, textoDiferencia } from "../../lib/arqueo";
import { cn } from "../../lib/ui";
import { ArqueoResultDialog } from "./ArqueoResultDialog";

const pad = (n: number) => String(n).padStart(2, "0");

// Grilla mensual de cumplimiento diario (spec #11): un cuadrado por día del mes.
// verde = hecho, gris = pendiente futuro, rojo = día pasado sin hacer. Click alterna done.
// Fuente única: lee/escribe task_occurrences (misma tabla que el calendario).
// Arqueo (spec24 item 9): si `requiere`, al marcar un día pide el resultado (ok/dif) y colorea
// los días según el resultado; muestra panel de cumplimiento + mini evolución 6 meses.
export function CumplimientoDiario({ cardId, owner, year, month, requiere = false }:
  { cardId: string; owner: string; year: number; month: number; requiere?: boolean }) {
  const qc = useQueryClient();
  const { data: ocurrencias = [] } = useCardOccurrences(cardId, year, month);
  const { data: todas = [] } = useCardOccurrencesAll(cardId, requiere);
  const hoyISO = claveFecha(new Date());
  const diasEnMes = new Date(year, month, 0).getDate();
  const mesPrefix = `${year}-${pad(month)}`;
  const [pendiente, setPendiente] = useState<string | null>(null);

  const porFecha = useMemo(() => {
    const m: Record<string, TaskOccurrence> = {};
    for (const o of ocurrencias) m[o.fecha] = o;
    return m;
  }, [ocurrencias]);

  const stats = useMemo(() => statsArqueo(ocurrencias, mesPrefix), [ocurrencias, mesPrefix]);
  const evolucion = useMemo(() => evolucionMensual(todas, mesPrefix, 6), [todas, mesPrefix]);

  // Marca/actualiza una ocurrencia. `extra` transporta el resultado del arqueo (ok/dif) cuando aplica.
  const setOcc = useMutation({
    mutationFn: async ({ fecha, done, extra }: { fecha: string; done: boolean; extra?: Partial<TaskOccurrence> }) => {
      const existente = porFecha[fecha];
      const payload = {
        done,
        done_at: done ? new Date().toISOString() : null,
        // al desmarcar limpiamos el resultado; al marcar sin arqueo también queda null
        resultado: done ? (extra?.resultado ?? null) : null,
        dif_importe: done ? (extra?.dif_importe ?? null) : null,
        dif_obs: done ? (extra?.dif_obs ?? null) : null,
      };
      if (existente) {
        const { error } = await supabase.from("task_occurrences").update(payload).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_occurrences")
          .upsert({ card_id: cardId, owner, fecha, ...payload }, { onConflict: "card_id,fecha" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occurrences"] });
    },
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });

  const onDiaClick = (fecha: string) => {
    const done = !!porFecha[fecha]?.done;
    if (done) { setOcc.mutate({ fecha, done: false }); return; } // desmarcar
    if (requiere) { setPendiente(fecha); return; }                // pedir resultado
    setOcc.mutate({ fecha, done: true });                          // marcado simple
  };

  const hechos = ocurrencias.filter((o) => o.done).length;

  return (
    <div>
      {requiere && (
        <div className="border border-line rounded-lg bg-surface2 p-3 mb-3">
          <div className="text-sm text-ink">
            Cumplimiento: <b className="tnum">{stats.pctOk}%</b> · <span className="tnum">{stats.ok}/{stats.total}</span> sin diferencias
            {stats.dif > 0 && <span className="text-warn"> · {stats.dif} con diferencias</span>}
          </div>
          <div className="flex items-end gap-1 mt-2 h-10" title="Evolución de cumplimiento (últimos 6 meses)">
            {evolucion.map((e) => (
              <div key={e.mes} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${e.mes}: ${e.pctOk}%`}>
                <div className="w-full rounded-t bg-ink/70" style={{ height: `${Math.max(2, Math.round(e.pctOk * 0.28))}px` }} />
                <span className="text-2xs text-ink2 tnum">{e.mes.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs uppercase tracking-wide text-ink2">Cumplimiento diario</h4>
        <span className="text-xs text-ink2 tnum">{hechos}/{diasEnMes} días</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1;
          const fecha = `${year}-${pad(month)}-${pad(dia)}`;
          const o = porFecha[fecha];
          const done = !!o?.done;
          const esOk = done && o?.resultado === "ok";
          const esDif = done && o?.resultado === "dif";
          const pasadoSinHacer = !done && fecha < hoyISO;
          const tituloDif = esDif ? ` · ${textoDiferencia(o?.dif_importe ?? null)}${o?.dif_obs ? " — " + o.dif_obs : ""}` : "";
          return (
            <button key={fecha} onClick={() => onDiaClick(fecha)} disabled={setOcc.isPending}
              title={fecha + (esDif ? tituloDif : done ? " · hecho" : pasadoSinHacer ? " · sin hacer" : " · pendiente")}
              className={cn("h-9 rounded-lg text-xs tnum border grid place-items-center transition",
                esDif ? "bg-warn-soft text-warn border-warn/50 font-semibold"
                  : esOk ? "bg-accent text-white border-accent font-semibold"
                  : done ? "bg-accent text-white border-accent font-semibold"
                  : pasadoSinHacer ? "border-danger/50 text-danger bg-surface2"
                  : "border-line bg-surface2 text-ink2",
                fecha === hoyISO && "ring-2 ring-accent")}>
              {dia}
            </button>
          );
        })}
      </div>
      {pendiente && (
        <ArqueoResultDialog
          onResolve={(r) => { setOcc.mutate({ fecha: pendiente, done: true, extra: r }); setPendiente(null); }}
          onCancel={() => setPendiente(null)} />
      )}
      <p className="text-ink2 text-xs mt-2">
        {requiere ? "Tocá un día para registrar el arqueo (sin diferencias o con diferencias)." : "Tocá un día para registrar el cumplimiento (ej: arqueo de caja)."}
      </p>
    </div>
  );
}
