import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { Avatar } from "../../lib/ui";

export function Admin({ team, meName, onOpenUser }: { team: Profile[]; meName: string; onOpenUser: (u: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
    setBusy(false); setMsg("✔ Backup descargado. Guardalo en el Drive.");
  }

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Equipo — clic en una persona para editar su ficha</h2>
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-ink2">
            <th className="text-left px-4 py-2.5">Persona</th><th className="text-left px-4 py-2.5">Rol</th><th className="text-left px-4 py-2.5">Puesto</th>
          </tr></thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id} onClick={() => onOpenUser(u)} className="border-t border-line cursor-pointer hover:bg-surface2">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={u.name} size={24} /><div><b>{u.name}</b><br /><span className="text-ink2 text-xs">{u.email}</span></div></div></td>
                <td className="px-4 py-2.5 capitalize">{u.role}</td>
                <td className="px-4 py-2.5 text-ink2">{u.puesto || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Respaldo</h2>
      <button onClick={backup} disabled={busy}
        className="flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-60" style={{ boxShadow: "var(--ring-sh)" }}>
        <Download size={16} /> {busy ? "Generando…" : "Descargar backup completo (JSON)"}
      </button>
      {msg && <p className="text-done text-sm mt-2">{msg}</p>}
      <p className="text-ink2 text-[13px] mt-1.5 max-w-[560px]">Todas las tablas en un archivo. Guardalo en el Drive del estudio una vez por mes: es tu seguro ante borrados accidentales. La creación de usuarios y los permisos se gestionan por ahora desde la app original.</p>
    </div>
  );
}
