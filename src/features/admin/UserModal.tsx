import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Profile, Role } from "../../lib/types";
import { useCards, useObjectives, useActivity } from "../../hooks/useData";
import { userMetrics30d } from "../../lib/metrics";

export function UserModal({ user: u, meId, onClose }: { user: Profile; meId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cards = [] } = useCards();
  const { data: objectives = [] } = useObjectives();
  const { data: activity = [] } = useActivity();
  const [name, setName] = useState(u.name);
  const [role, setRole] = useState<Role>(u.role);
  const [puesto, setPuesto] = useState(u.puesto ?? "");
  const [ficha, setFicha] = useState(u.ficha ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = userMetrics30d(cards, objectives, activity, u.id, Date.now());

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles")
        .update({ name: name.trim(), role, puesto: puesto.trim(), ficha: ficha.trim() })
        .eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => { setMsg({ ok: true, txt: "✔ Guardado." }); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: Error) => setMsg({ ok: false, txt: "✖ " + e.message }),
  });

  const onSave = () => {
    if (u.id === meId && role !== "jefe") {
      setMsg({ ok: false, txt: "✖ No podés quitarte el rol de jefe a vos mismo (pedíselo al otro jefe)." });
      return;
    }
    save.mutate();
  };

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  const Stat = ({ v, label }: { v: string | number; label: string }) => (
    <div className="bg-surface2 border border-line rounded-xl px-3 py-2.5 text-center">
      <b className="block text-lg">{v}</b><span className="text-xs text-ink2">{label}</span>
    </div>
  );

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40" style={{ backdropFilter: "blur(3px)" }}>
      <div role="dialog" aria-modal className="bg-surface border border-line rounded-[18px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)" }}>
        <h3 className="text-lg font-semibold m-0">{u.name}</h3>
        <div className="text-xs text-ink2 mb-3.5">{u.email || ""} · rol: {u.role}</div>

        <div className="grid gap-2.5 mb-1">
          <label className="text-[13px] text-ink2">Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
              <option value="empleado">empleado</option>
              <option value="encargado">encargado</option>
              <option value="jefe">jefe</option>
            </select>
          </label>
          <label className="text-[13px] text-ink2">Puesto
            <input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Ej: Analista impositivo" className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Ficha de puesto — qué se espera de este perfil
            <textarea value={ficha} onChange={(e) => setFicha(e.target.value)} rows={5}
              placeholder="Responsabilidades, entregables, estándares…" className={inputCls + " resize-y"} />
          </label>
        </div>

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Métricas (últimos 30 días)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat v={m.done30} label="Tareas cerradas" />
          <Stat v={m.effort30} label="Esfuerzo cerrado" />
          <Stat v={m.onTimePct !== null ? m.onTimePct + "%" : "—"} label="Cerradas a tiempo" />
          <Stat v={m.openToday} label="Abiertas hoy" />
          <Stat v={m.objWeight + "%"} label="Peso de objetivos" />
          <Stat v={m.kpiPerf !== null ? m.kpiPerf + "%" : "—"} label="Cumplimiento KPIs" />
          <Stat v={m.activity30} label="Actividad operativa (30 d)" />
        </div>

        {msg && <p className={"text-sm mt-3 " + (msg.ok ? "text-done" : "text-danger")}>{msg.txt}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSave} disabled={save.isPending}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
