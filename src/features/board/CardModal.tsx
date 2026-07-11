import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";

export function CardModal({ card: c, onClose }: { card: Card; onClose: () => void }) {
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: async (p: Partial<Card>) => {
      const { error } = await supabase.from("cards").update(p).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hist = (txt: string) => [...(c.history ?? []), { who: "—", at: new Date().toISOString(), txt }];
  const toggleCk = (n: number) => {
    const list = c.checklist.map((i, idx) => idx === n ? { ...i, done: !i.done, done_at: !i.done ? new Date().toISOString() : null } : i);
    const allDone = list.length && list.every((i) => i.done);
    patch.mutate(allDone && c.status !== "term"
      ? { checklist: list, status: "term", done_at: new Date().toISOString(), history: hist("Completó checklist ✔") }
      : { checklist: list });
  };

  const estLbl = COLS.find((x) => x[0] === c.status)![1];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40" style={{ backdropFilter: "blur(3px)" }}>
      <div role="dialog" aria-modal className="bg-surface border border-line rounded-[18px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)" }}>
        <h3 className="text-lg font-semibold m-0">{c.title}</h3>
        <div className="text-xs text-ink2 mb-3.5">Estado: {estLbl}{c.done_at && ` · terminada el ${fmtDateTime(c.done_at)}`}</div>

        {c.description && <><h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Detalle</h4><p className="text-sm">{c.description}</p></>}

        {c.checklist.length > 0 && <>
          <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist</h4>
          {c.checklist.map((i, n) => (
            <label key={n} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
              <input type="checkbox" checked={i.done} onChange={() => toggleCk(n)} className="accent-accent w-4 h-4" />
              <span className={i.done ? "line-through text-ink2" : ""}>{i.txt}</span>
            </label>
          ))}
        </>}

        {c.comments.length > 0 && <>
          <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Anotaciones</h4>
          {c.comments.map((m, n) => (
            <div key={n} className="bg-surface2 rounded-lg px-2.5 py-2 mb-1.5">
              <div className="text-xs font-semibold">{m.who} <span className="font-normal text-ink2 tnum">· {fmtDateTime(m.when)}</span></div>
              <p className="text-sm m-0 mt-0.5">{m.txt}</p>
            </div>
          ))}
        </>}

        {(c.history ?? []).length > 0 && (
          <details className="mt-4 text-[13px]">
            <summary className="cursor-pointer text-ink2 uppercase text-xs tracking-wide">Historial ({c.history.length})</summary>
            {[...c.history].reverse().map((h, n) => (
              <div key={n} className="pl-3 border-l-2 border-line ml-1 mt-1.5">{h.txt} <span className="text-ink2">— {h.who}, {fmtDateTime(h.at)}</span></div>
            ))}
          </details>
        )}

        <div className="flex gap-2 mt-4.5 flex-wrap items-center pt-4">
          {c.status !== "term"
            ? <button onClick={() => patch.mutate({ status: "term", done_at: new Date().toISOString(), history: hist("Marcó terminada ✔") })}
                className="bg-accent text-white font-semibold rounded-lg px-3.5 py-2 text-[13px]">✔ Marcar terminada</button>
            : <button onClick={() => patch.mutate({ status: "proc", done_at: null, history: hist("Reabrió la tarea") })}
                className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Reabrir</button>}
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
