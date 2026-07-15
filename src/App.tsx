import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { supabase } from "./lib/supabase";
import { popUndo } from "./lib/undo";
import { ClipboardList, Target, TrendingUp, UserRound, CalendarDays } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useTeam, useCards, useActivity, useAnnouncements, useSettings } from "./hooks/useData";
import { AccountModal } from "./components/AccountModal";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import { Board } from "./features/board/Board";
import { CardModal } from "./features/board/CardModal";
import { Objetivos } from "./features/objetivos/Objetivos";
import { Reporte } from "./features/reporte/Reporte";
import { Resumen } from "./features/resumen/Resumen";
import { MiMes } from "./features/mimes/MiMes";
import { Tablon } from "./features/tablon/Tablon";
import { Semana } from "./features/semana/Semana";
import { Bitacora } from "./features/bitacora/Bitacora";
import { Calendario } from "./features/calendario/Calendario";
import { Admin } from "./features/admin/Admin";
import { UserModal } from "./features/admin/UserModal";
import { CommandPalette } from "./components/CommandPalette";
import type { Card, Profile } from "./lib/types";
import { cn } from "./lib/ui";

type Mode = "board" | "semana" | "obj" | "mimes";

export default function App() {
  const { me, loading, signIn, signOut } = useAuth();
  const { theme, cycle, density, cycleDensity } = useTheme();
  const { data: annos = [] } = useAnnouncements();
  const { data: settings } = useSettings();
  const [account, setAccount] = useState(false);
  const isJefe = me?.role === "jefe";
  const { data: team = [] } = useTeam(!!isJefe);
  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const { data: activity = [] } = useActivity();
  const [viewing, setViewing] = useState<string>("");
  const [mode, setMode] = useState<Mode>("board");
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [openUser, setOpenUser] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const qcRef = useQueryClient();
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((c) => !c); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target as HTMLElement).closest("input,textarea,select")) {
        e.preventDefault();
        const u = popUndo();
        if (!u) { toast("Nada para deshacer."); return; }
        supabase.from("cards").update(u.prev).eq("id", u.id).then(({ error }) => {
          if (error) toast.error("No se pudo deshacer: " + error.message);
          else toast.success("Deshecho");
          qcRef.invalidateQueries({ queryKey: ["cards"] });
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [qcRef]);


  if (loading) return <div className="min-h-screen grid place-items-center text-ink2">Cargando…</div>;
  if (!me) return <Login onSignIn={signIn} />;

  const view = viewing || (isJefe ? "__resumen" : me.id);
  const fullTeam = isJefe ? team : [me];
  const person = fullTeam.find((u) => u.id === view);
  const title = view === "__resumen" ? "Resumen del equipo"
    : view === "__reporte" ? "Reporte ejecutivo"
    : view === "__tablon" ? "Tablón del equipo"
    : view === "__admin" ? "Administración"
    : view === "__bitacora" ? "Bitácora"
    : view === "__calendario" ? "Calendario"
    : isJefe && person ? `Tablero de ${person.name}` : "Mi tablero";
  const pendByOwner = (id: string) => cards.filter((c) => c.owner === id && c.status !== "term" && c.card_type !== "operativa").length;
  const isPersonView = !["__resumen", "__reporte", "__tablon", "__admin", "__bitacora", "__calendario"].includes(view);

  // badge del tablón: vencimientos próximos o publicaciones no vistas (por navegador)
  const vencProximos = annos.filter((a) => a.kind === "vencimiento" && a.due_date &&
    (new Date(a.due_date + "T00:00:00").getTime() - Date.now()) / 86400000 <= 5 &&
    new Date(a.due_date + "T23:59:59").getTime() >= Date.now()).length;
  const visto = localStorage.getItem("tablon-visto") ?? "1970-01-01";
  const nuevas = annos.filter((a) => a.created_at > visto && a.created_by !== me.name).length;
  const tablonBadge = nuevas ? `+${nuevas}` : (vencProximos ? String(vencProximos) : undefined);

  const SubTab = ({ m, icon, label }: { m: Mode; icon: React.ReactNode; label: string }) => (
    <button onClick={() => setMode(m)}
      className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border transition",
        mode === m ? "bg-accent-soft border-accent text-accent font-semibold" : "bg-surface2 border-line text-ink2")}>
      {icon} {label}
    </button>
  );

  return (
    <>
      <Shell me={me} team={fullTeam} viewing={view} title={title} theme={theme}
        onCycleTheme={cycle} density={density} onCycleDensity={cycleDensity}
        onOpenAccount={() => setAccount(true)} tablonBadge={tablonBadge} boardName={settings?.board_name}
        onNavigate={(v) => { setViewing(v); setMode("board"); setQuery(""); }} onSignOut={signOut} pendByOwner={pendByOwner}
        subnav={isPersonView ? <>
          <SubTab m="board" icon={<ClipboardList size={14} />} label="Tareas" />
          <SubTab m="semana" icon={<CalendarDays size={14} />} label="Semana" />
          <SubTab m="obj" icon={<Target size={14} />} label="Objetivos" />
          <SubTab m="mimes" icon={<TrendingUp size={14} />} label={isJefe ? "Su mes" : "Mi mes"} />
          {mode === "board" && (
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarea…"
              className="bg-surface2 border border-line rounded-lg px-3 py-1.5 text-[13px] w-[200px]" />
          )}
          {isJefe && person && (
            <button onClick={() => setOpenUser(person)}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border bg-surface2 border-line text-ink2 transition">
              <UserRound size={14} /> Ficha
            </button>
          )}
        </> : undefined}>
        {view === "__resumen" ? <Resumen cards={cards} team={fullTeam} activity={activity} onOpenCard={setOpenCard} onGoPerson={(id) => { setViewing(id); setMode("board"); }} />
          : view === "__reporte" ? <Reporte cards={cards} team={fullTeam} activity={activity} />
          : view === "__tablon" ? <Tablon />
          : view === "__admin" ? <Admin team={fullTeam} cards={cards} meName={me.name} onOpenUser={setOpenUser} />
          : view === "__bitacora" ? <Bitacora cards={cards} activity={activity} team={fullTeam} isJefe={!!isJefe} meId={me.id} onOpenCard={setOpenCard} />
          : view === "__calendario" ? <Calendario isJefe={!!isJefe} meName={me.name} />
          : mode === "semana" ? <Semana cards={cards} ownerId={view} meName={me.name} onOpen={setOpenCard} />
          : mode === "obj" ? <Objetivos ownerId={view} ownerName={person?.name ?? me.name} />
          : mode === "mimes" ? <MiMes cards={cards} activity={activity} ownerId={view} onOpenCard={setOpenCard} />
          : cardsLoading ? <BoardSkeleton />
          : <Board cards={cards} activity={activity} ownerId={view} meName={me.name} query={query} onOpen={setOpenCard} />}
      </Shell>
      {openCard && <CardModal card={cards.find((c) => c.id === openCard.id) ?? openCard} cards={cards} team={fullTeam} isJefe={!!isJefe} onClose={() => setOpenCard(null)} meName={me.name} />}
      {openUser && <UserModal user={fullTeam.find((t) => t.id === openUser.id) ?? openUser} meId={me.id} cards={cards} activity={activity} onClose={() => setOpenUser(null)} />}
      {account && <AccountModal name={me.name} email={me.email} onClose={() => setAccount(false)} />}
      <Toaster position="bottom-center" toastOptions={{ style: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" } }} />
      {cmdk && <CommandPalette me={me} team={fullTeam} cards={cards}
        onNavigate={(v) => { setViewing(v); setMode("board"); setQuery(""); }} onOpenCard={setOpenCard} onClose={() => setCmdk(false)} />}
    </>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 px-6 pt-4">
      {[3, 4, 2].map((n, i) => (
        <div key={i} className="min-w-[290px] rounded-2xl p-3 bg-surface2/60">
          <div className="h-3.5 w-3/5 rounded bg-line/60 mb-3.5 animate-pulse" />
          {Array.from({ length: n }).map((_, j) => <div key={j} className="h-14 rounded-lg bg-line/40 mb-2 animate-pulse" />)}
        </div>
      ))}
    </div>
  );
}

