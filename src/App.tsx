import { useEffect, useState } from "react";
import { ClipboardList, Target, TrendingUp, UserRound } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useTeam, useCards, useActivity } from "./hooks/useData";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import { Board } from "./features/board/Board";
import { CardModal } from "./features/board/CardModal";
import { Objetivos } from "./features/objetivos/Objetivos";
import { Reporte } from "./features/reporte/Reporte";
import { Resumen } from "./features/resumen/Resumen";
import { MiMes } from "./features/mimes/MiMes";
import { Tablon } from "./features/tablon/Tablon";
import { Admin } from "./features/admin/Admin";
import { UserModal } from "./features/admin/UserModal";
import { CommandPalette } from "./components/CommandPalette";
import type { Card, Profile } from "./lib/types";
import { cn } from "./lib/ui";

type Mode = "board" | "obj" | "mimes";

export default function App() {
  const { me, loading, signIn, signOut } = useAuth();
  const { theme, cycle } = useTheme();
  const isJefe = me?.role === "jefe";
  const { data: team = [] } = useTeam(!!isJefe);
  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const { data: activity = [] } = useActivity();
  const [viewing, setViewing] = useState<string>("");
  const [mode, setMode] = useState<Mode>("board");
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [openUser, setOpenUser] = useState<Profile | null>(null);
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((c) => !c); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center text-ink2">Cargando…</div>;
  if (!me) return <Login onSignIn={signIn} />;

  const view = viewing || (isJefe ? "__resumen" : me.id);
  const fullTeam = isJefe ? team : [me];
  const person = fullTeam.find((u) => u.id === view);
  const title = view === "__resumen" ? "Resumen del equipo"
    : view === "__reporte" ? "Reporte ejecutivo"
    : view === "__tablon" ? "Tablón del equipo"
    : view === "__admin" ? "Administración"
    : isJefe && person ? `Tablero de ${person.name}` : "Mi tablero";
  const pendByOwner = (id: string) => cards.filter((c) => c.owner === id && c.status !== "term" && c.card_type !== "operativa").length;
  const isPersonView = !["__resumen", "__reporte", "__tablon", "__admin"].includes(view);

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
        onCycleTheme={cycle} onNavigate={(v) => { setViewing(v); setMode("board"); }} onSignOut={signOut} pendByOwner={pendByOwner}
        subnav={isPersonView ? <>
          <SubTab m="board" icon={<ClipboardList size={14} />} label="Tareas" />
          <SubTab m="obj" icon={<Target size={14} />} label="Objetivos" />
          <SubTab m="mimes" icon={<TrendingUp size={14} />} label={isJefe ? "Su mes" : "Mi mes"} />
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
          : view === "__admin" ? <Admin team={fullTeam} meName={me.name} onOpenUser={setOpenUser} />
          : mode === "obj" ? <Objetivos ownerId={view} ownerName={person?.name ?? me.name} />
          : mode === "mimes" ? <MiMes cards={cards} activity={activity} ownerId={view} onOpenCard={setOpenCard} />
          : cardsLoading ? <BoardSkeleton />
          : <Board cards={cards} activity={activity} ownerId={view} meName={me.name} onOpen={setOpenCard} />}
      </Shell>
      {openCard && <CardModal card={cards.find((c) => c.id === openCard.id) ?? openCard} cards={cards} team={fullTeam} isJefe={!!isJefe} onClose={() => setOpenCard(null)} meName={me.name} />}
      {openUser && <UserModal user={fullTeam.find((t) => t.id === openUser.id) ?? openUser} meId={me.id} cards={cards} activity={activity} onClose={() => setOpenUser(null)} />}
      {cmdk && <CommandPalette me={me} team={fullTeam} cards={cards}
        onNavigate={(v) => { setViewing(v); setMode("board"); }} onOpenCard={setOpenCard} onClose={() => setCmdk(false)} />}
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

