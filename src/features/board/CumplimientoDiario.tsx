import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { TaskOccurrence } from "../../lib/types";
import { useCardOccurrences } from "../../hooks/useOccurrences";
import { claveFecha } from "../../lib/calendario";
import { cn } from "../../lib/ui";

const pad = (n: number) => String(n).padStart(2, "0");

// Grilla mensual de cumplimiento diario (spec #11): un cuadrado por día del mes.
// verde = hecho, gris = pendiente futuro, rojo = día pasado sin hacer. Click alterna done.
// Fuente única: lee/escribe task_occurrences (misma tabla que el calendario).
export function CumplimientoDiario({ cardId, owner, year, month }: { cardId: string; owner: string; year: number; month: number }) {
  const qc = useQueryClient();
  const { data: ocurrencias = [] } = useCardOccurrences(cardId, year, month);
  const hoyISO = claveFecha(new Date());
  const diasEnMes = new Date(year, month, 0).getDate();

  const porFecha = useMemo(() => {
    const m: Record<string, TaskOccurrence> = {};
    for (const o of ocurrencias) m[o.fecha] = o;
    return m;
  }, [ocurrencias]);

  const toggle = useMutation({
    mutationFn: async (fecha: string) => {
      const existente = porFecha[fecha];
      if (existente) {
        const { error } = await supabase.from("task_occurrences")
          .update({ done: !existente.done, done_at: !existente.done ? new Date().toISOString() : null }).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_occurrences")
          .upsert({ card_id: cardId, owner, fecha, done: true, done_at: new Date().toISOString() }, { onConflict: "card_id,fecha" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });

  const hechos = ocurrencias.filter((o) => o.done).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs uppercase tracking-wide text-ink2">Cumplimiento diario</h4>
        <span className="text-[12px] text-ink2 tnum">{hechos}/{diasEnMes} días</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1;
          const fecha = `${year}-${pad(month)}-${pad(dia)}`;
          const o = porFecha[fecha];
          const done = !!o?.done;
          const pasadoSinHacer = !done && fecha < hoyISO;
          return (
            <button key={fecha} onClick={() => toggle.mutate(fecha)} disabled={toggle.isPending}
              title={fecha + (done ? " · hecho" : pasadoSinHacer ? " · sin hacer" : " · pendiente")}
              className={cn("h-9 rounded-lg text-[12px] tnum border grid place-items-center transition",
                done ? "bg-accent text-white border-accent font-semibold"
                  : pasadoSinHacer ? "border-danger/50 text-danger bg-surface2"
                  : "border-line bg-surface2 text-ink2",
                fecha === hoyISO && "ring-2 ring-accent")}>
              {dia}
            </button>
          );
        })}
      </div>
      <p className="text-ink2 text-[12px] mt-2">Tocá un día para registrar el cumplimiento (ej: arqueo de caja).</p>
    </div>
  );
}
