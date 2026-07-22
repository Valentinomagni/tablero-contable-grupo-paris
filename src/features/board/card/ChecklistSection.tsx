import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { type Card, type HistoryEntry, type TaskOccurrence } from "../../../lib/types";
import { useCardOccurrences } from "../../../hooks/useOccurrences";
import { editarItem, borrarItem } from "../../../lib/checklist";
import { textoDiferencia } from "../../../lib/arqueo";
import { Pencil, Trash2 } from "lucide-react";
import { ArqueoResultDialog } from "../ArqueoResultDialog";

type PatchMut = UseMutationResult<void, Error, Partial<Card>, unknown>;

// Checklist de la tarea. Para tareas recurrentes NO diarias, el checklist del mes = las
// ocurrencias (fuente única, spec #4). Diarias usan la grilla de arriba. Sin recurrencia: checklist normal.
export function ChecklistSection({ c, patch, hist }:
  { c: Card; patch: PatchMut; hist: (txt: string) => HistoryEntry[] }) {
  const qc = useQueryClient();
  const [newCk, setNewCk] = useState("");
  const [editCk, setEditCk] = useState<number | null>(null);
  const [editTxt, setEditTxt] = useState("");

  // Fuente única (spec #4): para tareas recurrentes, el "checklist" del mes = las ocurrencias
  // (misma tabla task_occurrences que el calendario). Marcar acá se refleja allá y viceversa.
  const esRecurrente = !!c.recur_rule;
  const nowRef = new Date();
  const { data: cardOccs = [] } = useCardOccurrences(c.id, nowRef.getFullYear(), nowRef.getMonth() + 1);
  const toggleOccCk = useMutation({
    mutationFn: async ({ o, extra }: { o: TaskOccurrence; extra?: Partial<TaskOccurrence> }) => {
      const done = !o.done;
      const { error } = await supabase.from("task_occurrences").update({
        done, done_at: done ? new Date().toISOString() : null,
        resultado: done ? (extra?.resultado ?? null) : null,
        dif_importe: done ? (extra?.dif_importe ?? null) : null,
        dif_obs: done ? (extra?.dif_obs ?? null) : null,
      }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });
  // Ocurrencia del checklist mensual pendiente de resultado de arqueo (card de control).
  const [pendingOcc, setPendingOcc] = useState<TaskOccurrence | null>(null);
  const onOccCkClick = (o: TaskOccurrence) => {
    if (!o.done && c.requiere_resultado) { setPendingOcc(o); return; } // marcar → pedir resultado
    toggleOccCk.mutate({ o });                                         // desmarcar o card normal
  };
  const fechaCorta = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

  const toggleCk = (n: number) => {
    const list = c.checklist.map((i, idx) => idx === n ? { ...i, done: !i.done, done_at: !i.done ? new Date().toISOString() : null } : i);
    const allDone = list.length && list.every((i) => i.done);
    patch.mutate(allDone && c.status !== "term"
      ? { checklist: list, status: "term", done_at: new Date().toISOString(), history: hist("Completó checklist") }
      : { checklist: list });
  };

  return (
    <>
        {/* Tareas recurrentes NO diarias: el checklist del mes = las ocurrencias (fuente única, spec #4).
            Diarias usan la grilla de cumplimiento de arriba. Tareas sin recurrencia: checklist normal. */}
        {esRecurrente ? (c.recur_rule?.tipo !== "diaria" && (
          <>
            <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist del mes (ocurrencias)</h4>
            {cardOccs.length === 0 && <p className="text-ink2 text-[13px] m-0">Guardá la recurrencia para generar las ocurrencias del mes.</p>}
            {cardOccs.map((o) => (
              <div key={o.id}>
                <label className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={o.done} onChange={() => onOccCkClick(o)} className="accent-accent w-4 h-4 shrink-0" />
                  <span className={"flex-1 capitalize " + (o.done ? "line-through text-ink2" : "")}>{fechaCorta(o.fecha)}</span>
                  {o.done && o.resultado === "ok" && <span className="text-[11px] text-done">sin diferencias</span>}
                  {o.done && o.resultado === "dif" && (
                    <span className="text-[11px] text-warn" title={o.dif_obs ?? undefined}>{textoDiferencia(o.dif_importe ?? null)}</span>
                  )}
                </label>
                {pendingOcc?.id === o.id && (
                  <ArqueoResultDialog
                    onResolve={(r) => { toggleOccCk.mutate({ o, extra: r }); setPendingOcc(null); }}
                    onCancel={() => setPendingOcc(null)} />
                )}
              </div>
            ))}
          </>
        )) : (
          <>
            <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist</h4>
            {c.checklist.map((i, n) => {
              const saveEdit = () => {
                if (editTxt.trim()) patch.mutate({ checklist: editarItem(c.checklist, n, editTxt.trim()) });
                setEditCk(null);
              };
              return (
                <div key={n} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" checked={i.done} onChange={() => toggleCk(n)} className="accent-accent w-4 h-4 shrink-0" />
                  {editCk === n ? (
                    <input autoFocus value={editTxt} onChange={(e) => setEditTxt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditCk(null); }}
                      onBlur={saveEdit}
                      className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1 text-ink text-[13px]" />
                  ) : (
                    <span className={"flex-1 " + (i.done ? "line-through text-ink2" : "")}>{i.txt}</span>
                  )}
                  <button title="Editar" onClick={() => { setEditCk(n); setEditTxt(c.checklist[n].txt); }}
                    className="border border-line bg-surface2 rounded-lg px-1.5 py-1"><Pencil size={12} /></button>
                  <button title="Borrar" onClick={() => patch.mutate({ checklist: borrarItem(c.checklist, n) })}
                    className="border border-line bg-surface2 rounded-lg px-1.5 py-1"><Trash2 size={12} /></button>
                </div>
              );
            })}
            <div className="flex gap-1.5 mt-1">
              <input value={newCk} onChange={(e) => setNewCk(e.target.value)} placeholder="Nuevo ítem…"
                className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-[13px]" />
              <button onClick={() => { if (newCk.trim()) { patch.mutate({ checklist: [...c.checklist, { txt: newCk.trim(), done: false, done_at: null }] }); setNewCk(""); } }}
                className="border border-line bg-surface2 rounded-lg px-3 text-[13px]">Agregar</button>
            </div>
          </>
        )}
    </>
  );
}
