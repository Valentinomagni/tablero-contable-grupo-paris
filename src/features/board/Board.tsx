import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card, type Status, type ActivityLog } from "../../lib/types";
import { dueInfo, fmtDateTime } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import { pushUndo } from "../../lib/undo";
import { Clock, ListChecks, Lock, Hourglass, Repeat, MessageSquare, Check } from "lucide-react";

const DOT: Record<string, string> = { pend: "bg-naranja", proc: "bg-s1", term: "bg-done" };

function DueBadge({ c }: { c: Card }) {
  const info = dueInfo(c);
  if (!info || c.status === "term") return null;
  const cls = info.days < 0 ? "bg-danger-soft text-danger"
    : info.days <= 3 ? "bg-warn-soft text-warn" : "bg-chip text-ink2";
  const txt = info.days < 0 ? `Venció ${info.lbl}` : `Vence ${info.lbl}`;
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap tnum", cls)}><Clock size={11} /> {txt}</span>;
}

function CardItem({ c, blocked, waiting, onOpen }: { c: Card; blocked: boolean; waiting: boolean; onOpen: (c: Card) => void }) {
  const ck = c.checklist.length
    ? <span className="inline-flex items-center gap-1 bg-chip rounded-md px-1.5 py-0.5 tnum"><ListChecks size={11} /> {c.checklist.filter((i) => i.done).length}/{c.checklist.length}</span> : null;
  const pr = c.priority === "alta"
    ? <span className="bg-danger-soft text-danger rounded-md px-2 py-0.5 font-semibold">Alta</span> : null;
  return (
    <div onClick={() => onOpen(c)}
      className="bg-surface rounded-xl px-3.5 py-3 mb-2 cursor-pointer border border-line/70 transition
        hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-lg)]"
      style={{ boxShadow: "var(--shadow)" }}>
      <div className="font-semibold text-[13.5px] tracking-tight leading-snug">{c.title}</div>
      <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2 items-center">
        {blocked && <span className="inline-flex items-center gap-1 bg-warn-soft text-warn rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Lock size={11} /> Bloqueada</span>}
        {waiting && <span className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Hourglass size={11} /> Te esperan</span>}
        {pr}<DueBadge c={c} />{c.recurring && <span title="Mensual"><Repeat size={12} /></span>}
        {(c.effort ?? 1) > 1 && <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">{c.effort} pts</span>}
        {ck}{c.comments.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {c.comments.length}</span>}
      </div>
      {c.done_at && <div className="flex items-center gap-1 text-done font-semibold text-xs mt-1.5"><Check size={12} /> Terminada el {fmtDateTime(c.done_at)}</div>}
    </div>
  );
}

export function Board({ cards, activity, ownerId, meName, query = "", onOpen }: {
  cards: Card[]; activity: ActivityLog[]; ownerId: string; meName: string; query?: string; onOpen: (c: Card) => void;
}) {
  const qc = useQueryClient();
  const q = query.trim().toLowerCase();
  const matches = (c: Card) => !q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
  const mine = cards.filter((c) => c.owner === ownerId && c.card_type !== "operativa" && matches(c));
  const opers = cards.filter((c) => c.owner === ownerId && c.card_type === "operativa" && matches(c));
  const byId = (id: string) => cards.find((x) => x.id === id);
  const isBlocked = (c: Card) => c.status !== "term" && (c.deps ?? []).some((id) => (byId(id)?.status ?? "term") !== "term");
  const dependents = (id: string) => cards.filter((x) => (x.deps ?? []).includes(id) && x.status !== "term");

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const c = byId(id)!;
      const patch: Partial<Card> = { status };
      if (status === "term") patch.done_at = new Date().toISOString();
      else if (c.status === "term") patch.done_at = null;
      const hist = [...(c.history ?? []), { who: meName, at: new Date().toISOString(), txt: status === "term" ? "Marcó terminada" : "Movió la tarea" }];
      pushUndo(c, { ...patch, history: hist });
      const { error } = await supabase.from("cards").update({ ...patch, history: hist }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  const add = useMutation({
    mutationFn: async ({ status, title, oper }: { status: Status; title: string; oper?: boolean }) => {
      const row = {
        owner: ownerId, title,
        status: oper ? "proc" : status,
        card_type: oper ? "operativa" : "normal",
        history: [{ who: meName, at: new Date().toISOString(), txt: oper ? "Creó operativa" : "Creó la tarea" }],
      };
      const { error } = await supabase.from("cards").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  const registrar = useMutation({
    mutationFn: async ({ cardId, qty }: { cardId: string; qty: number }) => {
      const { error } = await supabase.from("activity_log").insert({ card_id: cardId, owner: ownerId, who_name: meName, qty, note: "" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });

  const promptAdd = (status: Status) => { const t = prompt("Título de la tarea:"); if (t?.trim()) add.mutate({ status, title: t.trim() }); };
  const promptOper = () => { const t = prompt("Nombre de la tarea operativa (ej: Pagos a proveedores):"); if (t?.trim()) add.mutate({ status: "proc", title: t.trim(), oper: true }); };
  const promptReg = (cardId: string) => { const q = prompt("¿Cuántas unidades registrás?", "1"); if (q !== null) registrar.mutate({ cardId, qty: Math.max(1, Math.round(Number(q) || 1)) }); };

  const hoyStr = new Date().toDateString();
  const colBg = { background: "color-mix(in srgb,var(--surface2) 55%,var(--bg))" };

  return (
    <div className="flex gap-4 items-start px-6 pb-10 overflow-x-auto flex-1">
      {COLS.map(([k, lbl]) => (
        <div key={k}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-accent"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-accent")}
          onDrop={(e) => { e.currentTarget.classList.remove("ring-2", "ring-accent"); const id = e.dataTransfer.getData("text/plain"); if (id) move.mutate({ id, status: k }); }}
          className="min-w-[290px] w-[290px] shrink-0 rounded-2xl p-3 border border-line/60" style={colBg}>
          <h2 className="text-xs uppercase tracking-wider text-ink2 mx-1.5 mt-1 mb-2.5 flex items-center gap-2 font-semibold">
            <i className={cn("w-2 h-2 rounded-full", DOT[k])} />{lbl}
            <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{mine.filter((c) => c.status === k).length}</span>
          </h2>
          {mine.filter((c) => c.status === k).map((c) => (
            <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>
              <CardItem c={c} blocked={isBlocked(c)} waiting={c.status !== "term" && dependents(c.id).length > 0} onOpen={onOpen} />
            </div>
          ))}
          {mine.filter((c) => c.status === k).length === 0 && <p className="text-ink2 text-[13px] px-2 pb-2">Sin tareas acá.</p>}
          {k !== "term" && (
            <button onClick={() => promptAdd(k)} className="w-full border border-dashed border-line rounded-lg py-2 text-[13px] text-ink2 hover:text-accent hover:border-accent transition">+ Añadir tarea</button>
          )}
        </div>
      ))}

      <div className="min-w-[290px] w-[290px] shrink-0 rounded-2xl p-3 border border-dashed border-line/60" style={colBg}>
        <h2 className="text-xs uppercase tracking-wider text-ink2 mx-1.5 mt-1 mb-2.5 flex items-center gap-2 font-semibold">
          <i className="w-2 h-2 rounded-full bg-accent" />Operativas · a demanda
          <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{opers.length}</span>
        </h2>
        {opers.map((c) => {
          const regs = activity.filter((a) => a.card_id === c.id);
          const hoy = regs.filter((a) => new Date(a.at).toDateString() === hoyStr).reduce((s, a) => s + a.qty, 0);
          const sem = regs.filter((a) => Date.now() - new Date(a.at).getTime() < 7 * 86400000).reduce((s, a) => s + a.qty, 0);
          return (
            <div key={c.id} onClick={() => onOpen(c)} className="bg-surface rounded-lg p-3 mb-2 cursor-pointer border border-transparent hover:border-accent/30 transition" style={{ boxShadow: "var(--ring),var(--shadow)" }}>
              <div className="font-semibold text-sm tracking-tight">{c.title}</div>
              <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2">
                <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">hoy: {hoy}</span>
                <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">7 días: {sem}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); promptReg(c.id); }} className="w-full mt-2 border border-line bg-surface2 rounded-lg py-1 text-xs">＋ Registrar</button>
            </div>
          );
        })}
        {opers.length === 0 && <p className="text-ink2 text-[13px] px-2 pb-2">Pagos, trámites y gestiones a demanda: no se cierran, se registran.</p>}
        <button onClick={promptOper} className="w-full border border-dashed border-line rounded-lg py-2 text-[13px] text-ink2 hover:text-accent hover:border-accent transition">+ Añadir operativa</button>
      </div>
    </div>
  );
}
