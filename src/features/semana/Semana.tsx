import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Card } from "../../lib/types";
import { semanaDe, tareasDelDia, poolSinPlan } from "../../lib/semana";
import { pushUndo } from "../../lib/undo";
import { cn } from "../../lib/ui";

// Planificación semanal: arrastrar una tarea a un día = asignarle vencimiento ese día.
export function Semana({ cards, ownerId, meName, onOpen }: {
  cards: Card[]; ownerId: string; meName: string; onOpen: (c: Card) => void;
}) {
  const qc = useQueryClient();
  const dias = semanaDe(Date.now());
  const pool = poolSinPlan(cards, ownerId, dias[0].date);

  const plan = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string | null }) => {
      const c = cards.find((x) => x.id === id)!;
      const hist = [...(c.history ?? []), { who: meName, at: new Date().toISOString(),
        txt: date ? `Planificó para el ${date.split("-").reverse().join("/")}` : "Quitó la fecha planificada" }];
      pushUndo(c, { due_date: date, history: hist });
      const { error } = await supabase.from("cards").update({ due_date: date, history: hist }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
    onError: (e: Error) => toast.error("No se pudo planificar: " + e.message),
  });

  const drop = (e: React.DragEvent, date: string | null) => {
    e.currentTarget.classList.remove("ring-2", "ring-accent");
    const id = e.dataTransfer.getData("text/plain");
    if (id) plan.mutate({ id, date });
  };
  const dragProps = (date: string | null) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-accent"); },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("ring-2", "ring-accent"),
    onDrop: (e: React.DragEvent) => drop(e, date),
  });

  const Mini = ({ c }: { c: Card }) => (
    <div draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)} onClick={() => onOpen(c)}
      className="bg-surface border border-line/70 rounded-lg px-2.5 py-2 mb-1.5 cursor-pointer text-xs font-medium leading-snug transition hover:-translate-y-0.5 hover:border-accent/40"
      style={{ boxShadow: "var(--shadow)" }}>
      {c.title}
      {(c.effort ?? 1) > 1 && <span className="ml-1.5 text-2xs text-ink2 tnum">{c.effort} pts</span>}
      {c.priority === "alta" && <span className="ml-1.5 text-2xs text-danger font-semibold">Alta</span>}
    </div>
  );

  return (
    <div className="flex gap-3 items-start px-6 pb-10 pt-1 overflow-x-auto flex-1">
      <div {...dragProps(null)} className="min-w-[230px] w-[230px] shrink-0 rounded-2xl p-3 border border-dashed border-line bg-surface2/40">
        <h2 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink2 mx-1 mt-0.5 mb-2 font-semibold">
          <CalendarX2 size={13} /> Para planificar
          <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{pool.length}</span>
        </h2>
        {pool.map((c) => (
          <div key={c.id}>
            <Mini c={c} />
            {c.due_date && c.due_date < dias[0].date && (
              <p className="text-danger text-2xs -mt-1 mb-1.5 mx-1">venció el {c.due_date.split("-").reverse().join("/")}</p>
            )}
          </div>
        ))}
        {pool.length === 0 && <p className="text-ink2 text-xs px-1">Nada pendiente de planificar.</p>}
      </div>

      {dias.map((d) => {
        const del = tareasDelDia(cards, ownerId, d.date);
        const pts = del.reduce((s, c) => s + (c.effort ?? 1), 0);
        return (
          <div key={d.date} {...dragProps(d.date)}
            className={cn("min-w-[190px] w-[190px] shrink-0 rounded-2xl p-3 border",
              d.esHoy ? "border-accent/50 bg-accent-soft/40" : "border-line/60 bg-surface2/30")}>
            <h2 className={cn("text-xs uppercase tracking-wider mx-1 mt-0.5 mb-2 font-semibold flex items-center gap-1.5",
              d.esHoy ? "text-accent" : "text-ink2")}>
              {d.lbl}{d.esHoy && <span className="text-2xs bg-accent text-white rounded-full px-1.5 py-px">HOY</span>}
              {pts > 0 && <span className="ml-auto bg-chip text-ink2 rounded-full px-2 py-0.5 tnum">{pts} pts</span>}
            </h2>
            {del.map((c) => <Mini key={c.id} c={c} />)}
            {del.length === 0 && <p className="text-ink2/60 text-xs px-1 mb-0">Libre</p>}
          </div>
        );
      })}
    </div>
  );
}
