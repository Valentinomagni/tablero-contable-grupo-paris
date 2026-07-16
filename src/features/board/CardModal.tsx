import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "../../components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card, type Profile, type ActivityLog, type RecurRule, type TaskOccurrence } from "../../lib/types";
import { ocurrenciasFaltantes, OCC_CONFLICT } from "../../lib/recurrencia";
import { useCardOccurrences } from "../../hooks/useOccurrences";
import { fmtDateTime } from "../../lib/metrics";
import { depInfoOf, dependentsOf, isBlocked, type DepMap } from "../../lib/deps";
import { pushUndo } from "../../lib/undo";
import { isShared, participantes, siblingSyncPatches } from "../../lib/shared";
import { notifsAlFinalizar } from "../../lib/notificaciones";
import { Check, Link2, Lock, Hourglass, X, Users, Pencil, Trash2, Minus, Plus } from "lucide-react";
import { useDepsInfo, useReverseDeps, useSettings } from "../../hooks/useData";
import { editarItem, borrarItem } from "../../lib/checklist";
import { nuevaCantidad } from "../../lib/operativas";
import { CumplimientoDiario } from "./CumplimientoDiario";

export function CardModal({ card: c, cards, team, activity = [], isJefe, onClose, meId, meName = "—" }:
  { card: Card; cards: Card[]; team: Profile[]; activity?: ActivityLog[]; isJefe: boolean; onClose: () => void; meId?: string; meName?: string }) {
  const qc = useQueryClient();
  const [newCk, setNewCk] = useState("");
  const [editCk, setEditCk] = useState<number | null>(null);
  const [editTxt, setEditTxt] = useState("");
  const [newCm, setNewCm] = useState("");
  const [depPerson, setDepPerson] = useState("");
  const [depTask, setDepTask] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [editReg, setEditReg] = useState<string | null>(null);
  const [editRegQty, setEditRegQty] = useState("");
  const [recurTipo, setRecurTipo] = useState<RecurRule["tipo"] | "">(c.recur_rule?.tipo ?? "");
  const [recurDias, setRecurDias] = useState<number[]>(c.recur_rule?.dias ?? []);
  const [recurDiaMes, setRecurDiaMes] = useState<number>(c.recur_rule?.diaMes ?? 1);

  const setRegQty = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase.from("activity_log").update({ qty }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });

  const delReg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activity_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });

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
      // tareas compartidas: si cambió el estado, sincroniza las hermanas (best-effort; trigger DB cubre RLS)
      if (p.status) {
        for (const s of siblingSyncPatches(c, cards, p.status, p.done_at ?? new Date().toISOString())) {
          await supabase.from("cards").update(s.patch).eq("id", s.id);
        }
      }
      // Finalización con impacto → notif al encargado/jefe (spec #8). Best-effort:
      // si la tabla notifications no existe aún, la tarea se termina igual.
      if (p.status === "term" && meId) {
        try {
          const notifs = notifsAlFinalizar({
            card: c, actorId: meId, actorName: meName,
            managerId: team.find((u) => u.id === c.owner)?.manager_id,
          });
          if (notifs.length) await supabase.from("notifications").insert(notifs);
        } catch { /* secundario: se ignora */ }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  const buildRule = (): RecurRule | null => {
    if (recurTipo === "") return null;
    if (recurTipo === "diaria") return { tipo: "diaria" };
    if (recurTipo === "semanal") return { tipo: "semanal", dias: [...recurDias].sort((a, b) => a - b) };
    return { tipo: "mensual", diaMes: recurDiaMes };
  };

  // Guarda la regla en la card y materializa (idempotente) las ocurrencias del mes actual.
  // Falla si la migración 16 aún no fue aplicada — se muestra por toast sin romper la app.
  const guardarRecur = useMutation({
    mutationFn: async () => {
      const rule = buildRule();
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
    onError: (e: Error) => toast.error("No se pudo guardar la recurrencia: " + e.message),
  });

  // Fuente única (spec #4): para tareas recurrentes, el "checklist" del mes = las ocurrencias
  // (misma tabla task_occurrences que el calendario). Marcar acá se refleja allá y viceversa.
  const esRecurrente = !!c.recur_rule;
  const nowRef = new Date();
  const { data: cardOccs = [] } = useCardOccurrences(c.id, nowRef.getFullYear(), nowRef.getMonth() + 1);
  const toggleOccCk = useMutation({
    mutationFn: async (o: TaskOccurrence) => {
      const { error } = await supabase.from("task_occurrences")
        .update({ done: !o.done, done_at: !o.done ? new Date().toISOString() : null }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });
  const fechaCorta = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

  const hist = (txt: string) => [...(c.history ?? []), { who: meName, at: new Date().toISOString(), txt }];
  const toggleCk = (n: number) => {
    const list = c.checklist.map((i, idx) => idx === n ? { ...i, done: !i.done, done_at: !i.done ? new Date().toISOString() : null } : i);
    const allDone = list.length && list.every((i) => i.done);
    patch.mutate(allDone && c.status !== "term"
      ? { checklist: list, status: "term", done_at: new Date().toISOString(), history: hist("Completó checklist") }
      : { checklist: list });
  };

  return (
    <Modal onClose={onClose}>
        <h3 className="text-lg font-semibold m-0">{c.title}</h3>
        <div className="flex items-center gap-2 text-xs text-ink2 mb-3.5">
          <label className="flex items-center gap-1.5">Estado
            <select value={c.status} disabled={locked}
              onChange={(e) => {
                const s = e.target.value as Card["status"];
                patch.mutate(s === "term"
                  ? { status: "term", done_at: new Date().toISOString(), history: hist("Marcó terminada") }
                  : { status: s, done_at: null, history: hist(s === "proc" ? "Pasó a En proceso" : "Volvió a Pendiente") });
              }}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px] disabled:opacity-60">
              {COLS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
            </select>
          </label>
          {c.done_at && <span>terminada el {fmtDateTime(c.done_at)}</span>}
        </div>
        {isShared(c) && (
          <div className="flex items-center gap-2 bg-accent-soft text-accent rounded-lg px-3 py-2 text-[13px] mb-3.5">
            <Users size={14} className="shrink-0" />
            <span>Tarea compartida con <b>{participantes(c, cards, (id) => team.find((u) => u.id === id)?.name ?? "?").join(", ")}</b>. Al terminarla se marca para todos.</span>
          </div>
        )}

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

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Recurrencia</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={recurTipo} onChange={(e) => setRecurTipo(e.target.value as RecurRule["tipo"] | "")}
            className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
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
                    className={"rounded-lg px-2 py-1 text-[12px] border " + (on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface2")}>{lbl}</button>
                );
              })}
            </div>
          )}
          {recurTipo === "mensual" && (
            <label className="flex items-center gap-1.5">Día
              <input type="number" min={1} max={31} value={recurDiaMes}
                onChange={(e) => setRecurDiaMes(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px] tnum" />
            </label>
          )}
          <button onClick={() => guardarRecur.mutate()} disabled={guardarRecur.isPending}
            className="border border-line bg-surface2 rounded-lg px-3 py-1 text-[13px] disabled:opacity-60">
            {guardarRecur.isPending ? "Guardando…" : "Guardar recurrencia"}</button>
        </div>
        {recurTipo !== "" && <p className="text-ink2 text-[12px] mt-1">Genera las ocurrencias del mes en el calendario y en el cumplimiento diario.</p>}

        {c.recur_rule?.tipo === "diaria" && (() => {
          const now = new Date();
          return (
            <div className="mt-4">
              <CumplimientoDiario cardId={c.id} owner={c.owner} year={now.getFullYear()} month={now.getMonth() + 1} />
            </div>
          );
        })()}

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Detalle</h4>
        <textarea defaultValue={c.description} placeholder="Descripción, instrucciones…"
          onBlur={(e) => { if (e.target.value !== c.description) patch.mutate({ description: e.target.value }); }}
          className="w-full bg-surface2 border border-line rounded-lg text-ink text-sm px-2.5 py-2 min-h-[52px] resize-y" />

        {c.card_type === "operativa" && (() => {
          const regs = activity.filter((a) => a.card_id === c.id);
          const saveRegEdit = (id: string) => {
            const q = Math.max(0, Math.round(Number(editRegQty) || 0));
            setRegQty.mutate({ id, qty: q });
            setEditReg(null);
          };
          return (
            <>
              <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Registros ({regs.length})</h4>
              {regs.length === 0 && <p className="text-ink2 text-[13px] m-0">Sin registros todavía.</p>}
              {regs.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1 text-sm">
                  <button title="Restar" onClick={() => setRegQty.mutate({ id: a.id, qty: nuevaCantidad(a.qty, -1) })}
                    className="border border-line bg-surface2 rounded-lg px-1.5 py-1"><Minus size={12} /></button>
                  {editReg === a.id ? (
                    <input autoFocus type="number" min={0} value={editRegQty} onChange={(e) => setEditRegQty(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRegEdit(a.id); if (e.key === "Escape") setEditReg(null); }}
                      onBlur={() => saveRegEdit(a.id)}
                      className="w-16 bg-surface2 border border-accent rounded-lg px-2 py-1 text-ink text-[13px] outline-none tnum" />
                  ) : (
                    <button title="Corregir cantidad" onClick={() => { setEditReg(a.id); setEditRegQty(String(a.qty)); }}
                      className="tnum font-semibold min-w-[2rem] text-center">{a.qty}</button>
                  )}
                  <button title="Sumar" onClick={() => setRegQty.mutate({ id: a.id, qty: nuevaCantidad(a.qty, 1) })}
                    className="border border-line bg-surface2 rounded-lg px-1.5 py-1"><Plus size={12} /></button>
                  <span className="text-ink2 text-xs ml-1">{a.who_name} · {fmtDateTime(a.at)}</span>
                  <button title="Borrar registro" onClick={() => delReg.mutate(a.id)}
                    className="ml-auto border border-line bg-surface2 rounded-lg px-1.5 py-1"><Trash2 size={12} /></button>
                </div>
              ))}
            </>
          );
        })()}

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

        {/* Tareas recurrentes NO diarias: el checklist del mes = las ocurrencias (fuente única, spec #4).
            Diarias usan la grilla de cumplimiento de arriba. Tareas sin recurrencia: checklist normal. */}
        {esRecurrente ? (c.recur_rule?.tipo !== "diaria" && (
          <>
            <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist del mes (ocurrencias)</h4>
            {cardOccs.length === 0 && <p className="text-ink2 text-[13px] m-0">Guardá la recurrencia para generar las ocurrencias del mes.</p>}
            {cardOccs.map((o) => (
              <label key={o.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                <input type="checkbox" checked={o.done} onChange={() => toggleOccCk.mutate(o)} className="accent-accent w-4 h-4 shrink-0" />
                <span className={"flex-1 capitalize " + (o.done ? "line-through text-ink2" : "")}>{fechaCorta(o.fecha)}</span>
              </label>
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
                className="inline-flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-[13px]"><Check size={14} /> Marcar terminada</button>
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
          <span className="ml-auto text-[11.5px] text-ink2">Los cambios se guardan automáticamente.</span>
          <button onClick={onClose} className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Guardar y cerrar</button>
        </div>
    </Modal>
  );
}
