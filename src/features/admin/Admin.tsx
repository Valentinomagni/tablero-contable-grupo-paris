import { useState } from "react";
import { Download, UserPlus, ArrowRightLeft, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL } from "../../lib/supabase";
import type { Card, Profile, Role, AppSettings } from "../../lib/types";
import { PlantillaCierre } from "./PlantillaCierre";
import { ReasignarModal } from "./ReasignarModal";
import { Huerfanas } from "./Huerfanas";
import { equipoDe } from "../../lib/jerarquia";
import { Avatar } from "../../lib/ui";
import { useSettings } from "../../hooks/useData";

export function Admin({ team, cards, me, meName, onOpenUser }: { team: Profile[]; cards: Card[]; me: Profile; meName: string; onOpenUser: (u: Profile) => void }) {
  const qc = useQueryClient();
  const esEncargado = me.role === "encargado";
  // Encargado: solo su equipo (subordinados) + reasignar. Sin permisos/parámetros/respaldo/crear-usuario.
  const equipo = esEncargado ? equipoDe(me.id, team) : team;
  const [reasignar, setReasignar] = useState(false);
  const { data: settings = { edit_closed: false } } = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [permMsg, setPermMsg] = useState("");
  const [parBoardName, setParBoardName] = useState<string | null>(null);
  const [parWarn, setParWarn] = useState<string | null>(null);
  const [parStuck, setParStuck] = useState<string | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [nu, setNu] = useState({ email: "", username: "", name: "", role: "empleado" as Role, puesto: "", pass: "" });
  const [nuBusy, setNuBusy] = useState(false);
  const [nuMsg, setNuMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  async function saveSettings(next: AppSettings, okTxt: string) {
    const { error } = await supabase.from("settings").update({ value: next }).eq("key", "permissions");
    setPermMsg(error ? "No se pudo guardar: " + error.message : okTxt);
    if (!error) qc.invalidateQueries({ queryKey: ["settings"] });
    setTimeout(() => setPermMsg(""), 3000);
  }

  async function crearUsuario() {
    if (!nu.name.trim()) { setNuMsg({ ok: false, txt: "El nombre es obligatorio" }); return; }
    setNuMsg(null); setNuBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    let out: { ok?: boolean; error?: string };
    try {
      const r = await fetch(SUPABASE_URL + "/functions/v1/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token },
        body: JSON.stringify({ email: nu.email.trim(), username: nu.username.trim(), password: nu.pass, name: nu.name.trim(), role: nu.role, puesto: nu.puesto.trim() }),
      });
      out = await r.json();
    } catch {
      out = { error: "No se pudo contactar la función crear-usuario. ¿Está desplegada en Supabase?" };
    }
    setNuBusy(false);
    setNuMsg(out.ok ? { ok: true, txt: "Usuario creado. Ya puede ingresar." } : { ok: false, txt: "" + (out.error ?? "Error") });
    if (out.ok) { qc.invalidateQueries({ queryKey: ["team"] }); setNu({ email: "", username: "", name: "", role: "empleado", puesto: "", pass: "" }); }
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";

  async function backup() {
    setBusy(true);
    const tablas = ["profiles", "cards", "objectives", "announcements", "activity_log", "daily_snapshots", "settings"];
    const dump: Record<string, unknown> = { generado: new Date().toISOString(), por: meName, tablas: {} as Record<string, unknown> };
    for (const t of tablas) {
      const { data, error } = await supabase.from(t).select("*");
      (dump.tablas as Record<string, unknown>)[t] = error ? { error: error.message } : data;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 1)], { type: "application/json" }));
    a.download = `backup-tablero-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    setBusy(false); setMsg("Backup descargado. Guardalo en el Drive.");
  }

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      <div className="flex items-center gap-3 mb-2.5">
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink m-0">
          {esEncargado ? "Mi equipo — clic en una persona para ver su ficha" : "Equipo — clic en una persona para editar su ficha"}
        </h2>
        {esEncargado && equipo.length > 0 && (
          <button onClick={() => setReasignar(true)}
            className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-[13px] font-semibold ml-auto">
            <ArrowRightLeft size={14} /> Reasignar tareas</button>
        )}
      </div>
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-ink2">
            <th className="text-left px-4 py-2.5">Persona</th><th className="text-left px-4 py-2.5">Rol</th><th className="text-left px-4 py-2.5">Puesto</th>
          </tr></thead>
          <tbody>
            {equipo.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-4 text-ink2 text-[13px]">Todavía no tenés personas asignadas a tu equipo.</td></tr>
            )}
            {equipo.map((u) => (
              <tr key={u.id} onClick={() => onOpenUser(u)} className="border-t border-line cursor-pointer hover:bg-surface2">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={u.name} size={24} /><div><b>{u.name}</b><br /><span className="text-ink2 text-xs">{u.username ? "@" + u.username : "sin usuario"}</span></div></div></td>
                <td className="px-4 py-2.5 capitalize">{u.role}</td>
                <td className="px-4 py-2.5 text-ink2">{u.puesto || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!esEncargado && <>
      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Crear usuario nuevo</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <input placeholder="usuario (ej: Vmagni)" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} className={inputCls + " w-[160px]"} />
        <input type="email" placeholder="correo corporativo (acceso/recuperación)" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className={inputCls + " w-[200px]"} />
        <input placeholder="nombre y apellido" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className={inputCls + " w-[180px]"} />
        <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })} className={inputCls}>
          <option value="empleado">empleado</option><option value="encargado">encargado</option><option value="jefe">jefe</option>
        </select>
        <input placeholder="puesto (ej: Analista contable)" value={nu.puesto} onChange={(e) => setNu({ ...nu, puesto: e.target.value })} className={inputCls + " w-[200px]"} />
        <input placeholder="contraseña inicial (mín. 8)" value={nu.pass} onChange={(e) => setNu({ ...nu, pass: e.target.value })} className={inputCls + " w-[180px]"} />
        <button onClick={crearUsuario} disabled={nuBusy || !nu.email.trim() || !nu.name.trim() || nu.pass.length < 8}
          className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
          <UserPlus size={15} /> {nuBusy ? "Creando…" : "Crear usuario"}</button>
        {nuMsg && <p className={"w-full text-sm m-0 " + (nuMsg.ok ? "text-done" : "text-danger")}>{nuMsg.txt}</p>}
      </div>

      <Huerfanas team={team} cards={cards} />

      <PlantillaCierre team={team} cards={cards} meName={meName} />

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Permisos</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={settings.edit_closed} className="accent-accent w-4 h-4"
            onChange={(e) => saveSettings({ ...settings, edit_closed: e.target.checked }, "Permiso actualizado")} />
          Permitir que encargados y empleados modifiquen o reabran tareas ya terminadas
        </label>
        <p className="text-ink2 text-[13px] mt-1.5 mb-0">Apagado: solo los jefes pueden tocar una tarea cerrada. La restricción se aplica en el servidor.</p>
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Categorías de tareas</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(settings.categorias ?? []).map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5 bg-chip rounded-full px-3 py-1 text-[13px]">
              {cat}
              <button title={`Quitar "${cat}"`}
                onClick={() => saveSettings({ ...settings, categorias: (settings.categorias ?? []).filter((c) => c !== cat) }, "Categorías guardadas")}
                className="text-ink2 hover:text-danger"><X size={12} /></button>
            </span>
          ))}
          {(settings.categorias ?? []).length === 0 && <p className="text-ink2 text-[13px] m-0">Sin categorías todavía. Agregá las que use el estudio.</p>}
        </div>
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const cat = nuevaCat.trim();
          if (!cat) return;
          const actuales = settings.categorias ?? [];
          if (!actuales.some((c) => c.toLowerCase() === cat.toLowerCase()))
            saveSettings({ ...settings, categorias: [...actuales, cat] }, "Categorías guardadas");
          setNuevaCat("");
        }}>
          <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
            placeholder="Ej: Facturación, Conciliaciones, Impuestos, Bancos…" className={inputCls + " w-[320px] max-w-full"} />
          <button type="submit" disabled={!nuevaCat.trim()}
            className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            <Plus size={14} /> Agregar</button>
        </form>
        <p className="text-ink2 text-[13px] mt-2 mb-0">Aparecen como opción al crear o editar tareas y como filtros del tablero. Quitar una categoría no toca las tarjetas que ya la tienen.</p>
        {permMsg && <p className={"text-sm mt-2 mb-0 " + (!permMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{permMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Parámetros de la plataforma</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <div className="flex flex-wrap gap-4">
          <label className="text-[13px] text-ink2">Nombre del equipo (sidebar)<br />
            <input value={parBoardName ?? settings.board_name ?? "Grupo Paris"} onChange={(e) => setParBoardName(e.target.value)} className={inputCls + " w-[200px] mt-1"} /></label>
          <label className="text-[13px] text-ink2">Preaviso de vencimiento (días en amarillo)<br />
            <input type="number" min={1} max={30} value={parWarn ?? String(settings.due_warn_days ?? 3)} onChange={(e) => setParWarn(e.target.value)} className={inputCls + " w-[90px] mt-1"} /></label>
          <label className="text-[13px] text-ink2">Días sin novedades para marcar "trabada"<br />
            <input type="number" min={1} max={30} value={parStuck ?? String(settings.stuck_days ?? 2)} onChange={(e) => setParStuck(e.target.value)} className={inputCls + " w-[90px] mt-1"} /></label>
        </div>
        <button onClick={() => saveSettings({
            ...settings,
            board_name: (parBoardName ?? settings.board_name ?? "Grupo Paris").trim() || "Grupo Paris",
            due_warn_days: Math.max(1, Math.min(30, Number(parWarn ?? settings.due_warn_days ?? 3) || 3)),
            stuck_days: Math.max(1, Math.min(30, Number(parStuck ?? settings.stuck_days ?? 2) || 2)),
          }, "Parámetros guardados")}
          className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold mt-3">Guardar parámetros</button>
        {permMsg && <p className={"text-sm mt-2 mb-0 " + (!permMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{permMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Respaldo</h2>
      <button onClick={backup} disabled={busy}
        className="flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-60" style={{ boxShadow: "var(--ring-sh)" }}>
        <Download size={16} /> {busy ? "Generando…" : "Descargar backup completo (JSON)"}
      </button>
      {msg && <p className="text-done text-sm mt-2">{msg}</p>}
      <p className="text-ink2 text-[13px] mt-1.5 max-w-[560px]">Todas las tablas en un archivo. Guardalo en el Drive del estudio una vez por mes: es tu seguro ante borrados accidentales.</p>
      </>}

      {reasignar && <ReasignarModal me={me} equipo={equipo} profiles={team} cards={cards} onClose={() => setReasignar(false)} />}
    </div>
  );
}
