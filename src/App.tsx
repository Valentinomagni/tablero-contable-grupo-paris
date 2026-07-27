import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { deshacerUltimo } from "./lib/deshacer";
import { PREF, getPref, setPref } from "./lib/prefs";
import { ClipboardList, Target, TrendingUp, UserRound, CalendarDays, Users, Archive, Sun } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { usePresencia } from "./hooks/usePresencia";
import { useTheme } from "./hooks/useTheme";
import { useTeam, useCards, useActivity, useAnnouncements, useSettings, useConsultasNuevas, useCardPeriodos } from "./hooks/useData";
import { contarNuevas } from "./lib/consultas";
import { AccountModal } from "./components/AccountModal";
import { NovedadesModal } from "./components/NovedadesModal";
import { ConsultasModal } from "./features/consultas/ConsultasModal";
import { NotificacionesBell } from "./components/NotificacionesPanel";
import { APP_VERSION } from "./lib/version";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Board } from "./features/board/Board";
import { CardModal } from "./features/board/CardModal";
import { DelegarModal } from "./features/board/DelegarModal";
import { Objetivos } from "./features/objetivos/Objetivos";
import { Resumen } from "./features/resumen/Resumen";
import { MiMes } from "./features/mimes/MiMes";
import { Tablon } from "./features/tablon/Tablon";
import { Semana } from "./features/semana/Semana";
import { UserModal } from "./features/admin/UserModal";
import { cardsDeControl } from "./hooks/useArqueo";

// Code-split (Kaizen H2): vistas que no participan del primer render van a chunks propios.
const Reporte = lazy(() => import("./features/reporte/Reporte"));
const Calendario = lazy(() => import("./features/calendario/Calendario"));
const Cierre = lazy(() => import("./features/cierre/Cierre").then((m) => ({ default: m.Cierre })));
const Organigrama = lazy(() => import("./features/organigrama/Organigrama"));
const Notas = lazy(() => import("./features/notas/Notas").then((m) => ({ default: m.Notas })));
const Bitacora = lazy(() => import("./features/bitacora/Bitacora"));
const Admin = lazy(() => import("./features/admin/Admin").then((m) => ({ default: m.Admin })));
const HistorialMes = lazy(() => import("./features/historial/HistorialMes"));
const MiDia = lazy(() => import("./features/hoy/MiDia").then((m) => ({ default: m.MiDia })));
const MisArqueos = lazy(() => import("./features/arqueo/MisArqueos"));
import { CommandPalette } from "./components/CommandPalette";
import type { Card, Profile, AppSettings } from "./lib/types";
import { visiblesPara, cardsDeEquipo } from "./lib/jerarquia";
import { personasVisibles, cardsVisibles } from "./lib/visibilidad";
import { proximosVencimientos } from "./lib/vencimientos";
import { avisosParaNotificar } from "./lib/notificaciones";
import { toARTDate } from "./lib/metrics";
import { periodoVigente, periodosDisponibles, periodoLabel, cardsDelPeriodo } from "./lib/periodo-instancias";
import { supabase } from "./lib/supabase";
import { cn } from "./lib/ui";

type Mode = "hoy" | "board" | "semana" | "obj" | "mimes" | "hist";

export default function App() {
  const { me, loading, signIn, signOut } = useAuth();
  usePresencia(me?.id);
  const { theme, cycle, density, cycleDensity } = useTheme();
  const { data: annos = [] } = useAnnouncements();
  const { data: settings } = useSettings();
  const [account, setAccount] = useState(false);
  const isJefe = me?.role === "jefe";
  const esGestor = !!me && me.role !== "empleado"; // jefe o encargado: alcance de equipo
  const { data: team = [] } = useTeam(esGestor);
  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const { data: activity = [] } = useActivity();
  const { data: periodos = [] } = useCardPeriodos();
  const hoyISO = new Date().toISOString();
  const [periodoSel, setPeriodoSel] = useState<string>(() => periodoVigente(hoyISO));
  const [viewing, setViewing] = useState<string>("");
  const [mode, setMode] = useState<Mode>("board");
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [openUser, setOpenUser] = useState<Profile | null>(null);
  const [query, setQuery] = useState("");
  const qcRef = useQueryClient();
  const [cmdk, setCmdk] = useState(false);
  const [delegar, setDelegar] = useState(false);
  const [novedades, setNovedades] = useState(false);
  const [consultas, setConsultas] = useState(false);
  const { data: consultasNuevas = [] } = useConsultasNuevas(!!isJefe);
  const adminBadgeN = contarNuevas(consultasNuevas);

  // Aviso de nueva versión: se muestra una sola vez tras el login (spec #10).
  useEffect(() => {
    if (me && getPref(PREF.version) !== APP_VERSION) setNovedades(true);
  }, [me]);

  // E8 (spec 28 Fase B): notificación propia cuando un vencimiento del tablón es
  // hoy o mañana. Se ejecuta una sola vez por sesión (notifiedRef), después de
  // tener sesión y avisos cargados. Dedup real: se leen los ids de aviso ya
  // notificados desde la tabla `notifications` (reutilizamos `card_id`, columna
  // uuid sin FK real —ver migración 21— como referencia genérica al id del aviso,
  // siguiendo el mismo patrón que ya usan DelegarModal/Board/Tablon para escribir
  // notificaciones), así que recargar la página no duplica avisos.
  // Defensivo: si la tabla no existe o falla la red, silencio total (no rompe el arranque).
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!me || notifiedRef.current || annos.length === 0) return;
    notifiedRef.current = true;
    (async () => {
      try {
        const { data } = await supabase.from("notifications")
          .select("card_id").eq("owner", me.id).eq("tipo", "vencimiento_propio");
        const yaNotificados = ((data ?? []) as { card_id: string | null }[])
          .map((n) => n.card_id).filter((id): id is string => !!id);
        const hoyISO = toARTDate(new Date().toISOString());
        const pendientes = avisosParaNotificar(annos, me.id, hoyISO, yaNotificados);
        if (pendientes.length) {
          const notifs = pendientes.map((a) => ({
            owner: me.id, tipo: "vencimiento_propio" as const,
            titulo: `Vence pronto: ${a.title}`, detalle: "",
            card_id: a.id, leida: false,
          }));
          await supabase.from("notifications").insert(notifs);
        }
      } catch { /* defensivo: tabla ausente o red, silencio total */ }
    })();
  }, [me, annos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((c) => !c); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target as HTMLElement).closest("input,textarea,select")) {
        e.preventDefault();
        deshacerUltimo(qcRef).then((m) => (m === "Deshecho" ? toast.success(m) : m === "Nada para deshacer." ? toast(m) : toast.error(m)));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [qcRef]);


  if (loading) return <div className="min-h-screen grid place-items-center text-ink2">Cargando…</div>;
  if (!me) return <Login onSignIn={signIn} />;

  const view = viewing || (esGestor ? "__resumen" : me.id);
  // Alcance por rol: jefe ve todos; encargado ve su equipo (visiblesPara); empleado solo a sí mismo.
  // Ojo: si el Plan 02 aún no cargó manager_id, equipoDe devuelve [] y el encargado se ve solo a sí mismo (OK, no crashea).
  const fullTeam = esGestor ? visiblesPara(me, team) : [me];
  // Administrador fantasma (spec 28, Fase A): equipoVisible excluye a quien tenga oculto=true
  // de listados, organigrama y métricas. fullTeam (sin filtrar) sigue vivo para el panel de
  // Administración, que sí debe poder ver y gestionar al usuario oculto.
  const equipoVisible = personasVisibles(fullTeam);
  // Resumen/Reporte: jefe recibe todas las cards; no-jefe solo las de su equipo visible (spec #5, #10).
  // En los dos caminos se excluyen siempre las cards del usuario oculto (spec 28): no participa de métricas/alertas.
  const scopedCards = cardsVisibles(isJefe ? cards : cardsDeEquipo(cards, equipoVisible), fullTeam);
  const person = fullTeam.find((u) => u.id === view);
  // Acceso a "Mis arqueos" (spec28 fase B, Task 1): sólo si el usuario tiene alguna card de
  // control (requiere_resultado) asignada, para no ensuciar el menú de quien no hace arqueos.
  const misArqueosVisible = cardsDeControl(cards).some((c) => c.owner === me.id);
  const title = view === "__resumen" ? (esGestor ? "Resumen del equipo" : "Mi resumen")
    : view === "__misarqueos" ? "Mis arqueos"
    : view === "__reporte" ? (esGestor ? "Reporte ejecutivo" : "Mi reporte")
    : view === "__tablon" ? "Tablón del equipo"
    : view === "__admin" ? "Administración"
    : view === "__bitacora" ? "Bitácora"
    : view === "__calendario" ? "Calendario"
    : view === "__cierre" ? "Cierre mensual"
    : view === "__organigrama" ? "Organigrama"
    : view === "__notas" ? "Anotaciones"
    : esGestor && person && person.id !== me.id ? `Tablero de ${person.name}` : "Mi tablero";
  const pendByOwner = (id: string) => cards.filter((c) => c.owner === id && c.status !== "term" && c.card_type !== "operativa").length;
  const isPersonView = !["__resumen", "__reporte", "__tablon", "__admin", "__bitacora", "__calendario", "__cierre", "__organigrama", "__notas", "__misarqueos"].includes(view);
  // Períodos (propuesta de períodos): selector de mes solo en el tablero de una persona.
  // Fase 2: el mes VIGENTE lee/escribe en `cards` como siempre; los meses NO vigentes leen
  // y escriben su estado en `card_periodos`, independientes. `cardsVista` es la lista que ve
  // el Board del período elegido (cruda si es el vigente, mergeada si no).
  const opcionesPeriodo = periodosDisponibles(periodos, hoyISO);
  const vigente = periodoVigente(hoyISO);
  const cardsVista = cardsDelPeriodo(cards, periodos, periodoSel, vigente);

  // badge del tablón: vencimientos próximos o publicaciones no vistas (por navegador)
  const vencProximos = proximosVencimientos(annos, new Date(), 5).length;
  const visto = getPref(PREF.tablon) ?? "1970-01-01";
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
      <Shell me={me} team={equipoVisible} viewing={view} title={title} theme={theme}
        onCycleTheme={cycle} density={density} onCycleDensity={cycleDensity}
        onOpenAccount={() => setAccount(true)} onOpenNovedades={() => setNovedades(true)} onOpenConsultas={() => setConsultas(true)}
        tablonBadge={tablonBadge} adminBadge={isJefe && adminBadgeN ? String(adminBadgeN) : undefined} boardName={settings?.board_name}
        onNavigate={(v) => { setViewing(v); setMode("board"); setQuery(""); }} onSignOut={signOut} pendByOwner={pendByOwner}
        misArqueosVisible={misArqueosVisible}
        fullWidth={isPersonView && mode === "board"}
        notifs={<NotificacionesBell onOpenCard={(id) => { const c = cards.find((x) => x.id === id); if (c) setOpenCard(c); else toast("La tarea de esta notificación ya no está disponible."); }} />}
        subnav={isPersonView ? <>
          <SubTab m="hoy" icon={<Sun size={14} />} label="Hoy" />
          <SubTab m="board" icon={<ClipboardList size={14} />} label="Tareas" />
          <SubTab m="semana" icon={<CalendarDays size={14} />} label="Semana" />
          <SubTab m="obj" icon={<Target size={14} />} label="Objetivos" />
          <SubTab m="mimes" icon={<TrendingUp size={14} />} label={person && person.id !== me.id ? "Su mes" : "Mi mes"} />
          <SubTab m="hist" icon={<Archive size={14} />} label="Historial" />
          {mode === "board" && opcionesPeriodo.length > 1 && (
            <div className="flex items-center gap-1 border border-line bg-surface2 rounded-lg p-1" title="Período del tablero">
              <span className="text-[12px] text-ink2 px-1.5">Período</span>
              {opcionesPeriodo.map((p) => (
                <button key={p} onClick={() => setPeriodoSel(p)}
                  className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium transition capitalize",
                    p === periodoSel ? "bg-accent-soft text-accent font-semibold" : "text-ink2 hover:text-ink")}>
                  {periodoLabel(p)}
                </button>
              ))}
            </div>
          )}
          {mode === "board" && (
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarea…"
              className="bg-surface2 border border-line rounded-lg px-3 py-1.5 text-[13px] w-[200px]" />
          )}
          {view === me.id && (
            <button onClick={() => setDelegar(true)}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border bg-surface2 border-line text-ink2 transition">
              <Users size={14} /> Delegar tarea
            </button>
          )}
          {esGestor && person && person.id !== me.id && (
            <button onClick={() => setOpenUser(person)}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border bg-surface2 border-line text-ink2 transition">
              <UserRound size={14} /> Ficha
            </button>
          )}
        </> : undefined}>
        <ErrorBoundary key={view}>
        <Suspense fallback={<div className="px-6 py-8 text-ink2 text-sm">Cargando…</div>}>
        {view === "__resumen" ? <Resumen cards={scopedCards} team={equipoVisible} activity={activity} onOpenCard={setOpenCard} onGoPerson={(id) => { setViewing(id); setMode("board"); }} onDelegar={esGestor ? () => setDelegar(true) : undefined} annos={annos} esGestor={esGestor} />
          : view === "__reporte" ? <Reporte cards={scopedCards} team={equipoVisible} activity={activity} />
          : view === "__tablon" ? <Tablon me={me} team={equipoVisible} onGoCalendario={() => setViewing("__calendario")} />
          : view === "__admin" ? <Admin team={fullTeam} cards={cards} me={me} meName={me.name} onOpenUser={setOpenUser} />
          : view === "__bitacora" ? <Bitacora cards={scopedCards} activity={activity} team={equipoVisible} isJefe={!!isJefe} meId={me.id} onOpenCard={setOpenCard} />
          : view === "__calendario" ? <Calendario me={me} team={equipoVisible} cards={scopedCards} />
          : view === "__cierre" ? <Cierre cards={scopedCards} team={equipoVisible} isJefe={!!isJefe} meId={me.id} meName={me.name} meRole={me.role} settings={settings ?? { edit_closed: false } as AppSettings} onOpenCard={setOpenCard} />
          : view === "__organigrama" ? <Organigrama team={equipoVisible} cards={cards} />
          : view === "__notas" ? <Notas me={me} />
          : view === "__misarqueos" ? <MisArqueos cards={cards} ownerId={me.id} />
          : mode === "hoy" ? <MiDia ownerId={view} meId={me.id} cards={cards} team={equipoVisible} onOpenCard={setOpenCard} />
          : mode === "semana" ? <Semana cards={cards} ownerId={view} meName={me.name} onOpen={setOpenCard} />
          : mode === "obj" ? <Objetivos ownerId={view} ownerName={person?.name ?? me.name} />
          : mode === "mimes" ? <MiMes cards={cards} activity={activity} ownerId={view} onOpenCard={setOpenCard} />
          : mode === "hist" ? <HistorialMes ownerId={view} />
          : cardsLoading ? <BoardSkeleton />
          : <Board cards={cardsVista} activity={activity} ownerId={view} meId={me.id} meName={me.name} meRole={me.role} team={equipoVisible} query={query} onOpen={setOpenCard} periodo={periodoSel} vigente={vigente} />}
        </Suspense>
        </ErrorBoundary>
      </Shell>
      {openCard && <CardModal card={cardsVista.find((c) => c.id === openCard.id) ?? cards.find((c) => c.id === openCard.id) ?? openCard} cards={cards} team={equipoVisible} activity={activity} isJefe={!!isJefe} onClose={() => setOpenCard(null)} meId={me.id} meName={me.name} periodo={periodoSel} vigente={vigente} />}
      {openUser && <UserModal user={fullTeam.find((t) => t.id === openUser.id) ?? openUser} meId={me.id} team={fullTeam} cards={cards} activity={activity} onClose={() => setOpenUser(null)} />}
      {account && <AccountModal name={me.name} email={me.email} onClose={() => setAccount(false)} />}
      {novedades && <NovedadesModal onClose={() => { setPref(PREF.version, APP_VERSION); setNovedades(false); }} />}
      {consultas && <ConsultasModal meId={me.id} onClose={() => setConsultas(false)} />}
      {delegar && <DelegarModal team={equipoVisible} meId={me.id} meName={me.name} onClose={() => setDelegar(false)} />}
      <Toaster position="bottom-center" toastOptions={{ style: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" } }} />
      {cmdk && <CommandPalette me={me} team={equipoVisible} cards={cards} annos={annos}
        onNavigate={(v) => { setViewing(v); setMode("board"); setQuery(""); }} onOpenCard={setOpenCard} onClose={() => setCmdk(false)}
        onDelegar={() => setDelegar(true)} />}
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

