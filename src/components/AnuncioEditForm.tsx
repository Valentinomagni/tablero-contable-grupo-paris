import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import type { Announcement } from "../lib/types";

// Edición inline de un aviso/evento publicado (spec 21, item 1).
// Compartido por Calendario (modal de día) y Tablón. Defensivo: si la policy de
// UPDATE de la migración 22 no está aplicada, el error llega por toast sin romper nada.
export function AnuncioEditForm({ a, onDone }: { a: Announcement; onDone: () => void }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(a.title);
  const [kind, setKind] = useState<Announcement["kind"]>(a.kind);
  const [detalle, setDetalle] = useState(a.detail ?? "");
  const [fecha, setFecha] = useState(a.due_date ?? "");
  const [prioridad, setPrioridad] = useState<NonNullable<Announcement["prioridad"]>>(a.prioridad ?? "normal");
  const [vigencia, setVigencia] = useState(a.vigente_hasta ?? "");

  const guardar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements")
        .update({ title: titulo.trim(), kind, detail: detalle.trim(), due_date: fecha || a.due_date, prioridad, vigente_hasta: vigencia || null })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Evento actualizado");
      onDone();
    },
    onError: (e: Error) => toast.error("No se pudo guardar: " + e.message),
  });

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";
  return (
    <div className="grid gap-2 flex-1 min-w-0 py-1">
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className={inputCls} />
      <div className="flex gap-2 flex-wrap">
        <select value={kind} onChange={(e) => setKind(e.target.value as Announcement["kind"])} className={inputCls + " flex-1 min-w-[160px]"}>
          <option value="vencimiento">Vencimiento (impuesto / balance)</option>
          <option value="aviso">Aviso / Reunión</option>
          <option value="proceso">Proceso</option>
        </select>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls + " w-auto"} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as NonNullable<Announcement["prioridad"]>)} className={inputCls + " flex-1 min-w-[160px]"}>
          <option value="normal">Prioridad normal</option>
          <option value="importante">Importante</option>
          <option value="urgente">Urgente</option>
        </select>
        <label className="flex items-center gap-1.5 text-ink2 text-xs">Vigente hasta
          <input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={inputCls + " w-auto"} /></label>
      </div>
      <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2}
        placeholder="Detalle opcional" className={inputCls + " resize-y"} />
      <div className="flex gap-2">
        <button onClick={() => titulo.trim() ? guardar.mutate() : toast.error("Ponele un título al evento")}
          disabled={guardar.isPending}
          className="bg-accent text-white rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-60">
          {guardar.isPending ? "Guardando…" : "Guardar cambios"}</button>
        <button onClick={onDone} className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm">Cancelar</button>
      </div>
    </div>
  );
}
