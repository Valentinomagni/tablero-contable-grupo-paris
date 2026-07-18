import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plane, Plus, Trash2, ArrowRight } from "lucide-react";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import type { Card, Profile } from "../../lib/types";
import { useVacaciones } from "../../hooks/useVacaciones";
import { rangoValido, vacacionesActivasYFuturas } from "../../lib/vacaciones";
import { claveFecha } from "../../lib/calendario";
import { Avatar } from "../../lib/ui";

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });

// Registro de vacaciones y cobertura de tareas (spec 24 item 5). Solo gestores (jefe / encargado).
export function VacacionesModal({ me, team, cards, onClose }: {
  me: Profile; team: Profile[]; cards: Card[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: vacs = [] } = useVacaciones();
  const hoyISO = claveFecha(new Date());

  const [owner, setOwner] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("Vacaciones");
  const [reemplazante, setReemplazante] = useState("");
  const [notas, setNotas] = useState("");

  const nombreDe = (id: string | null) => team.find((u) => u.id === id)?.name ?? "—";
  const activas = useMemo(() => vacacionesActivasYFuturas(vacs, hoyISO), [vacs, hoyISO]);

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vacaciones").insert({
        owner, desde, hasta, motivo: motivo.trim() || "Vacaciones",
        reemplazante: reemplazante || null, notas: notas.trim(), created_by: me.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacaciones"] });
      toast.success("Vacaciones registradas");
      setOwner(""); setDesde(""); setHasta(""); setMotivo("Vacaciones"); setReemplazante(""); setNotas("");
    },
    onError: (e) => toast.error("No se pudo guardar: " + (e as Error).message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vacaciones"] }); toast.success("Vacación eliminada"); },
    onError: (e) => toast.error("No se pudo eliminar: " + (e as Error).message),
  });

  // Cobertura: pasa una tarea abierta del ausente a su reemplazante, dejando historial.
  const cubrir = useMutation({
    mutationFn: async ({ card, aRepl, ausenteNom, replNom, desdeV, hastaV }:
      { card: Card; aRepl: string; ausenteNom: string; replNom: string; desdeV: string; hastaV: string }) => {
      const hist = [...(card.history ?? []), {
        who: me.name, at: new Date().toISOString(),
        txt: `Cobertura por vacaciones: de ${ausenteNom} a ${replNom} (${desdeV}–${hastaV})`,
      }];
      const { error } = await supabase.from("cards").update({ owner: aRepl, history: hist }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Tarea reasignada al reemplazante"); },
    onError: (e) => toast.error("No se pudo reasignar: " + (e as Error).message),
  });

  const puede = !!owner && rangoValido(desde, hasta);
  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h3 className="flex items-center gap-2 text-lg font-semibold m-0 mb-1"><Plane size={18} /> Vacaciones y cobertura</h3>
      <p className="text-ink2 text-[13px] mt-0 mb-4">
        Registrá ausencias del equipo y pasá las tareas abiertas del ausente a quien lo cubre.
      </p>

      <div className="grid gap-2 mb-5 border border-line rounded-xl p-3 bg-surface2/40">
        <label className="text-xs uppercase tracking-wide text-ink2">Persona</label>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls}>
          <option value="">Elegí…</option>
          {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5 text-sm text-ink2">Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} /></label>
          <label className="flex items-center gap-1.5 text-sm text-ink2">Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} /></label>
        </div>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" className={inputCls} />
        <label className="text-xs uppercase tracking-wide text-ink2">Reemplazante (opcional)</label>
        <select value={reemplazante} onChange={(e) => setReemplazante(e.target.value)} className={inputCls}>
          <option value="">Sin reemplazante</option>
          {team.filter((u) => u.id !== owner).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas (opcional)" className={inputCls + " resize-y"} />
        <button onClick={() => puede ? crear.mutate() : toast.error("Elegí persona y un rango de fechas válido")}
          disabled={crear.isPending}
          className="flex items-center justify-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
          <Plus size={14} /> {crear.isPending ? "Guardando…" : "Registrar vacaciones"}</button>
      </div>

      <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Ausencias activas y próximas</h4>
      {activas.length === 0 && <p className="text-ink2 text-sm">No hay vacaciones registradas.</p>}
      <div className="flex flex-col gap-2">
        {activas.map((v) => {
          const abiertas = cards.filter((c) => c.owner === v.owner && c.status !== "term");
          const ausenteNom = nombreDe(v.owner);
          const replNom = v.reemplazante ? nombreDe(v.reemplazante) : null;
          return (
            <div key={v.id} className="border border-line rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Avatar name={ausenteNom} size={22} />
                <div className="flex-1 min-w-0">
                  <b className="text-sm">{ausenteNom}</b>
                  <div className="text-ink2 text-[12px]">
                    {fmt(v.desde)} – {fmt(v.hasta)} · {v.motivo}
                    {replNom && <> · cubre <b className="text-ink">{replNom}</b></>}
                  </div>
                  {v.notas && <p className="text-ink2 text-[12px] m-0 mt-1 whitespace-pre-line">{v.notas}</p>}
                </div>
                <button onClick={() => eliminar.mutate(v.id)} title="Eliminar" disabled={eliminar.isPending}
                  className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger shrink-0"><Trash2 size={13} /></button>
              </div>

              {abiertas.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-line/60">
                  <div className="text-[11px] uppercase tracking-wide text-ink2 mb-1.5">Tareas abiertas de {ausenteNom}</div>
                  <div className="flex flex-col gap-1">
                    {abiertas.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-[13px]">
                        <span className="flex-1 truncate">{c.title}</span>
                        {v.reemplazante && replNom && (
                          <button onClick={() => cubrir.mutate({ card: c, aRepl: v.reemplazante!, ausenteNom, replNom, desdeV: fmt(v.desde), hastaV: fmt(v.hasta) })}
                            disabled={cubrir.isPending}
                            className="flex items-center gap-1 border border-line bg-surface2 rounded-lg px-2 py-1 text-[12px] text-ink2 hover:text-accent shrink-0 disabled:opacity-60">
                            <ArrowRight size={12} /> Pasar a {replNom}</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!v.reemplazante && <p className="text-ink2 text-[11px] mt-1.5 mb-0">Asigná un reemplazante para poder pasarle estas tareas.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={onClose} className="w-full mt-4 border border-line bg-surface2 rounded-lg py-2 text-[13px]">Cerrar</button>
    </Modal>
  );
}
