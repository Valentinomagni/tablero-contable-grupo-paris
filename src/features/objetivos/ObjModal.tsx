import { useState } from "react";
import { Modal } from "../../components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Objective } from "../../lib/types";

export function ObjModal({ obj, ownerId, ownerName, otherWeight, onClose }:
  { obj: Objective | null; ownerId: string; ownerName: string; otherWeight: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(obj?.title ?? "");
  const [description, setDescription] = useState(obj?.description ?? "");
  const [weight, setWeight] = useState(obj?.weight ?? Math.max(0, 100 - otherWeight));
  const [kpiName, setKpiName] = useState(obj?.kpi_name ?? "");
  const [kpiUnit, setKpiUnit] = useState(obj?.kpi_unit ?? "");
  const [kpiTarget, setKpiTarget] = useState(obj?.kpi_target?.toString() ?? "");
  const [kpiCurrent, setKpiCurrent] = useState(obj?.kpi_current?.toString() ?? "0");
  const [notes, setNotes] = useState(obj?.notes ?? "");
  const [msg, setMsg] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        owner: ownerId, title: title.trim(), weight: Math.round(Number(weight) || 0),
        description: description.trim(), kpi_name: kpiName.trim(), kpi_unit: kpiUnit.trim(),
        kpi_target: kpiTarget === "" ? null : Number(kpiTarget), kpi_current: Number(kpiCurrent) || 0,
        notes: notes.trim(),
      };
      const { error } = obj
        ? await supabase.from("objectives").update(row).eq("id", obj.id)
        : await supabase.from("objectives").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objectives"] }); onClose(); },
    onError: (e: Error) => setMsg("No se pudo guardar: " + e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("objectives").delete().eq("id", obj!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objectives"] }); onClose(); },
    onError: (e: Error) => setMsg("No se pudo eliminar: " + e.message),
  });

  const onSave = () => {
    setMsg("");
    const w = Math.round(Number(weight) || 0);
    if (!title.trim()) { setMsg("El objetivo necesita un nombre."); return; }
    if (otherWeight + w > 100) { setMsg(`No se puede guardar: con ${w}% el total sería ${otherWeight + w}% (máximo 100%).`); return; }
    save.mutate();
  };

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  return (
    <Modal onClose={onClose}>
        <h3 className="text-lg font-semibold m-0">{obj ? "Editar objetivo" : "Nuevo objetivo"}</h3>
        <div className="text-xs text-ink2 mb-3.5">De: {ownerName} · Los demás objetivos suman {otherWeight}%</div>
        <div className="grid gap-2.5">
          <label className="text-[13px] text-ink2">Nombre del objetivo
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Cerrar conciliaciones bancarias en fecha" className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Descripción
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Qué se espera y cómo se mide" className={inputCls + " resize-y"} />
          </label>
          <label className="text-[13px] text-ink2">Peso (%) — todos los objetivos deben sumar 100
            <input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">KPI (indicador)
            <input value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="Ej: Conciliaciones en fecha" className={inputCls} />
          </label>
          <div className="flex gap-2">
            <label className="text-[13px] text-ink2">Unidad
              <input value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)} placeholder="%, u., días" className={inputCls + " w-[90px]"} />
            </label>
            <label className="text-[13px] text-ink2">Meta
              <input type="number" value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)} className={inputCls + " w-[110px]"} />
            </label>
            <label className="text-[13px] text-ink2">Valor actual
              <input type="number" value={kpiCurrent} onChange={(e) => setKpiCurrent(e.target.value)} className={inputCls + " w-[110px]"} />
            </label>
          </div>
          <label className="text-[13px] text-ink2">Observaciones
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls + " resize-y"} />
          </label>
        </div>
        {msg && <p className="text-danger text-sm mt-3">{msg}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSave} disabled={save.isPending}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">Guardar</button>
          {obj && <button onClick={() => { if (confirm("¿Eliminar este objetivo?")) del.mutate(); }}
            className="border border-danger text-danger rounded-lg px-3.5 py-2 text-[13px]">Eliminar</button>}
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
    </Modal>
  );
}
