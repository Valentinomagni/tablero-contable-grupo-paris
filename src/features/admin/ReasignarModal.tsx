import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Check } from "lucide-react";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import type { Card, Profile } from "../../lib/types";
import { puedeReasignar } from "../../lib/jerarquia";
import { personasVisibles } from "../../lib/visibilidad";
import { Avatar } from "../../lib/ui";
import { mensajeUsuario } from "../../lib/fallas";

// Reasignar tareas abiertas de un miembro del equipo a otro (uso del Encargado, spec #9).
// El alcance se valida con puedeReasignar (mismo helper testeado); RLS del Plan 02 lo respalda en el servidor.
// `equipo` llega SIN filtrar (incluye al oculto) para que sus tareas puedan elegirse como ORIGEN
// y reasignarse en masa; el select de DESTINO sí excluye al oculto (no se le puede asignar trabajo nuevo).
export function ReasignarModal({ me, equipo, profiles, cards, onClose }: {
  me: Profile; equipo: Profile[]; profiles: Profile[]; cards: Card[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const equipoDestino = personasVisibles(equipo);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  const abiertas = cards.filter((c) => c.owner === origen && c.status !== "term" && c.card_type !== "operativa");
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const puede = !!origen && !!destino && sel.length > 0 && puedeReasignar(me, origen, destino, profiles);
  const nom = (id: string) => equipo.find((u) => u.id === id)?.name ?? "?";

  const reasignar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cards").update({ owner: destino }).in("id", sel);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success(`${sel.length} tarea(s) reasignada(s) a ${nom(destino)}`);
      onClose();
    },
    onError: (e) => toast.error(mensajeUsuario(e, "reasignar las tareas")),
  });

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 className="flex items-center gap-2 text-lg font-semibold m-0 mb-1"><ArrowRightLeft size={18} /> Reasignar tareas</h3>
      <p className="text-ink2 text-sm mt-0 mb-4">Pasá tareas abiertas de un miembro de tu equipo a otro. Solo dentro de tu equipo.</p>

      <div className="flex flex-wrap gap-3 mb-4 text-sm text-ink2">
        <label className="flex items-center gap-1.5">De
          <select value={origen} onChange={(e) => { setOrigen(e.target.value); setSel([]); }} className={inputCls}>
            <option value="">Elegí…</option>
            {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
        <label className="flex items-center gap-1.5">Hacia
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
            <option value="">Elegí…</option>
            {equipoDestino.filter((u) => u.id !== origen).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
      </div>

      {origen && (
        <>
          <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Tareas abiertas de {nom(origen)}</label>
          <div className="flex flex-col gap-1.5 mb-4 max-h-[240px] overflow-y-auto">
            {abiertas.length === 0 ? <p className="text-ink2 text-sm m-0">Sin tareas abiertas.</p>
              : abiertas.map((c) => {
                const on = sel.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm border text-left transition ${on ? "border-accent bg-accent-soft" : "border-line bg-surface2"}`}>
                    <Avatar name={nom(origen)} size={20} />
                    <span className="flex-1 truncate">{c.title}</span>
                    {on && <Check size={14} className="text-accent shrink-0" />}
                  </button>
                );
              })}
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-3 border-t border-line">
        <button onClick={onClose} className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">Cancelar</button>
        <button onClick={() => reasignar.mutate()} disabled={!puede || reasignar.isPending}
          className="inline-flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-sm disabled:opacity-50">
          <ArrowRightLeft size={14} /> {reasignar.isPending ? "Reasignando…" : `Reasignar ${sel.length || ""}`}</button>
      </div>
    </Modal>
  );
}
