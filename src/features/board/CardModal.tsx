import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "../../components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { type Card, type Profile, type ActivityLog } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";
import { type DepMap } from "../../lib/deps";
import { pushUndo } from "../../lib/undo";
import { siblingSyncPatches } from "../../lib/shared";
import { notifsAlFinalizar, debeNotificarDesdeCliente } from "../../lib/notificaciones";
import { Check, Copy, Lock, Pencil, Trash2, Minus, Plus, Shield, ShieldCheck, Coins, Plane } from "lucide-react";
import { esCobertura } from "../../lib/vacaciones";
import { filaDuplicada } from "../../lib/duplicar";
import { useDepsInfo, useReverseDeps, useSettings, useMigraciones, useTriggerNotificaciones } from "../../hooks/useData";
import { payloadCards } from "../../lib/esquema";
import { escribeEnPeriodo, filaPeriodo, soloDefinicion, CAMPOS_ESTADO } from "../../lib/periodo-escritura";
import { nuevaCantidad, progresoCarga, extraerMetaCarga, conMetaCarga, descripcionSinMeta } from "../../lib/operativas";
import { TXT_REAPERTURA } from "../../lib/retrabajo";
import { Adjuntos } from "./Adjuntos";
import { MetaSection } from "./card/MetaSection";
import { DepsSection } from "./card/DepsSection";
import { ChecklistSection } from "./card/ChecklistSection";
import { ComentariosSection } from "./card/ComentariosSection";

export function CardModal({ card: c, cards, team, activity = [], isJefe, onClose, meId, meName = "—", periodo, vigente }:
  { card: Card; cards: Card[]; team: Profile[]; activity?: ActivityLog[]; isJefe: boolean; onClose: () => void; meId?: string; meName?: string;
    // Períodos (Fase 2): si el mes mirado no es el vigente y la migración 32 está aplicada,
    // el ESTADO (status/checklist/comments/history/tiempos) se escribe en `card_periodos`;
    // la DEFINICIÓN (título, prioridad, deps, ...) sigue en `cards` (es compartida entre meses).
    periodo?: string; vigente?: string }) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleTxt, setTitleTxt] = useState(c.title);
  const [editReg, setEditReg] = useState<string | null>(null);
  const [editRegQty, setEditRegQty] = useState("");

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

  const duplicar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cards").insert(filaDuplicada(c, meName, new Date().toISOString()));
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Tarea duplicada"); },
    onError: (e: Error) => toast.error("No se pudo duplicar: " + e.message),
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
  const { data: settings = { edit_closed: false, categorias: [] } } = useSettings();
  // tarea cerrada: solo jefes la tocan salvo que el permiso edit_closed esté activo (RLS lo aplica en el server)
  const locked = c.status === "term" && !isJefe && !settings.edit_closed;
  const { data: migracionesAplicadas } = useMigraciones();
  // Task 11: con el trigger de la migración 30 activo, la notificación de finalización la
  // genera la base. Si el cliente además la insertara, el aviso saldría DUPLICADO.
  const { data: triggerNotifsActivo } = useTriggerNotificaciones();

  const patch = useMutation({
    mutationFn: async (p: Partial<Card>) => {
      if (locked) throw new Error("Tarea cerrada — solo un jefe puede modificarla.");
      // Esquema de la base (ALTA 1): sin la migración 29, mencionar proc_at / dato_control /
      // tiempo_max_horas hace fallar el update entero (PGRST204). Se filtran acá, en la
      // ÚNICA mutación de patch que usan MetaSection y el resto del modal.
      // Mes NO vigente (Fase 2): la DEFINICIÓN (título, prioridad, deps, ...) sigue en
      // `cards` porque es compartida entre meses; el ESTADO del mes va a `card_periodos`.
      // No sincroniza hermanas ni notifica: eso es del flujo del mes en curso.
      if (periodo !== undefined && vigente !== undefined && escribeEnPeriodo(migracionesAplicadas, periodo, vigente, c.card_type)) {
        const def = soloDefinicion(p);
        if (Object.keys(def).length) {
          const { error: eDef } = await supabase.from("cards").update(payloadCards(def, migracionesAplicadas)).eq("id", c.id);
          if (eDef) throw eDef;
        }
        if (CAMPOS_ESTADO.some((k) => k in p)) {
          const fila = filaPeriodo(c, periodo, p);
          const { error: eEst } = await supabase.from("card_periodos").upsert(fila, { onConflict: "card_id,periodo" });
          if (eEst) throw eEst;
        }
        return;
      }
      const body = payloadCards(p, migracionesAplicadas);
      pushUndo(c, body);
      const { error } = await supabase.from("cards").update(body).eq("id", c.id);
      if (error) throw error;
      // tareas compartidas: si cambió el estado, sincroniza las hermanas (best-effort; trigger DB cubre RLS)
      if (p.status) {
        for (const s of siblingSyncPatches(c, cards, p.status, p.done_at ?? new Date().toISOString())) {
          await supabase.from("cards").update(s.patch).eq("id", s.id);
        }
      }
      // Finalización con impacto → notif al encargado/jefe (spec #8). Best-effort:
      // si la tabla notifications no existe aún, la tarea se termina igual.
      // Con el trigger de la base activo esto NO corre: lo hace el servidor (Task 11).
      if (p.status === "term" && meId && debeNotificarDesdeCliente(triggerNotifsActivo)) {
        try {
          const notifs = notifsAlFinalizar({
            card: c, actorId: meId, actorName: meName,
            managerId: team.find((u) => u.id === c.owner)?.manager_id,
          });
          if (notifs.length) await supabase.from("notifications").insert(notifs);
        } catch { /* secundario: se ignora */ }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["card_periodos"] });
    },
  });

  const hist = (txt: string) => [...(c.history ?? []), { who: meName, at: new Date().toISOString(), txt }];
  const saveTitle = () => {
    const t = titleTxt.trim();
    if (t && t !== c.title) patch.mutate({ title: t, history: hist("Renombró la tarea") });
    setEditTitle(false);
  };

  return (
    <Modal onClose={onClose}>
        {editTitle ? (
          <input autoFocus value={titleTxt} onChange={(e) => setTitleTxt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { e.stopPropagation(); setEditTitle(false); } }}
            onBlur={saveTitle}
            className="w-full bg-surface2 border border-accent rounded-lg px-2.5 py-1.5 text-lg font-semibold text-ink outline-none mb-1" />
        ) : (
          <h3 className="text-lg font-semibold m-0 flex items-center gap-2">
            {c.title}
            {!locked && (
              <button title="Renombrar" onClick={() => { setTitleTxt(c.title); setEditTitle(true); }}
                className="text-ink2 hover:text-accent transition shrink-0"><Pencil size={14} /></button>
            )}
          </h3>
        )}

        <MetaSection c={c} cards={cards} team={team} settings={settings} patch={patch} hist={hist} locked={locked} />

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Detalle</h4>
        <textarea defaultValue={descripcionSinMeta(c.description)} placeholder="Descripción, instrucciones…"
          onBlur={(e) => {
            const visible = descripcionSinMeta(c.description);
            if (e.target.value !== visible) {
              patch.mutate({ description: conMetaCarga(e.target.value, extraerMetaCarga(c.description)) });
            }
          }}
          className="w-full bg-surface2 border border-line rounded-lg text-ink text-sm px-2.5 py-2 min-h-[52px] resize-y" />

        <Adjuntos cardId={c.id} canEdit={!locked} />

        {c.card_type === "operativa" && (() => {
          const regs = activity.filter((a) => a.card_id === c.id);
          const totalQty = regs.reduce((s, a) => s + a.qty, 0);
          const meta = extraerMetaCarga(c.description);
          const { pct, texto } = progresoCarga(totalQty, meta);
          const saveMeta = (v: string) => {
            const n = Math.round(Number(v));
            const nuevaMeta = v.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : n;
            patch.mutate({ description: conMetaCarga(c.description, nuevaMeta) });
          };
          const saveRegEdit = (id: string) => {
            const q = Math.max(0, Math.round(Number(editRegQty) || 0));
            setRegQty.mutate({ id, qty: q });
            setEditReg(null);
          };
          return (
            <>
              <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Registros ({regs.length})</h4>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-ink2 text-xs shrink-0">Meta de carga</label>
                <input type="number" min={1} placeholder="opcional" defaultValue={meta ?? ""} key={meta ?? "sin-meta"}
                  onBlur={(e) => { if ((meta ?? "") !== (e.target.value === "" ? "" : Number(e.target.value))) saveMeta(e.target.value); }}
                  className="w-20 bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px] outline-none tnum" />
                {meta !== null && <span className="text-ink2 text-xs tnum">{texto}</span>}
              </div>
              {meta !== null && (
                <div className="w-full h-1.5 rounded-full bg-surface2 border border-line overflow-hidden mb-2" role="progressbar"
                  aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
              )}
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

        <DepsSection c={c} cards={cards} team={team} depMap={depMap} revDeps={revDeps} nameOf={nameOf} isJefe={isJefe} patch={patch} hist={hist} />

        <ChecklistSection c={c} patch={patch} hist={hist} />

        <ComentariosSection c={c} team={team} meId={meId} meName={meName} patch={patch} />

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
            : <button onClick={() => patch.mutate({ status: "proc", done_at: null, history: hist(TXT_REAPERTURA) })}
                className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Reabrir</button>}
          {!locked && (
            <button onClick={() => duplicar.mutate()} disabled={duplicar.isPending}
              className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-60">
              <Copy size={13} /> {duplicar.isPending ? "Duplicando…" : "Duplicar"}</button>
          )}
          {isJefe && (
            <button title={c.protected ? "Quitar protección" : "Proteger: solo un jefe podrá modificarla o eliminarla"}
              onClick={() => patch.mutate({ protected: !c.protected, history: hist(c.protected ? "Quitó protección" : "Protegió la tarea") })}
              disabled={patch.isPending}
              className={"inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] border disabled:opacity-60 " +
                (c.protected ? "border-accent bg-accent-soft text-accent font-semibold" : "border-line bg-surface2")}>
              {c.protected ? <ShieldCheck size={13} /> : <Shield size={13} />} Protegida</button>
          )}
          {isJefe && (
            <button title={c.requiere_resultado ? "Quitar control de caja" : "Al marcar cada día pedirá el resultado del arqueo (sin/con diferencias)"}
              onClick={() => patch.mutate({ requiere_resultado: !c.requiere_resultado, history: hist(c.requiere_resultado ? "Quitó control de caja" : "Marcó como control de caja (arqueo)") })}
              disabled={patch.isPending}
              className={"inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] border disabled:opacity-60 " +
                (c.requiere_resultado ? "border-accent bg-accent-soft text-accent font-semibold" : "border-line bg-surface2")}>
              <Coins size={13} /> Requiere resultado (control de caja)</button>
          )}
          {isJefe && esCobertura(c).activa && (
            <button title="Reasignar la tarea a su titular original tras la cobertura"
              onClick={() => {
                const nom = esCobertura(c).titular;
                const titular = nom ? team.find((u) => u.name === nom) : undefined;
                if (!titular) { toast.error(`No se encontró al titular${nom ? ` "${nom}"` : ""} en el equipo.`); return; }
                patch.mutate({ owner: titular.id, history: hist("Devuelta al titular tras cobertura") },
                  { onSuccess: () => toast.success(`Devuelta a ${titular.name}`) });
              }}
              disabled={patch.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] border border-line bg-surface2 disabled:opacity-60">
              <Plane size={13} /> Devolver al titular</button>
          )}
          {c.protected && !isJefe ? (
            <span className="inline-flex items-center gap-1.5 text-ink2 text-[13px]"><Lock size={13} /> Tarea protegida por un jefe</span>
          ) : !locked && (confirmDel ? (
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
