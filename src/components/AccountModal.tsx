import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function AccountModal({ name, email, onClose }: { name: string; email: string; onClose: () => void }) {
  const [old, setOld] = useState("");
  const [nu, setNu] = useState("");
  const [nu2, setNu2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setMsg(null);
    if (nu.length < 8 || !/[a-zA-Z]/.test(nu) || !/\d/.test(nu))
      return setMsg({ ok: false, txt: "La contraseña nueva debe tener al menos 8 caracteres, una letra y un número." });
    if (nu !== nu2) return setMsg({ ok: false, txt: "Las contraseñas nuevas no coinciden." });
    if (nu === old) return setMsg({ ok: false, txt: "La contraseña nueva debe ser distinta de la actual." });
    setBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: old });
    if (authErr) { setBusy(false); return setMsg({ ok: false, txt: "La contraseña actual es incorrecta." }); }
    const { error } = await supabase.auth.updateUser({ password: nu });
    setBusy(false);
    if (error) return setMsg({ ok: false, txt: "No se pudo cambiar: " + error.message });
    setMsg({ ok: true, txt: "✔ Contraseña cambiada correctamente." });
    setOld(""); setNu(""); setNu2("");
  };

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40" style={{ backdropFilter: "blur(3px)" }}>
      <div role="dialog" aria-modal className="bg-surface border border-line rounded-[18px] w-full max-w-[440px] p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)" }}>
        <h3 className="text-lg font-semibold m-0">Mi cuenta</h3>
        <div className="text-xs text-ink2 mb-3.5">{name} · {email}</div>
        <h4 className="text-xs uppercase tracking-wide text-ink2 mb-2">Cambiar contraseña</h4>
        <div className="grid gap-2.5">
          <label className="text-[13px] text-ink2">Contraseña actual
            <input type="password" autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Contraseña nueva
            <input type="password" autoComplete="new-password" value={nu} onChange={(e) => setNu(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Repetir contraseña nueva
            <input type="password" autoComplete="new-password" value={nu2} onChange={(e) => setNu2(e.target.value)} className={inputCls} />
          </label>
          <p className="text-ink2 text-xs m-0">Mínimo 8 caracteres, con al menos una letra y un número.</p>
        </div>
        {msg && <p className={"text-sm mt-3 " + (msg.ok ? "text-done" : "text-danger")}>{msg.txt}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={save} disabled={busy}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar contraseña"}</button>
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
