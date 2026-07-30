import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useArca, ArcaAgenda } from "../features/tablon/arca";
import { relevantes } from "../lib/arca-filtro";

interface PubVenc { title: string; due_date: string; detail: string; }

// vencimientos visibles sin login (RLS anon permite kind='vencimiento')
function usePublicVenc() {
  const [items, setItems] = useState<PubVenc[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("announcements")
        .select("title,due_date,detail").eq("kind", "vencimiento")
        .gte("due_date", new Date(Date.now() - 86400000).toISOString().slice(0, 10))
        .order("due_date").limit(6);
      if (!error && data?.length) setItems(data as PubVenc[]);
    })();
  }, []);
  return items;
}

function VencBadge({ due }: { due: string }) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const days = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  const lbl = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const [txt, cls] = days < 0 ? [`venció ${lbl}`, "bg-danger/15 text-danger"]
    : days === 0 ? ["HOY", "bg-warn/15 text-warn"]
    : days <= 5 ? [`${lbl} · ${days} d`, "bg-warn/15 text-warn"]
    : [`${lbl} · ${days} d`, "bg-white/10 text-[#9aa0ab]"];
  return <span className={`rounded-md px-2 py-0.5 text-2xs font-semibold tnum shrink-0 ${cls}`}>{txt}</span>;
}

export function Login({ onSignIn }: { onSignIn: (e: string, p: string) => Promise<{ message: string } | null> }) {
  const vencs = usePublicVenc();
  const arca = relevantes(useArca());
  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const error = await onSignIn(identificador, password);
    setBusy(false);
    // El mensaje ya viene traducido por `mensajeDeLogin` (lib/auth.ts), que distingue usuario
    // inexistente, credenciales que no coinciden, falta de conexión y demasiados intentos.
    // Antes había acá un ternario que buscaba "Invalid" en el texto crudo de Supabase; con la
    // traducción hecha río arriba esa rama no dispara nunca, así que se fue.
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center gap-14 p-8 flex-wrap"
      style={{ background: "radial-gradient(1200px 700px at 30% 20%, #17181c 0%, #0b0b0d 60%)" }}>
      <div className="flex flex-col items-center gap-3 max-w-[380px]">
        {/* lockup oficial procesado desde logo.jpg (fondo removido) — fidelidad 1:1 */}
        <img src="/brand/lockup-blanco.svg" alt="Grupo Paris" className="w-[210px] h-auto" />
        <p className="text-[#9aa0ab] tracking-[3px] uppercase text-xs mt-2">Tablero Contable</p>
        <p className="text-[#5c6270] text-2xs tracking-[1.5px] uppercase mt-6 text-center leading-relaxed">
          整理 Seiri · 整頓 Seiton · 清掃 Seiso<br />清潔 Seiketsu · 躾 Shitsuke
        </p>
        <p className="text-[#5c6270] text-2xs tracking-wide mt-1">Kaizen — mejora continua, todos los días</p>
      </div>

      <form onSubmit={submit}
        className="bg-surface border border-line rounded-2xl p-8 w-full max-w-[390px] flex flex-col gap-3.5"
        style={{ boxShadow: "0 18px 50px rgba(9,20,40,.35)" }}>
        <h1 className="text-ink2 text-sm font-semibold m-0">Ingresá con tu usuario</h1>
        {err && <div className="bg-danger/10 text-danger rounded-lg px-3 py-2.5 text-sm">{err}</div>}
        <label className="text-sm text-ink2 flex flex-col gap-1.5">Usuario o email
          <input type="text" autoComplete="username" required value={identificador} onChange={(e) => setIdentificador(e.target.value)}
            placeholder="Ej: Vmagni o tu email"
            className="bg-surface2 border border-line rounded-lg text-ink text-sm px-2.5 py-2 outline-none focus:ring-2 focus:ring-accent" />
        </label>
        <label className="text-sm text-ink2 flex flex-col gap-1.5">Contraseña
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="bg-surface2 border border-line rounded-lg text-ink text-sm px-2.5 py-2 outline-none focus:ring-2 focus:ring-accent" />
        </label>
        <button type="submit" disabled={busy}
          className="bg-[#0b0b0d] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-60 transition hover:bg-[#23252b] tracking-wide border border-white/10">
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
        <p className="text-xs text-ink2 m-0">Si no tenés usuario o olvidaste la contraseña, pedile el alta a un jefe.</p>
      </form>

      {(vencs.length > 0 || arca.length > 0) && (
        <div className="w-full max-w-[390px] rounded-2xl border border-white/10 p-5 max-h-[80vh] overflow-y-auto" style={{ background: "rgba(255,255,255,.03)" }}>
          {vencs.length > 0 && (
            <>
              <h2 className="text-[#9aa0ab] uppercase tracking-[2px] text-xs font-semibold mt-0 mb-3">Próximos vencimientos del equipo</h2>
              {vencs.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <b className="text-white text-sm truncate">{v.title}</b>
                  <VencBadge due={v.due_date} />
                </div>
              ))}
            </>
          )}
          {arca.length > 0 && (
            <>
              <h2 className="text-[#9aa0ab] uppercase tracking-[2px] text-xs font-semibold mt-5 mb-3">Agenda ARCA — {mes}</h2>
              <ArcaAgenda items={arca} />
              <p className="text-[#9aa0ab] text-2xs m-0">Fuente: arca.gob.ar · se actualiza sola</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
