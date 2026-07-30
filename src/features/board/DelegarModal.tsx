import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Check } from "lucide-react";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { filasCompartida } from "../../lib/shared";
import { notifsAlDelegar } from "../../lib/notificaciones";
import { Avatar } from "../../lib/ui";

// Delegar/compartir una tarea entre varias personas: se crea una tarjeta espejo por participante
// (aparece en el board de cada uno y suma en las métricas de todos). Completarla sincroniza a todas.
export function DelegarModal({ team, meId, meName, onClose }: { team: Profile[]; meId: string; meName: string; onClose: () => void }) {
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
      const at = new Date().toISOString();
      // id generado en el cliente: permite vincular la notificación a la card espejo
      // sin necesidad de leerla de vuelta (RLS no siempre deja ver la card de otro).
      const filas = filasCompartida({
        linkId: crypto.randomUUID(), title, owners, delegador: meName,
        due_date: due || null, effort, priority, at, nameOf,
      }).map((f) => ({ ...f, id: crypto.randomUUID() }));
      const { error } = await supabase.from("cards").insert(filas);
      if (error) throw error;
      // Notificación al receptor (spec #8) — best-effort: si la tabla notifications
      // aún no existe (migración 21 sin aplicar), la delegación se hace igual.
      try {
        const notifs = notifsAlDelegar({
          delegadorId: meId, delegadorName: meName, title, at,
          destinos: filas.map((f) => ({ owner: f.owner, cardId: f.id })),
        });
        if (notifs.length) await supabase.from("notifications").insert(notifs);
      } catch { /* secundario: se ignora */ }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Tarea compartida creada"); onClose(); },
    onError: (e) => toast.error("No se pudo crear: " + (e as Error).message),
  });

  // Empleado sin compañeros visibles (RLS de profiles / jerarquía sin cargar): estado
  // explicativo en lugar de la grilla. Quedará plenamente operativo cuando la migración 20
  // + jerarquía permitan ver a los compañeros de equipo.
  const sinDestinatarios = team.filter((u) => u.id !== meId).length === 0;

  const puede = title.trim().length > 0 && owners.length >= 1;
  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 className="flex items-center gap-2 text-lg font-semibold m-0 mb-1"><Users size={18} /> Delegar / compartir tarea</h3>
      <p className="text-ink2 text-sm mt-0 mb-4">
        Se crea la misma tarea en el tablero de cada participante. Cuando alguien la termina, se marca
        para todos, y suma en las métricas de cada uno (autocontrol + control cruzado).
      </p>

      <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Tarea</label>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Analizar cuenta 4110 para dar una mano"
        className={inputCls + " w-full mb-4"} />

      <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Participantes</label>
      {sinDestinatarios && (
        <div className="border border-dashed border-line rounded-lg px-3 py-4 mb-4 text-sm text-ink2">
          Todavía no ves compañeros para delegar. Pedile a tu encargado que te asigne compañeros
          de equipo y vas a poder compartir tareas con ellos desde acá.
        </div>
      )}
      {!sinDestinatarios && <div className="grid grid-cols-2 gap-1.5 mb-4 max-h-[190px] overflow-y-auto">
        {team.map((u) => {
          const on = owners.includes(u.id);
          return (
            <button key={u.id} onClick={() => toggle(u.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm border text-left transition ${on ? "border-accent bg-accent-soft" : "border-line bg-surface2"}`}>
              <Avatar name={u.name} size={20} />
              <span className="flex-1 truncate">{u.name}</span>
              {on && <Check size={14} className="text-accent shrink-0" />}
            </button>
          );
        })}
      </div>}

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
        <button onClick={onClose} className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">Cancelar</button>
        <button onClick={() => crear.mutate()} disabled={!puede || crear.isPending}
          className="inline-flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-sm disabled:opacity-50">
          <Users size={14} /> {crear.isPending ? "Creando…" : `Compartir con ${owners.length || ""}`}</button>
      </div>
    </Modal>
  );
}
