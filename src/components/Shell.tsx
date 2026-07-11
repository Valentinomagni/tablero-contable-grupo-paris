import { useState, type ReactNode } from "react";
import { LayoutDashboard, ClipboardList, LogOut, Moon, ChevronDown, Menu, TrendingUp } from "lucide-react";
import { Avatar, cn } from "../lib/ui";
import { THEME_LBL } from "../hooks/useTheme";
import type { Profile } from "../lib/types";

interface Props {
  me: Profile; team: Profile[]; viewing: string; title: string;
  theme: string; onCycleTheme: () => void; onNavigate: (v: string) => void; onSignOut: () => void;
  pendByOwner: (id: string) => number; subnav?: ReactNode; children: ReactNode;
}

export function Shell({ me, team, viewing, title, theme, onCycleTheme, onNavigate, onSignOut, pendByOwner, subnav, children }: Props) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const isJefe = me.role === "jefe";

  const NavItem = ({ v, icon, label, count }: { v: string; icon?: ReactNode; label: string; count?: number }) => (
    <button onClick={() => { onNavigate(v); setOpen(false); }}
      className={cn("flex items-center gap-2.5 w-full text-left rounded-[10px] px-2.5 py-2 text-sm relative transition",
        viewing === v ? "bg-white/10 text-white font-semibold" : "text-[color:var(--side-ink2)] hover:bg-white/[.06] hover:text-[color:var(--side-ink)]")}>
      {viewing === v && <span className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded bg-naranja" />}
      <span className="w-5 grid place-items-center shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className="bg-white/15 text-white rounded-full text-[11px] px-2 tnum">{count}</span> : null}
    </button>
  );

  return (
    <div className="flex min-h-screen">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}
      <aside className={cn("w-[248px] shrink-0 flex flex-col sticky top-0 h-screen z-30 transition-transform",
        "max-md:fixed max-md:left-0", open ? "max-md:translate-x-0" : "max-md:-translate-x-full")}
        style={{ background: "linear-gradient(180deg,var(--side-bg2),var(--side-bg) 60%)", color: "var(--side-ink)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,.04),4px 0 24px rgba(0,0,0,.18)" }}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[color:var(--side-line)]">
          <span className="w-[34px] h-[34px] bg-white text-[#0b0b0d] rounded-[9px] grid place-items-center text-[20px] font-black shrink-0"
            style={{ boxShadow: "inset 0 0 0 2px #0b0b0d,inset 0 0 0 4px #fff" }}>P</span>
          <div className="flex flex-col leading-tight">
            <b className="text-sm">Tablero Contable</b>
            <small className="text-[color:var(--side-ink2)] text-[11px] uppercase tracking-wider">Grupo Paris</small>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-0.5">
          {isJefe ? <>
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">General</div>
            <NavItem v="__resumen" icon={<LayoutDashboard size={17} />} label="Resumen" />
            <NavItem v="__reporte" icon={<TrendingUp size={17} />} label="Reporte ejecutivo" />
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">Equipo</div>
            {team.map((u) => <NavItem key={u.id} v={u.id} icon={<Avatar name={u.name} size={22} />} label={u.name} count={pendByOwner(u.id)} />)}
          </> : <>
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">Mi espacio</div>
            <NavItem v={me.id} icon={<Avatar name={me.name} size={22} />} label="Mi tablero" />
          </>}
        </nav>
        <div className="relative border-t border-[color:var(--side-line)] p-2.5">
          <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-[13px] hover:bg-white/[.06]">
            <Avatar name={me.name} size={26} />
            <span className="flex-1 leading-tight overflow-hidden text-left">
              <b className="block truncate">{me.name}</b>
              <small className="text-[color:var(--side-ink2)] capitalize">{me.role}</small>
            </span>
            <ChevronDown size={14} className="text-[color:var(--side-ink2)]" />
          </button>
          {menu && (
            <div className="absolute bottom-[calc(100%+6px)] left-2.5 right-2.5 bg-surface border border-line rounded-[10px] p-1.5 z-40"
              style={{ boxShadow: "var(--shadow-lg)" }}>
              <button onClick={() => { onCycleTheme(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <Moon size={16} /> Tema: {THEME_LBL[theme as keyof typeof THEME_LBL]}
              </button>
              <button onClick={onSignOut} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col"
        style={{ background: "radial-gradient(circle at 1px 1px, color-mix(in srgb,var(--ink) 4%,transparent) 1px, transparent 0) 0 0/22px 22px, var(--bg)" }}>
        <div className="flex items-center gap-3.5 px-6 py-3.5 sticky top-0 z-10 border-b border-line/70"
          style={{ background: "color-mix(in srgb,var(--surface) 78%,transparent)", backdropFilter: "saturate(1.4) blur(12px)" }}>
          <button onClick={() => setOpen(true)} className="md:hidden border border-line rounded-lg px-2.5 py-1.5"><Menu size={16} /></button>
          <h1 className="text-[17px] font-semibold tracking-tight m-0">{title}</h1>
          <div className="flex-1" />
          <span className="text-[13px] text-ink2">{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        {subnav && <div className="flex gap-1.5 px-6 pt-3.5">{subnav}</div>}
        {children}
      </main>
    </div>
  );
}

export const boardIcon = <ClipboardList size={16} />;
