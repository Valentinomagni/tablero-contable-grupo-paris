import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, LayoutGrid } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Announcement } from "../../lib/types";
import { useAnnouncements } from "../../hooks/useData";
import { MESES, DIAS_SEMANA, grillaMes, eventosPorDia, conteoPorMes, claveFecha } from "../../lib/calendario";
import { Modal } from "../../components/Modal";
import { cn } from "../../lib/ui";

type Kind = Announcement["kind"];
const KIND: Record<Kind, { label: string; chip: string; dot: string }> = {
  vencimiento: { label: "Vencimiento", chip: "bg-danger-soft text-danger", dot: "bg-danger" },
  aviso: { label: "Aviso / Reunión", chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  proceso: { label: "Proceso", chip: "bg-chip text-ink2", dot: "bg-ink2" },
};
const fechaLarga = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function Calendario({ isJefe, meName }: { isJefe: boolean; meName: string }) {
  const { data: anuncios = [] } = useAnnouncements();
  const qc = useQueryClient();
  const hoy = new Date();
  const hoyISO = claveFecha(hoy);
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [vista, setVista] = useState<"mes" | "anio">("mes");
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [nTitulo, setNTitulo] = useState("");
  const [nKind, setNKind] = useState<Kind>("vencimiento");
  const [nDetalle, setNDetalle] = useState("");

  const porDia = useMemo(() => eventosPorDia(anuncios), [anuncios]);
  const grilla = useMemo(() => grillaMes(year, month, hoyISO), [year, month, hoyISO]);
  const conteoMeses = useMemo(() => conteoPorMes(anuncios, year), [anuncios, year]);

  const irMes = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };
  const abrirDia = (fecha: string) => { setDiaSel(fecha); setNTitulo(""); setNKind("vencimiento"); setNDetalle(""); };

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements")
        .insert({ kind: nKind, title: nTitulo.trim(), detail: nDetalle.trim(), due_date: diaSel, created_by: meName });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Evento agregado al calendario"); setNTitulo(""); setNDetalle(""); },
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

  const eventosDelDia = diaSel ? (porDia[diaSel] ?? []) : [];
  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  const btn = "flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px]";

  return (
    <div className="px-6 py-4 w-full max-w-[1000px]">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => irMes(-1)} className={btn} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
        <button onClick={() => { setYear(hoy.getFullYear()); setMonth(hoy.getMonth() + 1); }} className={btn}>Hoy</button>
        <button onClick={() => irMes(1)} className={btn} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        <h2 className="text-[19px] font-bold tracking-[-0.02em] capitalize ml-1">
          {vista === "mes" ? `${MESES[month - 1]} ${year}` : year}
        </h2>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => setVista("mes")} className={cn(btn, vista === "mes" && "border-accent text-accent bg-accent-soft")}><CalendarDays size={14} /> Mes</button>
          <button onClick={() => setVista("anio")} className={cn(btn, vista === "anio" && "border-accent text-accent bg-accent-soft")}><LayoutGrid size={14} /> Año</button>
        </div>
      </div>

      {isJefe && vista === "mes" && (
        <p className="text-ink2 text-[13px] -mt-2 mb-3">Tocá un día para agregar vencimientos de impuestos, balances o reuniones.</p>
      )}

      {vista === "mes" ? (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
          <div className="grid grid-cols-7 border-b border-line">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] uppercase tracking-wide text-ink2 font-semibold py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grilla.map((c) => {
              const evs = porDia[c.date] ?? [];
              return (
                <button key={c.date} onClick={() => abrirDia(c.date)}
                  className={cn("min-h-[92px] border-b border-r border-line/70 p-1.5 text-left align-top transition hover:bg-surface2/60 flex flex-col gap-1",
                    !c.delMes && "bg-surface2/30 text-ink2")}>
                  <span className={cn("text-[12px] tnum w-6 h-6 grid place-items-center rounded-full self-start",
                    c.esHoy ? "bg-accent text-white font-bold" : c.delMes ? "" : "text-ink2/60")}>{c.dia}</span>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("text-[11px] rounded px-1.5 py-0.5 truncate font-medium", KIND[e.kind].chip)}>{e.title}</span>
                  ))}
                  {evs.length > 3 && <span className="text-[10.5px] text-ink2 px-1">+{evs.length - 3} más</span>}
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
                  {conteoMeses[i] > 0 && <span className="bg-accent-soft text-accent rounded-full text-[11px] px-2 py-0.5 tnum font-semibold">{conteoMeses[i]}</span>}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {g.map((c) => {
                    const evs = porDia[c.date] ?? [];
                    const kind = evs[0]?.kind;
                    return (
                      <span key={c.date} className="grid place-items-center h-4">
                        <span className={cn("text-[9px] tnum leading-none w-4 h-4 grid place-items-center rounded-full relative",
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

          {eventosDelDia.map((e) => (
            <div key={e.id} className="flex items-start gap-2 py-2 border-b border-line/60">
              <span className={cn("text-[10.5px] rounded px-1.5 py-0.5 font-semibold shrink-0 mt-0.5", KIND[e.kind].chip)}>{KIND[e.kind].label}</span>
              <div className="flex-1 min-w-0">
                <b className="text-sm">{e.title}</b>
                {e.detail && <p className="text-ink2 text-[13px] m-0 mt-0.5 whitespace-pre-line">{e.detail}</p>}
                <span className="text-ink2 text-[11px]">— {e.created_by}</span>
              </div>
              {isJefe && (
                <button onClick={() => del.mutate(e.id)} title="Eliminar" className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger shrink-0"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
          {eventosDelDia.length === 0 && <p className="text-ink2 text-sm">Sin eventos este día.</p>}

          {isJefe ? (
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
                <button onClick={() => nTitulo.trim() ? add.mutate() : toast.error("Ponele un título al evento")}
                  disabled={add.isPending}
                  className="flex items-center justify-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
                  <Plus size={14} /> {add.isPending ? "Guardando…" : "Agregar al calendario"}</button>
              </div>
            </div>
          ) : (
            <p className="text-ink2 text-[13px] mt-3">Los eventos los cargan los jefes.</p>
          )}
          <button onClick={() => setDiaSel(null)} className="w-full mt-3 border border-line bg-surface2 rounded-lg py-2 text-[13px]">Cerrar</button>
        </Modal>
      )}
    </div>
  );
}
