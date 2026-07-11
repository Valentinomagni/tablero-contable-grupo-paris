import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card, type Status } from "../../lib/types";
import { dueInfo, fmtDateTime } from "../../lib/metrics";
import { cn } from "../../lib/ui";

const DOT: Record<string, string> = { pend: "bg-naranja", proc: "bg-s1", term: "bg-done" };

function DueBadge({ c }: { c: Card }) {
  const info = dueInfo(c);
  if (!info || c.status === "term") return null;
  const cls = info.days < 0 ? "bg-danger-soft text-danger"
    : info.days <= 3 ? "bg-warn-soft text-warn" : "bg-chip text-ink2";
  const txt = info.days < 0 ? `Venció ${info.lbl}` : `Vence ${info.lbl}`;
  return <span className={cn("rounded-md px-2 py-0.5 font-semibold whitespace-nowrap tnum", cls)}>⏰ {txt}</span>;
}

function CardItem({ c, onOpen }: { c: Card; onOpen: (c: Card) => void }) {
  const ck = c.checklist.length
    ? <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">☑ {c.checklist.filter((i) => i.done).length}/{c.checklist.length}</span> : null;
  const pr = c.priority === "alta"
    ? <span className="bg-danger-soft text-danger rounded-md px-2 py-0.5 font-semibold">▲ Alta</span> : null;
  return (
    <div onClick={() => onOpen(c)}
      className="bg-surface rounded-lg p-3 mb-2 cursor-pointer border border-transparent transition
        hover:-translate-y-0.5 hover:border-accent/30"
      style={{ boxShadow: "var(--ring),var(--shadow)" }}>
      <div className="font-semibold text-sm tracking-tight">{c.title}</div>
      <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2 items-center">
        {pr}<DueBadge c={c} />{c.recurring && <span title="Mensual">🔁</span>}
        {(c.effort ?? 1) > 1 && <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">{c.effort} pts</span>}
        {ck}{c.comments.length > 0 && <span>💬 {c.comments.length}</span>}
      </div>
      {c.done_at && <div className="text-done font-semibold text-xs mt-1.5">✔ Terminada el {fmtDateTime(c.done_at)}</div>}
    </div>
  );
}

export function Board({ cards, ownerId, onOpen }: { cards: Card[]; ownerId: string; onOpen: (c: Card) => void }) {
  const qc = useQueryClient();
  const mine = cards.filter((c) => c.owner === ownerId && c.card_type !== "operativa");

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const c = cards.find((x) => x.id === id)!;
      const patch: Partial<Card> = { status };
      if (status === "term") patch.done_at = new Date().toISOString();
      else if (c.status === "term") patch.done_at = null;
      const hist = [...(c.history ?? []), { who: "—", at: new Date().toISOString(), txt: status === "term" ? "Marcó terminada ✔" : "Movió la tarea" }];
      const { error } = await supabase.from("cards").update({ ...patch, history: hist }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  return (
    <div className="flex gap-4 items-start px-6 pb-10 overflow-x-auto flex-1">
      {COLS.map(([k, lbl]) => (
        <div key={k}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-accent"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-accent")}
          onDrop={(e) => { e.currentTarget.classList.remove("ring-2", "ring-accent"); const id = e.dataTransfer.getData("text/plain"); if (id) move.mutate({ id, status: k }); }}
          className="min-w-[290px] w-[290px] shrink-0 rounded-2xl p-3 border border-line/60"
          style={{ background: "color-mix(in srgb,var(--surface) 55%,transparent)", backdropFilter: "blur(8px)", boxShadow: "var(--ring)" }}>
          <h2 className="text-xs uppercase tracking-wider text-ink2 mx-1.5 mt-1 mb-2.5 flex items-center gap-2 font-semibold">
            <i className={cn("w-2 h-2 rounded-full", DOT[k])} />{lbl}
            <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{mine.filter((c) => c.status === k).length}</span>
          </h2>
          {mine.filter((c) => c.status === k).map((c) => (
            <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>
              <CardItem c={c} onOpen={onOpen} />
            </div>
          ))}
          {mine.filter((c) => c.status === k).length === 0 && <p className="text-ink2 text-[13px] px-2 pb-2">Sin tareas acá.</p>}
        </div>
      ))}
    </div>
  );
}
