import { useEffect, useState } from "react";
import { ClipboardList, Target } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useTeam, useCards, useActivity } from "./hooks/useData";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import { Board } from "./features/board/Board";
import { CardModal } from "./features/board/CardModal";
import { Objetivos } from "./features/objetivos/Objetivos";
import { Reporte } from "./features/reporte/Reporte";
import { Tablon } from "./features/tablon/Tablon";
import { Admin } from "./features/admin/Admin";
import { CommandPalette } from "./components/CommandPalette";
import type { Card, Profile, ActivityLog } from "./lib/types";
import { cn } from "./lib/ui";

type Mode = "board" | "obj";

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
        </> : undefined}>
        {view === "__resumen" ? <ResumenLite cards={cards} team={fullTeam} />
          : view === "__reporte" ? <Reporte cards={cards} team={fullTeam} activity={activity} />
          : view === "__tablon" ? <Tablon />
          : view === "__admin" ? <Admin team={fullTeam} meName={me.name} />
          : mode === "obj" ? <Objetivos ownerId={view} />
          : cardsLoading ? <BoardSkeleton />
          : <Board cards={cards} ownerId={view} onOpen={setOpenCard} />}
      </Shell>
      {openCard && <CardModal card={cards.find((c) => c.id === openCard.id) ?? openCard} onClose={() => setOpenCard(null)} meName={me.name} />}
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

function ResumenLite({ cards, team }: { cards: Card[]; team: Profile[] }) {
  const open = cards.filter((c) => c.status !== "term" && c.card_type !== "operativa");
  const week = Date.now() - 7 * 86400000;
  const doneWeek = cards.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= week).length;
  return (
    <div className="px-6 py-4 max-w-[960px]">
      <div className="flex gap-2.5 flex-wrap mb-5">
        {([["Tareas abiertas", open.length], ["Terminadas (7 d)", doneWeek], ["Personas", team.filter((u) => u.role !== "jefe").length]] as const).map(([l, v]) => (
          <div key={l} className="bg-surface rounded-2xl px-[18px] py-3.5" style={{ boxShadow: "var(--ring),var(--shadow)" }}>
            <b className="block text-[26px] font-bold tracking-tight tnum">{v}</b>
            <span className="text-[11.5px] text-ink2 uppercase tracking-wide">{l}</span>
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-2xl p-[18px]" style={{ boxShadow: "var(--ring),var(--shadow)" }}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Carga abierta por persona</h3>
        {team.map((u) => {
          const n = open.filter((c) => c.owner === u.id).length;
          return (
            <div key={u.id} className="flex items-center gap-3 py-1.5 text-sm border-t border-line first:border-0">
              <span className="w-[150px] truncate">{u.name} <span className="text-ink2 text-xs capitalize">{u.role}</span></span>
              <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, n * 12)}%`, background: "linear-gradient(90deg,var(--s1),var(--accent))" }} />
              </div>
              <b className="tnum">{n}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export type { ActivityLog };
