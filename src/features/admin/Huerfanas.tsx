import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Card, Profile } from "../../lib/types";
import { SIN_ASIGNAR_ID } from "../../lib/jerarquia";

// Tareas huérfanas: cards cuyo dueño es el centinela "Sin asignar" (empleado eliminado).
// El jefe las reasigna a cualquier empleado. Vacío hasta que exista una huérfana.
export function Huerfanas({ team, cards }: { team: Profile[]; cards: Card[] }) {
  const qc = useQueryClient();
  const huerfanas = cards.filter((c) => c.owner === SIN_ASIGNAR_ID);
  const [destinos, setDestinos] = useState<Record<string, string>>({});

  const reasignar = useMutation({
    mutationFn: async ({ id, destino }: { id: string; destino: string }) => {
      const { error } = await supabase.from("cards").update({ owner: destino }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Tarea reasignada.");
    },
    onError: (e: Error) => toast.error("No se pudo reasignar: " + e.message),
  });

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";

  return (
    <>
      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">
        Tareas sin asignar{huerfanas.length > 0 ? ` (${huerfanas.length})` : ""}
      </h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        {huerfanas.length === 0 ? (
          <p className="text-ink2 text-[13px] m-0">No hay tareas huérfanas. Aparecen acá cuando se elimina un empleado con tareas abiertas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {huerfanas.map((c) => {
              const destino = destinos[c.id] ?? "";
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="flex-1 min-w-[160px] text-[13px] text-ink truncate">{c.title}</span>
                  <select value={destino} onChange={(e) => setDestinos((d) => ({ ...d, [c.id]: e.target.value }))} className={inputCls}>
                    <option value="">Reasignar a…</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <button onClick={() => reasignar.mutate({ id: c.id, destino })} disabled={!destino || reasignar.isPending}
                    className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">
                    <ArrowRightLeft size={14} /> Reasignar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
