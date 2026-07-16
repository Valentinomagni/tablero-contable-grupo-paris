import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../hooks/useData";
import type { Card } from "../../lib/types";

// Flujo formal de alta (spec 21, item 2): las tareas nacen en Pendiente con sus
// datos completos. Nunca ofrece "Marcar terminada" — eso es del ciclo de vida, no del alta.
export function NuevaTareaModal({ ownerId, meName, onClose }: { ownerId: string; meName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const categorias = settings?.categorias ?? [];
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Card["priority"]>("media");
  const [effort, setEffort] = useState<Card["effort"]>(1);
  const [categoria, setCategoria] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      const row = {
        owner: ownerId, title: title.trim(), status: "pend" as const,
        due_date: dueDate || null, priority, effort,
        categoria: categoria || null,
        history: [{ who: meName, at: new Date().toISOString(), txt: "Creó la tarea" }],
      };
      const { error } = await supabase.from("cards").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Tarea creada");
      onClose();
    },
    onError: (e: Error) => toast.error("No se pudo crear la tarea: " + e.message),
  });

  const puedeCrear = title.trim().length > 0 && !crear.isPending;

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <h3 className="text-lg font-semibold m-0 mb-3.5">Nueva tarea</h3>
      <form onSubmit={(e) => { e.preventDefault(); if (puedeCrear) crear.mutate(); }}>
        <label className="block text-sm text-ink2 mb-3">Título
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Conciliación bancaria de julio…"
            className="mt-1 w-full bg-surface2 border border-line rounded-lg px-2.5 py-2 text-ink text-[13px] outline-none focus:border-accent" />
        </label>
        <div className="flex gap-4 flex-wrap items-center text-sm text-ink2 mb-3">
          <label className="flex items-center gap-1.5">Vencimiento
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]" />
          </label>
          <label className="flex items-center gap-1.5">Prioridad
            <select value={priority} onChange={(e) => setPriority(e.target.value as Card["priority"])}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Esfuerzo
            <select value={String(effort)} onChange={(e) => setEffort(Number(e.target.value) as Card["effort"])}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
              <option value="1">1 — Baja</option><option value="2">2 — Media</option><option value="3">3 — Alta</option><option value="5">5 — Muy alta</option>
            </select>
          </label>
          {categorias.length > 0 && (
            <label className="flex items-center gap-1.5">Categoría
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-[13px]">
                <option value="">—</option>
                {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="flex gap-2 items-center pt-2">
          <button type="submit" disabled={!puedeCrear}
            className="bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-60">
            {crear.isPending ? "Creando…" : "Crear tarea"}</button>
          <button type="button" onClick={onClose}
            className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
