import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, CalendarDays, LayoutGrid, Check, Pin, Plane } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Announcement, Profile, Card, TaskOccurrence } from "../../lib/types";
import { useAnnouncements } from "../../hooks/useData";
import { useOccurrences } from "../../hooks/useOccurrences";
import { useVacaciones } from "../../hooks/useVacaciones";
import { ausentesEnFecha } from "../../lib/vacaciones";
import { VacacionesModal } from "./VacacionesModal";
import { MESES, DIAS_SEMANA, grillaMes, eventosPorDia, conteoPorMes, claveFecha } from "../../lib/calendario";
import { CLS_TONO } from "../../lib/vencimientos";
import { Modal } from "../../components/Modal";
import { AnuncioEditForm } from "../../components/AnuncioEditForm";
import { puedeEditarAnuncio } from "../../lib/anuncios";
import { useArca } from "../tablon/arca";
import { aEventosVirtuales, type EventoVirtual } from "../../lib/arca-filtro";
import { cn, Avatar } from "../../lib/ui";

type Kind = Announcement["kind"];
const KIND: Record<Kind, { label: string; chip: string; dot: string }> = {
  // chip de vencimiento: mismo semáforo que el Tablón (lib/vencimientos, Kaizen H4)
  vencimiento: { label: "Vencimiento", chip: CLS_TONO.danger, dot: "bg-danger" },
  aviso: { label: "Aviso / Reunión", chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  proceso: { label: "Proceso", chip: "bg-chip text-ink2", dot: "bg-ink2" },
};
const fechaLarga = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function Calendario({ me, team, cards = [] }: { me: Profile; team: Profile[]; cards?: Card[] }) {
  const isJefe = me.role === "jefe";
  const esGestor = me.role === "jefe" || me.role === "encargado";
  const { data: anuncios = [] } = useAnnouncements();
  const { data: vacaciones = [] } = useVacaciones();
  const [vacModal, setVacModal] = useState(false);
  const qc = useQueryClient();
  const hoy = new Date();
  const hoyISO = claveFecha(hoy);
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [vista, setVista] = useState<"mes" | "anio">("mes");
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [nTitulo, setNTitulo] = useState("");
  const [nKind, setNKind] = useState<Kind>("vencimiento");
  const [nDetalle, setNDetalle] = useState("");
  const [nCompartir, setNCompartir] = useState<string[]>([]);
  const toggleCompartir = (id: string) => setNCompartir((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const porDia = useMemo(() => eventosPorDia(anuncios), [anuncios]);
  const grilla = useMemo(() => grillaMes(year, month, hoyISO), [year, month, hoyISO]);
  const conteoMeses = useMemo(() => conteoPorMes(anuncios, year), [anuncios, year]);

  // Vencimientos ARCA relevantes como eventos VIRTUALES de solo-lectura (no se escriben en DB).
  const arcaItems = useArca();
  const arcaPorDia = useMemo(() => {
    const m: Record<string, EventoVirtual[]> = {};
    for (const e of aEventosVirtuales(arcaItems, year, month)) (m[e.date] ??= []).push(e);
    return m;
  }, [arcaItems, year, month]);

  const { data: ocurrencias = [] } = useOccurrences(year, month);
  const tituloDeCard = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cards) m[c.id] = c.title;
    return m;
  }, [cards]);
  const ocurrenciasPorDia = useMemo(() => {
    const m: Record<string, TaskOccurrence[]> = {};
    for (const o of ocurrencias) (m[o.fecha] ??= []).push(o);
    return m;
  }, [ocurrencias]);

  // Nombre (primer nombre) del dueño de una vacación, para los chips de ausencia.
  const primerNombre = (id: string) => (team.find((u) => u.id === id)?.name ?? "?").split(" ")[0];

  // Fuente única: marcar/desmarcar cumplimiento del día actualiza la MISMA fila (spec #12).
  const toggleOcc = useMutation({
    mutationFn: async (o: TaskOccurrence) => {
      const { error } = await supabase.from("task_occurrences")
        .update({ done: !o.done, done_at: !o.done ? new Date().toISOString() : null }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrences"] }),
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });

  const irMes = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };
  const abrirDia = (fecha: string) => { setDiaSel(fecha); setEditId(null); setNTitulo(""); setNKind("vencimiento"); setNDetalle(""); setNCompartir([]); };

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements")
        .insert({ kind: nKind, title: nTitulo.trim(), detail: nDetalle.trim(), due_date: diaSel, created_by: me.name, owner_id: me.id, visible_to: nCompartir });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Evento agregado al calendario"); setNTitulo(""); setNDetalle(""); setNCompartir([]); },
    onError: (e: Error) => toast.error("No se pudo guardar: " + e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Evento eliminado"); },
    onError: (e: Error) => toast.error("No se pudo eliminar: " + e.message),
  });
  // Fijar un vencimiento ARCA (evento virtual) como announcement permanente en el calendario.
  const fijarArca = useMutation({
    mutationFn: async (e: EventoVirtual) => {
      const { error } = await supabase.from("announcements")
        .insert({ kind: "vencimiento", title: e.title, detail: e.detail, due_date: e.date, created_by: me.name, owner_id: me.id, visible_to: [] });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Vencimiento ARCA fijado en el calendario"); },
    onError: (e: Error) => toast.error("No se pudo fijar: " + e.message),
  });

  const eventosDelDia = diaSel ? (porDia[diaSel] ?? []) : [];
  const arcaDelDia = diaSel ? (arcaPorDia[diaSel] ?? []) : [];
  const ausentesDelDia = diaSel ? ausentesEnFecha(vacaciones, diaSel) : [];
  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";
  const btn = "flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm";

  return (
    <div className="px-6 py-4 w-full max-w-[1000px]">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => irMes(-1)} className={btn} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
        <button onClick={() => { setYear(hoy.getFullYear()); setMonth(hoy.getMonth() + 1); }} className={btn}>Hoy</button>
        <button onClick={() => irMes(1)} className={btn} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        <h2 className="text-xl font-bold tracking-[-0.02em] capitalize ml-1">
          {vista === "mes" ? `${MESES[month - 1]} ${year}` : year}
        </h2>
        <div className="ml-auto flex gap-1.5">
          {esGestor && (
            <button onClick={() => setVacModal(true)} className={btn}><Plane size={14} /> Vacaciones</button>
          )}
          <button onClick={() => setVista("mes")} className={cn(btn, vista === "mes" && "border-accent text-accent bg-accent-soft")}><CalendarDays size={14} /> Mes</button>
          <button onClick={() => setVista("anio")} className={cn(btn, vista === "anio" && "border-accent text-accent bg-accent-soft")}><LayoutGrid size={14} /> Año</button>
        </div>
      </div>

      {vista === "mes" && (
        <p className="text-ink2 text-sm -mt-2 mb-3">Tocá un día para agregar vencimientos de impuestos, balances o reuniones.</p>
      )}

      {vista === "mes" ? (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
          <div className="grid grid-cols-7 border-b border-line">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-2xs uppercase tracking-wide text-ink2 font-semibold py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grilla.map((c) => {
              const evs = porDia[c.date] ?? [];
              const occ = ocurrenciasPorDia[c.date] ?? [];
              const arcaEvs = arcaPorDia[c.date] ?? [];
              const ausentes = ausentesEnFecha(vacaciones, c.date);
              return (
                <button key={c.date} onClick={() => abrirDia(c.date)}
                  className={cn("min-h-[92px] border-b border-r border-line/70 p-1.5 text-left align-top transition hover:bg-surface2/60 flex flex-col gap-1",
                    !c.delMes && "bg-surface2/30 text-ink2")}>
                  <span className={cn("text-xs tnum w-6 h-6 grid place-items-center rounded-full self-start",
                    c.esHoy ? "bg-accent text-white font-bold" : c.delMes ? "" : "text-ink2/60")}>{c.dia}</span>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("text-2xs rounded px-1.5 py-0.5 truncate font-medium", KIND[e.kind].chip)}>{e.title}</span>
                  ))}
                  {evs.length > 3 && <span className="text-2xs text-ink2 px-1">+{evs.length - 3} más</span>}
                  {occ.slice(0, 2).map((o) => (
                    <span key={o.id} className={cn("flex items-center gap-1 text-2xs rounded px-1.5 py-0.5 truncate font-medium border border-line",
                      o.done ? "bg-accent-soft text-done line-through" : "bg-surface2 text-ink2")}>
                      {o.done && <Check size={10} className="shrink-0" />}
                      <span className="truncate">{tituloDeCard[o.card_id] ?? "Tarea"}</span>
                    </span>
                  ))}
                  {occ.length > 2 && <span className="text-2xs text-ink2 px-1">+{occ.length - 2} tarea(s)</span>}
                  {arcaEvs.slice(0, 2).map((e, i) => (
                    <span key={"arca" + i} title={`ARCA · ${e.title}`} className="text-2xs rounded px-1.5 py-0.5 truncate font-medium bg-chip text-ink2">ARCA · {e.title}</span>
                  ))}
                  {arcaEvs.length > 2 && <span className="text-2xs text-ink2 px-1">+{arcaEvs.length - 2} ARCA</span>}
                  {ausentes.map((v) => (
                    <span key={"vac" + v.id} title={`${primerNombre(v.owner)} ausente`} className="text-2xs rounded px-1.5 py-0.5 truncate font-medium bg-chip text-ink2">{primerNombre(v.owner)} ausente</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MESES.map((nombre, i) => {
            const g = grillaMes(year, i + 1, hoyISO);
            return (
              <button key={nombre} onClick={() => { setMonth(i + 1); setVista("mes"); }}
                className="bg-surface border border-line rounded-xl p-3 text-left hover:border-accent/40 transition" style={{ boxShadow: "var(--ring-sh)" }}>
                <div className="flex items-center justify-between mb-2">
                  <b className="capitalize text-sm">{nombre}</b>
                  {conteoMeses[i] > 0 && <span className="bg-accent-soft text-accent rounded-full text-2xs px-2 py-0.5 tnum font-semibold">{conteoMeses[i]}</span>}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {g.map((c) => {
                    const evs = porDia[c.date] ?? [];
                    const kind = evs[0]?.kind;
                    return (
                      <span key={c.date} className="grid place-items-center h-4">
                        <span className={cn("text-2xs tnum leading-none w-4 h-4 grid place-items-center rounded-full relative",
                          c.esHoy ? "bg-accent text-white" : c.delMes ? "text-ink2" : "text-ink2/30")}>
                          {c.dia}
                          {evs.length > 0 && <span className={cn("absolute -bottom-[1px] w-1 h-1 rounded-full", kind ? KIND[kind].dot : "bg-accent")} />}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {diaSel && (
        <Modal onClose={() => setDiaSel(null)} maxWidth={480}>
          <h3 className="text-lg font-semibold m-0 capitalize">{fechaLarga(diaSel)}</h3>
          <div className="text-xs text-ink2 mb-3">{eventosDelDia.length} evento(s)</div>

          {eventosDelDia.map((e) =>
            editId === e.id ? (
              <div key={e.id} className="py-2 border-b border-line/60">
                {/* Al cambiar la fecha, el evento se mueve de día (queda fuera de este modal). */}
                <AnuncioEditForm a={e} onDone={() => setEditId(null)} />
              </div>
            ) : (
              <div key={e.id} className="flex items-start gap-2 py-2 border-b border-line/60">
                <span className={cn("text-2xs rounded px-1.5 py-0.5 font-semibold shrink-0 mt-0.5", KIND[e.kind].chip)}>{KIND[e.kind].label}</span>
                <div className="flex-1 min-w-0">
                  <b className="text-sm">{e.title}</b>
                  {e.detail && <p className="text-ink2 text-sm m-0 mt-0.5 whitespace-pre-line">{e.detail}</p>}
                  <span className="text-ink2 text-2xs">— {e.created_by}</span>
                </div>
                {puedeEditarAnuncio(e, me.id, isJefe) && (
                  <>
                    <button onClick={() => setEditId(e.id)} title="Editar" className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-accent shrink-0"><Pencil size={13} /></button>
                    <button onClick={() => del.mutate(e.id)} title="Eliminar" className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger shrink-0"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            )
          )}
          {eventosDelDia.length === 0 && <p className="text-ink2 text-sm">Sin eventos este día.</p>}

          {(ocurrenciasPorDia[diaSel] ?? []).length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Tareas del día (cumplimiento)</h4>
              {(ocurrenciasPorDia[diaSel] ?? []).map((o) => (
                <label key={o.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={o.done} onChange={() => toggleOcc.mutate(o)} className="accent-accent w-4 h-4 shrink-0" />
                  <span className={o.done ? "line-through text-ink2" : ""}>{tituloDeCard[o.card_id] ?? "Tarea"}</span>
                </label>
              ))}
            </div>
          )}

          {arcaDelDia.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Vencimientos ARCA (oficiales · solo lectura)</h4>
              {arcaDelDia.map((e, i) => (
                <div key={"arca" + i} className="flex items-start gap-2 py-2 border-b border-line/60 last:border-0">
                  <span className="text-2xs rounded px-1.5 py-0.5 font-semibold shrink-0 mt-0.5 bg-chip text-ink2">ARCA</span>
                  <div className="flex-1 min-w-0">
                    <b className="text-sm">{e.title}</b>
                    {e.detail && <p className="text-ink2 text-sm m-0 mt-0.5 whitespace-pre-line">{e.detail}</p>}
                  </div>
                  <button onClick={() => fijarArca.mutate(e)} disabled={fijarArca.isPending} title="Fijar en el calendario"
                    className="flex items-center gap-1 border border-line bg-surface2 rounded-lg px-2 py-1 text-xs text-ink2 hover:text-accent shrink-0 disabled:opacity-60">
                    <Pin size={13} /> Fijar
                  </button>
                </div>
              ))}
              <p className="text-ink2 text-2xs mt-2 mb-0">Fuente: arca.gob.ar · se actualizan solos. "Fijar" los deja permanentes en el calendario del equipo.</p>
            </div>
          )}

          {ausentesDelDia.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Ausencias</h4>
              {ausentesDelDia.map((v) => {
                const ausenteNom = team.find((u) => u.id === v.owner)?.name ?? "?";
                const replNom = v.reemplazante ? team.find((u) => u.id === v.reemplazante)?.name ?? null : null;
                return (
                  <div key={v.id} className="flex items-start gap-2 py-2 border-b border-line/60 last:border-0">
                    <span className="text-2xs rounded px-1.5 py-0.5 font-semibold shrink-0 mt-0.5 bg-chip text-ink2">Ausente</span>
                    <div className="flex-1 min-w-0">
                      <b className="text-sm">{ausenteNom}</b>
                      <p className="text-ink2 text-xs m-0 mt-0.5">
                        {fechaLarga(v.desde)} – {fechaLarga(v.hasta)} · {v.motivo}
                        {replNom && <> · cubre {replNom}</>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-line">
            <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Agregar evento</h4>
            <div className="grid gap-2">
              <input value={nTitulo} onChange={(e) => setNTitulo(e.target.value)} placeholder="Ej: Vence IIBB CM · Balance ejercicio · Reunión de cierre" className={inputCls} />
              <div className="flex gap-2">
                <select value={nKind} onChange={(e) => setNKind(e.target.value as Kind)} className={inputCls + " flex-1"}>
                  <option value="vencimiento">Vencimiento (impuesto / balance)</option>
                  <option value="aviso">Aviso / Reunión</option>
                  <option value="proceso">Proceso</option>
                </select>
              </div>
              <textarea value={nDetalle} onChange={(e) => setNDetalle(e.target.value)} rows={2} placeholder="Detalle opcional (terminación de CUIT, horario, lugar…)" className={inputCls + " resize-y"} />
              {team.filter((u) => u.id !== me.id).length > 0 && (
                <div>
                  <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Compartir con</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto">
                    {team.filter((u) => u.id !== me.id).map((u) => {
                      const on = nCompartir.includes(u.id);
                      return (
                        <button key={u.id} type="button" onClick={() => toggleCompartir(u.id)}
                          className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm border text-left transition", on ? "border-accent bg-accent-soft" : "border-line bg-surface2")}>
                          <Avatar name={u.name} size={20} />
                          <span className="flex-1 truncate">{u.name}</span>
                          {on && <Check size={14} className="text-accent shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button onClick={() => nTitulo.trim() ? add.mutate() : toast.error("Ponele un título al evento")}
                disabled={add.isPending}
                className="flex items-center justify-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
                <Plus size={14} /> {add.isPending ? "Guardando…" : "Agregar al calendario"}</button>
            </div>
          </div>
          <button onClick={() => setDiaSel(null)} className="w-full mt-3 border border-line bg-surface2 rounded-lg py-2 text-sm">Cerrar</button>
        </Modal>
      )}

      {vacModal && esGestor && (
        <VacacionesModal me={me} team={team} cards={cards} onClose={() => setVacModal(false)} />
      )}
    </div>
  );
}

export default Calendario;
