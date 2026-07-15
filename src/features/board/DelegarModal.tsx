import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Check } from "lucide-react";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { filasCompartida } from "../../lib/shared";
import { Avatar } from "../../lib/ui";

// Delegar/compartir una tarea entre varias personas: se crea una tarjeta espejo por participante
// (aparece en el board de cada uno y suma en las métricas de todos). Completarla sincroniza a todas.
export function DelegarModal({ team, meName, onClose }: { team: Profile[]; meName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [effort, setEffort] = useState<1 | 2 | 3 | 5>(2);
  const [priority, setPriority] = useState<"alta" | "media" | "baja">("media");

  const toggle = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const nameOf = (id: string) => team.find((u) => u.id === id)?.name ?? "?";

  const crear = useMutation({
    mutationFn: async () => {
      const filas = filasCompartida({
        linkId: crypto.randomUUID(), title, owners, delegador: meName,
        due_date: due || null, effort, priority, at: new Date().toISOString(), nameOf,
      });
      const { error } = await supabase.from("cards").insert(filas);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Tarea compartida creada"); onClose(); },
    onError: (e) => toast.error("No se pudo crear: " + (e as Error).message),
  });

  const puede = title.trim().length > 0 && owners.length >= 1;
  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 className="flex items-center gap-2 text-lg font-semibold m-0 mb-1"><Users size={18} /> Delegar / compartir tarea</h3>
      <p className="text-ink2 text-[13px] mt-0 mb-4">
        Se crea la misma tarea en el tablero de cada participante. Cuando alguien la termina, se marca
        para todos, y suma en las métricas de cada uno (autocontrol + control cruzado).
      </p>

      <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Tarea</label>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Analizar cuenta 4110 para dar una mano"
        className={inputCls + " w-full mb-4"} />

      <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Participantes</label>
      <div className="grid grid-cols-2 gap-1.5 mb-4 max-h-[190px] overflow-y-auto">
        {team.map((u) => {
          const on = owners.includes(u.id);
          return (
            <button key={u.id} onClick={() => toggle(u.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] border text-left transition ${on ? "border-accent bg-accent-soft" : "border-line bg-surface2"}`}>
              <Avatar name={u.name} size={20} />
              <span className="flex-1 truncate">{u.name}</span>
              {on && <Check size={14} className="text-accent shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-5 text-sm text-ink2">
        <label className="flex items-center gap-1.5">Vence
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></label>
        <label className="flex items-center gap-1.5">Esfuerzo
          <select value={String(effort)} onChange={(e) => setEffort(Number(e.target.value) as 1 | 2 | 3 | 5)} className={inputCls}>
            <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option>
          </select></label>
        <label className="flex items-center gap-1.5">Prioridad
          <select value={priority} onChange={(e) => setPriority(e.target.value as "alta" | "media" | "baja")} className={inputCls}>
            <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
          </select></label>
      </div>

      <div className="flex gap-2 justify-end pt-3 border-t border-line">
        <button onClick={onClose} className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cancelar</button>
        <button onClick={() => crear.mutate()} disabled={!puede || crear.isPending}
          className="inline-flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-50">
          <Users size={14} /> {crear.isPending ? "Creando…" : `Compartir con ${owners.length || ""}`}</button>
      </div>
    </Modal>
  );
}
