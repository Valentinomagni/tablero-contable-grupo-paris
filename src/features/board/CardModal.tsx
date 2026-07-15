import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card, type Profile } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";
import { depInfoOf, dependentsOf, isBlocked, type DepMap } from "../../lib/deps";
import { pushUndo } from "../../lib/undo";
import { Check, Link2, Lock, Hourglass, X } from "lucide-react";
import { useDepsInfo, useReverseDeps, useSettings } from "../../hooks/useData";

export function CardModal({ card: c, cards, team, isJefe, onClose, meName = "—" }:
  { card: Card; cards: Card[]; team: Profile[]; isJefe: boolean; onClose: () => void; meName?: string }) {
  const qc = useQueryClient();
  const [newCk, setNewCk] = useState("");
  const [newCm, setNewCm] = useState("");
  const [depPerson, setDepPerson] = useState("");
  const [depTask, setDepTask] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cards").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); onClose(); },
  });

  const depIds = c.deps ?? [];
  const known = new Set(cards.map((x) => x.id));
  const missing = depIds.filter((id) => !known.has(id));
  const { data: depsInfo = [] } = useDepsInfo(missing);
  const { data: revDeps = [] } = useReverseDeps(cards.map((x) => x.id), !isJefe);
  const depMap: DepMap = Object.fromEntries(depsInfo.map((d) => [d.id, d]));
  const nameOf = (id: string) => team.find((u) => u.id === id)?.name ?? "";
  const { data: settings = { edit_closed: false } } = useSettings();
  // tarea cerrada: solo jefes la tocan salvo que el permiso edit_closed esté activo (RLS lo aplica en el server)
  const locked = c.status === "term" && !isJefe && !settings.edit_closed;

  const patch = useMutation({
    mutationFn: async (p: Partial<Card>) => {
      if (locked) throw new Error("Tarea cerrada — solo un jefe puede modificarla.");
      pushUndo(c, p);
      const { error } = await supabase.from("cards").update(p).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  const hist = (txt: string) => [...(c.history ?? []), { who: meName, at: new Date().toISOString(), txt }];
  const toggleCk = (n: number) => {
    const list = c.checklist.map((i, idx) => idx === n ? { ...i, done: !i.done, done_at: !i.done ? new Date().toISOString() : null } : i);
    const allDone = list.length && list.every((i) => i.done);
    patch.mutate(allDone && c.status !== "term"
      ? { checklist: list, status: "term", done_at: new Date().toISOString(), history: hist("Completó checklist") }
      : { checklist: list });
  };

  const estLbl = COLS.find((x) => x[0] === c.status)![1];

  return (
    <Modal onClose={onClose}>
        <h3 className="text-lg font-semibold m-0">{c.title}</h3>
        <div className="text-xs text-ink2 mb-3.5">Estado: {estLbl}{c.done_at && ` · terminada el ${fmtDateTime(c.done_at)}`}</div>

        <div className="flex gap-4 flex-wrap items-center text-sm text-ink2 mb-2">
          <label className="flex items-center gap-1.5">Vence
            <input type="date" defaultValue={c.due_date ?? ""} onChange={(e) => patch.mutate({ due_date: e.target.value || null, history: hist(e.target.value ? "Puso vencimiento" : "Quitó vencimiento") })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]" />
          </label>
          <label className="flex items-center gap-1.5">Prioridad
            <select defaultValue={c.priority} onChange={(e) => patch.mutate({ priority: e.target.value as Card["priority"], history: hist("Cambió prioridad a " + e.target.value) })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Esfuerzo
            <select defaultValue={String(c.effort ?? 1)} onChange={(e) => patch.mutate({ effort: Number(e.target.value) as Card["effort"], history: hist("Cambió esfuerzo a " + e.target.value) })}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
              <option value="1">1 — Baja</option><option value="2">2 — Media</option><option value="3">3 — Alta</option><option value="5">5 — Muy alta</option>
            </select>
          </label>
        </div>

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Detalle</h4>
        <textarea defaultValue={c.description} placeholder="Descripción, instrucciones…"
          onBlur={(e) => { if (e.target.value !== c.description) patch.mutate({ description: e.target.value }); }}
          className="w-full bg-surface2 border border-line rounded-lg text-ink text-sm px-2.5 py-2 min-h-[52px] resize-y" />

        {(depIds.length > 0 || isJefe) && (
          <>
            <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink2 mt-4 mb-2"><Link2 size={12} /> Depende de</h4>
            {isBlocked(c, cards, depMap) && (
              <div className="bg-warn-soft text-warn rounded-lg px-3 py-2 text-[13px] mb-2">
                Esta tarea está bloqueada: primero deben terminarse las tareas de las que depende.
              </div>
            )}
            {depIds.map((id) => {
              const d = depInfoOf(id, cards, nameOf, depMap);
              if (!d) return null;
              const okDep = d.status === "term";
              return (
                <div key={id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={okDep ? "text-done" : "text-warn"}>{okDep ? <Check size={14} /> : <Lock size={13} />}</span>
                  <span className={okDep ? "text-ink2" : ""}>{d.title} <span className="text-ink2 text-xs">· {d.owner_name} · {okDep ? "terminada" : "sin terminar"}</span></span>
                  {isJefe && (
                    <button title="Quitar dependencia"
                      onClick={() => patch.mutate({ deps: depIds.filter((x) => x !== id), history: hist(`Quitó dependencia: "${d.title}"`) })}
                      className="ml-auto border border-line bg-surface2 rounded-lg px-1.5 py-1"><X size={12} /></button>
                  )}
                </div>
              );
            })}
            {depIds.length === 0 && <p className="text-ink2 text-[13px] m-0">Sin dependencias.</p>}
            {isJefe && (
              <div className="flex gap-1.5 mt-2">
                <select value={depPerson} onChange={(e) => { setDepPerson(e.target.value); setDepTask(""); }}
                  className="bg-surface2 border border-line rounded-lg px-2 py-1.5 text-[13px]">
                  <option value="">Persona…</option>
                  {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select value={depTask} onChange={(e) => setDepTask(e.target.value)} disabled={!depPerson}
                  className="flex-1 bg-surface2 border border-line rounded-lg px-2 py-1.5 text-[13px] disabled:opacity-60">
                  <option value="">Tarea…</option>
                  {cards.filter((x) => x.owner === depPerson && x.id !== c.id && !depIds.includes(x.id))
                    .map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
                <button disabled={!depTask}
                  onClick={() => {
                    const d = depInfoOf(depTask, cards, nameOf, depMap);
                    patch.mutate({ deps: [...depIds, depTask], history: hist(`Vinculó dependencia: "${d?.title ?? "?"}"`) });
                    setDepTask("");
                  }}
                  className="border border-line bg-surface2 rounded-lg px-3 text-[13px] disabled:opacity-60">Vincular</button>
              </div>
            )}
          </>
        )}
        {(() => {
          const dependents = dependentsOf(c.id, cards, nameOf, revDeps, isJefe);
          return dependents.length > 0 && (
            <>
              <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink2 mt-4 mb-2"><Link2 size={12} /> Habilita a (dependen de esta tarea)</h4>
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={d.status === "term" ? "text-done" : "text-accent"}>{d.status === "term" ? <Check size={14} /> : <Hourglass size={13} />}</span>
                  <span className={d.status === "term" ? "text-ink2" : ""}>{d.title} <span className="text-ink2 text-xs">· {d.owner_name} · {d.status === "term" ? "terminada" : "esperándote"}</span></span>
                </div>
              ))}
            </>
          );
        })()}

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist</h4>
        {c.checklist.map((i, n) => (
          <label key={n} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
            <input type="checkbox" checked={i.done} onChange={() => toggleCk(n)} className="accent-accent w-4 h-4" />
            <span className={i.done ? "line-through text-ink2" : ""}>{i.txt}</span>
          </label>
        ))}
        <div className="flex gap-1.5 mt-1">
          <input value={newCk} onChange={(e) => setNewCk(e.target.value)} placeholder="Nuevo ítem…"
            className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-[13px]" />
          <button onClick={() => { if (newCk.trim()) { patch.mutate({ checklist: [...c.checklist, { txt: newCk.trim(), done: false, done_at: null }] }); setNewCk(""); } }}
            className="border border-line bg-surface2 rounded-lg px-3 text-[13px]">Agregar</button>
        </div>

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Anotaciones</h4>
        {c.comments.map((m, n) => (
            <div key={n} className="bg-surface2 rounded-lg px-2.5 py-2 mb-1.5">
              <div className="text-xs font-semibold">{m.who} <span className="font-normal text-ink2 tnum">· {fmtDateTime(m.when)}</span></div>
              <p className="text-sm m-0 mt-0.5">{m.txt}</p>
            </div>
          ))}
        <div className="flex gap-1.5 mt-1">
          <input value={newCm} onChange={(e) => setNewCm(e.target.value)} placeholder="Ej: no avanza porque falta…"
            className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-[13px]" />
          <button onClick={() => { if (newCm.trim()) { patch.mutate({ comments: [...c.comments, { who: meName, when: new Date().toISOString(), txt: newCm.trim() }] }); setNewCm(""); } }}
            className="border border-line bg-surface2 rounded-lg px-3 text-[13px]">Anotar</button>
        </div>

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
            ? <button onClick={() => patch.mutate({ status: "term", done_at: new Date().toISOString(), history: hist("Marcó terminada") })}
                className="inline-flex items-center gap-1.5 bg-accent text-white font-semibold rounded-lg px-3.5 py-2 text-[13px]"><Check size={14} /> Marcar terminada</button>
            : locked ? <span className="inline-flex items-center gap-1.5 text-ink2 text-[13px]"><Lock size={13} /> Solo un jefe puede reabrir esta tarea</span>
            : <button onClick={() => patch.mutate({ status: "proc", done_at: null, history: hist("Reabrió la tarea") })}
                className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Reabrir</button>}
          {!locked && (confirmDel ? (
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <button onClick={() => del.mutate()} disabled={del.isPending}
                className="bg-danger text-white rounded-lg px-3 py-2 font-semibold disabled:opacity-60">{del.isPending ? "Eliminando…" : "Eliminar definitivamente"}</button>
              <button onClick={() => setConfirmDel(false)} className="border border-line bg-surface2 rounded-lg px-3 py-2">Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="border border-danger/40 text-danger rounded-lg px-3.5 py-2 text-[13px]">Eliminar</button>
          ))}
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
    </Modal>
  );
}
