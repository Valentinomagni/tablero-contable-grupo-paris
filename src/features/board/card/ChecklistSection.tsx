import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { type Card, type ChecklistItem, type HistoryEntry, type TaskOccurrence } from "../../../lib/types";
import { useCardOccurrences } from "../../../hooks/useOccurrences";
import { useMigraciones } from "../../../hooks/useData";
import { tieneChecklistDiario, payloadOccurrences } from "../../../lib/esquema";
import { mensajeUsuario } from "../../../lib/fallas";
import { toARTDate } from "../../../lib/metrics";
import { editarItem, borrarItem } from "../../../lib/checklist";
import { textoDiferencia } from "../../../lib/arqueo";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
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
    onError: (e: Error) => toast.error(mensajeUsuario(e, "actualizar el checklist")),
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
            Diarias: checklist POR DÍA sobre la ocurrencia de la fecha elegida (migración 34, queja #2);
            el cumplimiento (marcar el día hecho) sigue siendo la grilla de arriba.
            Tareas sin recurrencia: checklist normal de la card. */}
        {esRecurrente ? (c.recur_rule?.tipo === "diaria" ? <ChecklistDelDia c={c} /> : (
          <>
            <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Checklist del mes (ocurrencias)</h4>
            {cardOccs.length === 0 && <p className="text-ink2 text-sm m-0">Guardá la recurrencia para generar las ocurrencias del mes.</p>}
            {cardOccs.map((o) => (
              <div key={o.id}>
                <label className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={o.done} onChange={() => onOccCkClick(o)} className="accent-accent w-4 h-4 shrink-0" />
                  <span className={"flex-1 capitalize " + (o.done ? "line-through text-ink2" : "")}>{fechaCorta(o.fecha)}</span>
                  {o.done && o.resultado === "ok" && <span className="text-2xs text-done">sin diferencias</span>}
                  {o.done && o.resultado === "dif" && (
                    <span className="text-2xs text-warn" title={o.dif_obs ?? undefined}>{textoDiferencia(o.dif_importe ?? null)}</span>
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
                      className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1 text-ink text-sm" />
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
                className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-sm" />
              <button onClick={() => { if (newCk.trim()) { patch.mutate({ checklist: [...c.checklist, { txt: newCk.trim(), done: false, done_at: null }] }); setNewCk(""); } }}
                className="border border-line bg-surface2 rounded-lg px-3 text-sm">Agregar</button>
            </div>
          </>
        )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

// Checklist POR DÍA de una tarea recurrente diaria (migración 34 — queja original #2).
//
// PROBLEMA QUE RESUELVE: hasta acá una tarea diaria tenía UN solo checklist (el de la card),
// compartido por todas las fechas. Al reiniciarse la recurrencia se perdía lo tildado ayer.
// `task_occurrences` ya guarda una fila inmutable por (card_id, fecha), así que el detalle
// del día vive ahí: cada fecha tiene su propio checklist y su propia observación.
//
// DEFENSIVO: sin la migración 34 aplicada las columnas no existen → no se muestra nada y la
// tarea diaria se comporta EXACTAMENTE como hoy (antes acá tampoco se renderizaba checklist).
//
// La fecha se elige acá mismo, con las flechas, dentro del mes en curso — el mismo mes que
// muestra la grilla de cumplimiento. Marcar el día como hecho SIGUE siendo cosa de la grilla:
// este bloque sólo edita el detalle, no toca `done` ni el `resultado` del arqueo.
function ChecklistDelDia({ c }: { c: Card }) {
  const qc = useQueryClient();
  const { data: aplicadas } = useMigraciones();
  const habilitado = tieneChecklistDiario(aplicadas);

  // Día argentino: el checklist diario se abre en el día que el equipo está viviendo,
  // no en el del reloj del navegador (en UTC ya sería mañana después de las 21 de acá).
  const hoy = toARTDate(new Date().toISOString());
  const year = Number(hoy.slice(0, 4));
  const month = Number(hoy.slice(5, 7));
  const diasEnMes = new Date(year, month, 0).getDate();
  const [fecha, setFecha] = useState(hoy);
  const [nuevo, setNuevo] = useState("");

  const { data: occs = [] } = useCardOccurrences(c.id, year, month);
  const occ = useMemo(() => occs.find((o) => o.fecha === fecha), [occs, fecha]);
  const items: ChecklistItem[] = occ?.checklist ?? [];

  // Guarda el detalle del día. Si todavía no hay fila para esa fecha, la crea.
  // El payload pasa por payloadOccurrences: si faltara la migración, las columnas nuevas no
  // viajan y el update no revienta con 42703.
  const guardar = useMutation({
    mutationFn: async (cambios: { checklist?: ChecklistItem[]; obs?: string | null }) => {
      const payload = payloadOccurrences(cambios, aplicadas);
      if (Object.keys(payload).length === 0) return; // sin migración no hay nada que guardar
      if (occ) {
        const { error } = await supabase.from("task_occurrences").update(payload).eq("id", occ.id);
        if (error) throw error;
      } else {
        // OJO con `done: false` acá: PostgREST traduce el upsert a ON CONFLICT DO UPDATE SET
        // para CADA columna del payload, así que si la fila ya existía en la base, mandar
        // `done:false` la PISA y el día queda desmarcado como no hecho.
        //
        // Y esta rama corre cuando `occ` es undefined, que no significa "no existe": significa
        // "no la tengo". `useCardOccurrences` es defensivo a ultranza y devuelve [] ante
        // cualquier error, así que un corte de red o un 401 momentáneo bastaba para que
        // tildar un ítem del checklist borrara el cumplimiento del día, sin ningún aviso.
        // Peor todavía: `resultado` no viaja en el payload, así que sobrevivía, y quedaba una
        // fila con done=false y resultado='ok' — un estado que ninguna parte del código
        // contempla.
        //
        // La solución es no opinar sobre `done` en el upsert: si la fila es nueva, la columna
        // toma su default de la base (false); si ya existía, se respeta lo que había.
        const { error } = await supabase.from("task_occurrences")
          .upsert({ card_id: c.id, owner: c.owner, fecha, ...payload },
            { onConflict: "card_id,fecha" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
    onError: (e: Error) => toast.error(mensajeUsuario(e, "guardar el checklist del día")),
  });

  if (!habilitado) return null;

  const dia = Number(fecha.slice(8, 10));
  const moverDia = (delta: number) => {
    const d = Math.min(diasEnMes, Math.max(1, dia + delta));
    setFecha(`${year}-${pad(month)}-${pad(d)}`);
  };
  const etiquetaFecha = new Date(fecha + "T12:00:00")
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  const toggle = (n: number) => guardar.mutate({
    checklist: items.map((i, idx) => idx === n
      ? { ...i, done: !i.done, done_at: !i.done ? new Date().toISOString() : null } : i),
  });

  return (
    <>
      <div className="flex items-center justify-between mt-4 mb-2">
        <h4 className="text-xs uppercase tracking-wide text-ink2 m-0">Checklist del día</h4>
        <div className="flex items-center gap-1">
          <button title="Día anterior" onClick={() => moverDia(-1)} disabled={dia <= 1}
            className="border border-line bg-surface2 rounded-lg px-1.5 py-1 disabled:opacity-40">
            <ChevronLeft size={12} />
          </button>
          <span className="text-xs text-ink capitalize min-w-[9.5rem] text-center">{etiquetaFecha}</span>
          <button title="Día siguiente" onClick={() => moverDia(1)} disabled={dia >= diasEnMes}
            className="border border-line bg-surface2 rounded-lg px-1.5 py-1 disabled:opacity-40">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="text-ink2 text-sm m-0 mb-1.5">
          Este día todavía no tiene ítems. Lo que tildes acá queda guardado para esta fecha y no
          se borra cuando la tarea se reinicia.
        </p>
      )}

      {items.map((i, n) => (
        <div key={n} className="flex items-center gap-2 py-1 text-sm">
          <input type="checkbox" checked={i.done} onChange={() => toggle(n)} className="accent-accent w-4 h-4 shrink-0" />
          <span className={"flex-1 " + (i.done ? "line-through text-ink2" : "")}>{i.txt}</span>
          <button title="Borrar" onClick={() => guardar.mutate({ checklist: borrarItem(items, n) })}
            className="border border-line bg-surface2 rounded-lg px-1.5 py-1"><Trash2 size={12} /></button>
        </div>
      ))}

      <div className="flex gap-1.5 mt-1">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nuevo ítem del día…"
          onKeyDown={(e) => { if (e.key === "Enter" && nuevo.trim()) { guardar.mutate({ checklist: [...items, { txt: nuevo.trim(), done: false, done_at: null }] }); setNuevo(""); } }}
          className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-sm" />
        <button onClick={() => { if (nuevo.trim()) { guardar.mutate({ checklist: [...items, { txt: nuevo.trim(), done: false, done_at: null }] }); setNuevo(""); } }}
          className="border border-line bg-surface2 rounded-lg px-3 text-sm">Agregar</button>
      </div>

      {/* La card sigue funcionando de plantilla: sus ítems se copian al día en un click,
          sin pisar lo que ya se hubiera cargado para esa fecha. */}
      {items.length === 0 && c.checklist.length > 0 && (
        <button
          onClick={() => guardar.mutate({ checklist: c.checklist.map((i) => ({ txt: i.txt, done: false, done_at: null })) })}
          className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm mt-1.5">
          Usar los ítems de la tarea como plantilla
        </button>
      )}

      <textarea defaultValue={occ?.obs ?? ""} key={fecha} placeholder="Observaciones del día…"
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (occ?.obs ?? "")) guardar.mutate({ obs: v || null }); }}
        className="w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-sm mt-2 min-h-[3.5rem]" />
    </>
  );
}
