import { useState, useEffect, type ReactNode } from "react";
import { LayoutDashboard, LogOut, Moon, ChevronDown, Menu, TrendingUp, Pin, Settings, KeyRound, AlignJustify, History, CalendarRange, ClipboardCheck, Network, StickyNote, Sparkles, Keyboard, WifiOff, MessageSquarePlus, Wallet } from "lucide-react";
import { useOnline } from "../hooks/useOnline";
import { Avatar, cn } from "../lib/ui";
import { PREF, getPref, setPref } from "../lib/prefs";
import { LogoMark } from "./Logo";
import { THEME_LBL, DENSITY_LBL } from "../hooks/useTheme";
import type { Profile } from "../lib/types";

interface Props {
  me: Profile; team: Profile[]; viewing: string; title: string;
  theme: string; onCycleTheme: () => void; density: string; onCycleDensity: () => void;
  onOpenAccount: () => void; onOpenNovedades?: () => void; onOpenConsultas?: () => void; tablonBadge?: string; boardName?: string;
  adminBadge?: string;
  onNavigate: (v: string) => void; onSignOut: () => void;
  pendByOwner: (id: string) => number; subnav?: ReactNode; notifs?: ReactNode; fullWidth?: boolean; children: ReactNode;
  misArqueosVisible?: boolean;
}

export function Shell({ me, team, viewing, title, theme, onCycleTheme, density, onCycleDensity, onOpenAccount, onOpenNovedades, onOpenConsultas, tablonBadge, adminBadge, boardName, onNavigate, onSignOut, pendByOwner, subnav, notifs, fullWidth = false, misArqueosVisible = false, children }: Props) {
  // barra lateral como drawer desplegable (Seiton: se muestra a demanda, deja la vista limpia).
  const online = useOnline();
  const [open, setOpen] = useState(() => {
    const saved = getPref(PREF.sidebar);
    if (saved) return saved === "open";
    return typeof window !== "undefined" && window.innerWidth >= 768;
  });
  useEffect(() => { setPref(PREF.sidebar, open ? "open" : "closed"); }, [open]);
  const [menu, setMenu] = useState(false);
  const esGestor = me.role !== "empleado"; // jefe o encargado: alcance de equipo (General + lista de personas)

  const NavItem = ({ v, icon, label, count, badge }: { v: string; icon?: ReactNode; label: string; count?: number; badge?: string }) => (
    <button onClick={() => { onNavigate(v); if (window.innerWidth < 768) setOpen(false); }}
      className={cn("flex items-center gap-2.5 w-full text-left rounded-[10px] px-2.5 py-[7px] text-[13.5px] relative transition-all duration-150",
        viewing === v ? "bg-white/[.09] text-white font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]"
          : "text-[color:var(--side-ink2)] hover:bg-white/[.05] hover:text-[color:var(--side-ink)] hover:translate-x-[1px]")}>
      {viewing === v && <span className="absolute -left-2.5 top-2 bottom-2 w-[3px] rounded-full bg-naranja" />}
      <span className={cn("w-5 grid place-items-center shrink-0 transition-colors", viewing === v ? "text-naranja" : "")}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className={cn("rounded-full text-[10.5px] px-1.5 py-px tnum font-semibold min-w-[20px] text-center",
        viewing === v ? "bg-white/20 text-white" : "bg-white/[.08] text-[color:var(--side-ink2)]")}>{count}</span> : null}
      {badge ? <span className="bg-naranja text-white rounded-full text-[10.5px] px-1.5 py-px font-bold tnum">{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex min-h-screen">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}
      <aside className={cn("w-[248px] shrink-0 flex flex-col h-screen z-30 transition-all duration-200 ease-out",
        // escritorio: en flujo (empuja el contenido) cuando abierta; colapsa a 0 cuando cerrada
        open ? "md:sticky md:top-0 md:translate-x-0" : "md:w-0 md:-translate-x-full md:overflow-hidden md:pointer-events-none",
        // móvil: cajón superpuesto con backdrop
        "max-md:fixed max-md:left-0 max-md:top-0", open ? "max-md:translate-x-0" : "max-md:-translate-x-full")}
        style={{ background: "linear-gradient(180deg,var(--side-bg2),var(--side-bg) 60%)", color: "var(--side-ink)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,.04),4px 0 24px rgba(0,0,0,.18)" }}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[color:var(--side-line)]">
          <LogoMark size={34} className="text-white shrink-0" />
          <div className="flex flex-col leading-tight">
            <b className="text-sm">Tablero Contable</b>
            <small className="text-[color:var(--side-ink2)] text-[11px] uppercase tracking-wider">{boardName ?? "Grupo Paris"}</small>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-0.5">
          {esGestor ? <>
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">General</div>
            <NavItem v="__resumen" icon={<LayoutDashboard size={17} />} label="Resumen" />
            <NavItem v="__reporte" icon={<TrendingUp size={17} />} label="Reporte ejecutivo" />
            <NavItem v="__cierre" icon={<ClipboardCheck size={17} />} label="Cierre mensual" />
            <NavItem v="__organigrama" icon={<Network size={17} />} label="Organigrama" />
            <NavItem v="__tablon" icon={<Pin size={17} />} label="Tablón" badge={tablonBadge} />
            <NavItem v="__calendario" icon={<CalendarRange size={17} />} label="Calendario" />
            <NavItem v="__bitacora" icon={<History size={17} />} label="Bitácora" />
            <NavItem v="__notas" icon={<StickyNote size={17} />} label="Anotaciones" />
            {misArqueosVisible && <NavItem v="__misarqueos" icon={<Wallet size={17} />} label="Mis arqueos" />}
            <NavItem v="__admin" icon={<Settings size={17} />} label="Administración" badge={adminBadge} />
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">Equipo</div>
            {team.map((u) => <NavItem key={u.id} v={u.id} icon={<Avatar name={u.name} size={22} />} label={u.name} count={pendByOwner(u.id)} />)}
          </> : <>
            <div className="text-[10px] tracking-[1.4px] uppercase text-[color:var(--side-ink2)] px-2.5 pt-3.5 pb-1.5">Mi espacio</div>
            <NavItem v={me.id} icon={<Avatar name={me.name} size={22} />} label="Mi tablero" />
            <NavItem v="__resumen" icon={<LayoutDashboard size={17} />} label="Mi resumen" />
            <NavItem v="__reporte" icon={<TrendingUp size={17} />} label="Mi reporte" />
            <NavItem v="__calendario" icon={<CalendarRange size={17} />} label="Calendario" />
            <NavItem v="__bitacora" icon={<History size={17} />} label="Mi bitácora" />
            <NavItem v="__notas" icon={<StickyNote size={17} />} label="Anotaciones" />
            {misArqueosVisible && <NavItem v="__misarqueos" icon={<Wallet size={17} />} label="Mis arqueos" />}
            <NavItem v="__tablon" icon={<Pin size={17} />} label="Tablón" badge={tablonBadge} />
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
              <button onClick={() => { setMenu(false); onOpenAccount(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <KeyRound size={16} /> Mi cuenta
              </button>
              <button onClick={() => { onCycleTheme(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <Moon size={16} /> Tema: {THEME_LBL[theme as keyof typeof THEME_LBL]}
              </button>
              <button onClick={() => { onCycleDensity(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <AlignJustify size={16} /> Densidad: {DENSITY_LBL[density as keyof typeof DENSITY_LBL]}
              </button>
              {onOpenConsultas && (
                <button onClick={() => { setMenu(false); onOpenConsultas(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                  <MessageSquarePlus size={16} /> Consultas
                </button>
              )}
              {onOpenNovedades && (
                <button onClick={() => { setMenu(false); onOpenNovedades(); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                  <Sparkles size={16} /> Novedades
                </button>
              )}
              <button onClick={onSignOut} className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5 text-sm text-ink hover:bg-surface2">
                <LogOut size={16} /> Cerrar sesión
              </button>
              {/* Atajos visibles (Kaizen H5): informativo, no accionable */}
              <div className="flex items-center gap-2.5 w-full rounded-md px-3 py-2.5 text-[12px] text-ink2 border-t border-line mt-1 pt-2.5 cursor-default select-none">
                <Keyboard size={16} /> Atajos: Ctrl+K buscar · Ctrl+Z deshacer
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col"
        style={{ background: "radial-gradient(circle at 1px 1px, color-mix(in srgb,var(--ink) 4%,transparent) 1px, transparent 0) 0 0/22px 22px, var(--bg)" }}>
        {!online && (
          <div className="flex items-center gap-2 bg-warn-soft text-warn text-[13px] font-semibold px-4 py-2">
            <WifiOff size={14} className="shrink-0" /> Sin conexión — los cambios no se van a guardar hasta que vuelva internet.
          </div>
        )}
        <div className="flex items-center gap-3.5 px-6 py-3 sticky top-0 z-10 border-b border-line/70"
          style={{ background: "color-mix(in srgb,var(--surface) 82%,transparent)", backdropFilter: "saturate(1.4) blur(14px)" }}>
          <button onClick={() => setOpen((o) => !o)} title="Mostrar/ocultar menú" className="border border-line bg-surface2 rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors"><Menu size={16} /></button>
          <div className="leading-tight">
            <h1 className="text-[19px] font-bold tracking-[-0.02em] m-0">{title}</h1>
          </div>
          <div className="flex-1" />
          {notifs}
          <span className="text-[12px] text-ink2 bg-surface2 border border-line rounded-full px-3 py-1 capitalize tnum">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        {/* El tablero (vista persona) necesita todo el ancho: 4 columnas ≈ 1300px.
            Las demás vistas se centran con tope para verse equilibradas (spec 20 #6). */}
        {subnav && <div className={cn("mx-auto w-full flex gap-1.5 px-6 pt-3.5", !fullWidth && "max-w-[1200px]")}>{subnav}</div>}
        <div className={cn("mx-auto w-full flex-1 flex flex-col min-w-0", !fullWidth && "max-w-[1200px]")}>{children}</div>
      </main>
    </div>
  );
}
