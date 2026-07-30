import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Profile, AppSettings } from "../../lib/types";
import { validarPlantilla, type TemplateItem } from "../../lib/plantilla";
import { useSettings } from "../../hooks/useData";

export function PlantillaCierre({ team }: { team: Profile[] }) {
  const qc = useQueryClient();
  const { data: settings = { edit_closed: false } as AppSettings } = useSettings();
  const [draft, setDraft] = useState<TemplateItem[] | null>(null);
  const items = draft ?? settings.closing_template ?? [];

  const upd = (i: number, patch: Partial<TemplateItem>) =>
    setDraft(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function guardar() {
    const err = validarPlantilla(items);
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("settings").update({ value: { ...settings, closing_template: items } }).eq("key", "permissions");
    if (error) toast.error("No se pudo guardar: " + error.message);
    else { toast.success("Plantilla guardada"); qc.invalidateQueries({ queryKey: ["settings"] }); setDraft(null); }
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2 py-1.5 text-ink text-sm";
  return (
    <>
      <h2 className="text-base font-bold tracking-[-0.01em] text-ink mb-1">Plantilla de cierre mensual</h2>
      <p className="text-ink2 text-sm mt-0 mb-2.5 max-w-[640px]">
        Seiketsu (estandarizar): el proceso de cierre por escrito, una sola vez. Cada mes, un click genera todas las tareas
        con responsable, vencimiento y esfuerzo. Si se aprieta dos veces no duplica.
      </p>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        {items.length === 0 && <p className="text-ink2 text-sm mt-0">Sin ítems todavía. Agregá las tareas que se repiten cada cierre (IVA, sueldos, F931, conciliaciones…).</p>}
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-line/60 last:border-0">
            <input value={it.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Tarea (ej: DDJJ IVA)" className={inputCls + " flex-1 min-w-[180px]"} />
            <select value={it.owner} onChange={(e) => upd(i, { owner: e.target.value })} className={inputCls}>
              <option value="">Responsable…</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <label className="text-xs text-ink2 flex items-center gap-1">Vence el día
              <input type="number" min={1} max={31} value={it.due_day ?? ""} placeholder="—"
                onChange={(e) => upd(i, { due_day: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls + " w-[64px]"} />
            </label>
            <select value={String(it.effort)} onChange={(e) => upd(i, { effort: Number(e.target.value) as TemplateItem["effort"] })} className={inputCls}>
              <option value="1">1 pt</option><option value="2">2 pts</option><option value="3">3 pts</option><option value="5">5 pts</option>
            </select>
            <select value={it.priority} onChange={(e) => upd(i, { priority: e.target.value as TemplateItem["priority"] })} className={inputCls}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
            <button title="Quitar" onClick={() => setDraft(items.filter((_, idx) => idx !== i))}
              className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger"><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setDraft([...items, { title: "", owner: "", due_day: null, effort: 1, priority: "media" }])}
            className="flex items-center gap-1.5 border border-dashed border-line rounded-lg px-3 py-1.5 text-sm text-ink2 hover:text-accent hover:border-accent">
            <Plus size={14} /> Agregar ítem</button>
          {draft && <button onClick={guardar} className="bg-accent text-white rounded-lg px-3.5 py-1.5 text-sm font-semibold">Guardar plantilla</button>}
          {items.length > 0 && (
            <span className="ml-auto self-center text-xs text-ink2">
              Las tareas del mes se generan desde <span className="text-accent font-semibold">Cierre mensual</span>.
            </span>
          )}
        </div>
      </div>
    </>
  );
}
