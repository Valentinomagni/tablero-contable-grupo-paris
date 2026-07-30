import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { COLS, type Card, type Status, type ActivityLog, type Profile, type CardPeriodo } from "../../lib/types";
import { notifsAlFinalizar, debeNotificarDesdeCliente } from "../../lib/notificaciones";
import { dueInfo, fmtDateTime } from "../../lib/metrics";
import { cn } from "../../lib/ui";
import { pushUndo } from "../../lib/undo";
import { isShared, siblingSyncPatches } from "../../lib/shared";
import { bloqueadaPorTitulos } from "../../lib/deps";
import { categoriasEnUso, pasaFiltroCategoria } from "../../lib/categorias";
import { etiquetasEnUso, pasaFiltroEtiquetas } from "../../lib/etiquetas";
import { type ModoAgrupar } from "../../lib/agrupar";
import { getPref, setPref, PREF } from "../../lib/prefs";
import { useOrganizacion, useTiemposMax, useMigraciones, useTriggerNotificaciones } from "../../hooks/useData";
import { payloadCards, tieneEtiquetas } from "../../lib/esquema";
import { escribeEnPeriodo, filaPeriodo, guardarPeriodo } from "../../lib/periodo-escritura";
import { estadoTiempo, registrarIncumplimiento } from "../../lib/tiempos";
import { textoTransicion } from "../../lib/retrabajo";
import { filtrarPorSegmento } from "../../lib/segmento";
import { Clock, ListChecks, Lock, Hourglass, Repeat, MessageSquare, Check, X, Users, Shield, Layers, Plane, Tag } from "lucide-react";
import { esCobertura } from "../../lib/vacaciones";
import { NuevaTareaModal } from "./NuevaTareaModal";
import { Carriles } from "./Carriles";
import { MenuColumna } from "./MenuColumna";
import { vistaDeColumna, parseVistas, type VistaColumna, type VistasPorColumna } from "../../lib/columna-vista";

const DOT: Record<string, string> = { pend: "bg-naranja", proc: "bg-s1", term: "bg-done" };

function DueBadge({ c }: { c: Card }) {
  const info = dueInfo(c);
  if (!info || c.status === "term") return null;
  const cls = info.days < 0 ? "bg-danger-soft text-danger"
    : info.days <= 3 ? "bg-warn-soft text-warn" : "bg-chip text-ink2";
  const txt = info.days < 0 ? `Venció ${info.lbl}` : `Vence ${info.lbl}`;
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap tnum", cls)}><Clock size={11} /> {txt}</span>;
}

function CardItem({ c, blocked, waiting, esperaTitulos = [], onOpen }: { c: Card; blocked: boolean; waiting: boolean; esperaTitulos?: string[]; onOpen: (c: Card) => void }) {
  const ck = c.checklist.length
    ? <span className="inline-flex items-center gap-1 bg-chip rounded-md px-1.5 py-0.5 tnum"><ListChecks size={11} /> {c.checklist.filter((i) => i.done).length}/{c.checklist.length}</span> : null;
  const pr = c.priority === "alta"
    ? <span className="bg-danger-soft text-danger rounded-md px-2 py-0.5 font-semibold">Alta</span> : null;
  return (
    <div onClick={() => onOpen(c)}
      className="bg-surface rounded-xl px-3.5 py-3 mb-2.5 cursor-pointer border border-line/70 transition
        hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-lg)]"
      style={{ boxShadow: "var(--shadow)" }}>
      <div className="font-semibold text-sm tracking-tight leading-snug">{c.title}</div>
      <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2 items-center">
        {c.protected && <span title="Tarea protegida por un jefe" className="inline-flex items-center gap-1 bg-chip rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Shield size={11} /> Protegida</span>}
        {isShared(c) && <span title="Tarea compartida con otras personas" className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Users size={11} /> Compartida</span>}
        {blocked && <span className="inline-flex items-center gap-1 bg-warn-soft text-warn rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Lock size={11} /> Bloqueada</span>}
        {waiting && <span className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Hourglass size={11} /> Te esperan</span>}
        {esCobertura(c).activa && <span title="Cubierta por vacaciones" className="inline-flex items-center gap-1 bg-chip text-ink2 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap"><Plane size={11} /> Cobertura</span>}
        {c.categoria && <span className="bg-chip rounded-md px-1.5 py-0.5 text-2xs whitespace-nowrap">{c.categoria}</span>}
        {/* Etiquetas (contexto: empresa/marca puntual) — chip redondeado + acento, para no
            confundirse con la categoría (tipo de trabajo, chip cuadrado neutro de arriba). */}
        {(c.etiquetas ?? []).map((et) => (
          <span key={et} className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap">
            <Tag size={10} />{et}
          </span>
        ))}
        {c.dato_control && <span className="bg-chip rounded-md px-1.5 py-0.5 text-2xs whitespace-nowrap tnum">{c.dato_control}</span>}
        {pr}<DueBadge c={c} />{c.recurring && <span title="Mensual"><Repeat size={12} /></span>}
        {(c.effort ?? 1) > 1 && <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">{c.effort} pts</span>}
        {ck}{c.comments.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {c.comments.length}</span>}
      </div>
      {blocked && esperaTitulos.length > 0 && (
        <div className="text-2xs text-warn mt-1">
          Espera: {esperaTitulos.slice(0, 2).join(", ")}{esperaTitulos.length > 2 ? ` y ${esperaTitulos.length - 2} más` : ""}
        </div>
      )}
      {c.done_at && <div className="flex items-center gap-1 text-done font-semibold text-xs mt-1.5"><Check size={12} /> Terminada el {fmtDateTime(c.done_at)}</div>}
    </div>
  );
}

export function Board({ cards, activity, ownerId, meId, meName, meRole, team = [], query = "", onOpen, periodo, vigente, cerrado = false }: {
  cards: Card[]; activity: ActivityLog[]; ownerId: string; meId?: string; meName: string; meRole?: string; team?: Profile[]; query?: string; onOpen: (c: Card) => void;
  // Períodos (Fase 2): período que se está mirando y cuál es el vigente. Cuando difieren y
  // la migración 32 está aplicada, el estado se escribe en `card_periodos` en vez de `cards`.
  // Opcionales: sin ellos (o iguales) el Board escribe en `cards` como siempre.
  periodo?: string; vigente?: string;
  // Fase 3: el mes está cerrado → sólo lectura. Se puede consultar, no editar.
  cerrado?: boolean;
}) {
  const qc = useQueryClient();
  const org = useOrganizacion();
  const tiemposConfig = useTiemposMax();
  // Esquema de la base (ALTA 1): si la migración 29 no está aplicada, el patch no puede
  // mencionar proc_at o el update entero falla con PGRST204 y el drag & drop se rompe.
  const { data: migracionesAplicadas } = useMigraciones();
  // Task 11: con el trigger de la migración 30 activo, la notificación de finalización la
  // genera la base. Si el cliente además la insertara, el aviso saldría DUPLICADO.
  const { data: triggerNotifsActivo } = useTriggerNotificaciones();
  // ¿Este movimiento debe escribir en `card_periodos` (mes NO vigente) en vez de `cards`?
  const esEscrituraPeriodo = (cardType: Card["card_type"]) =>
    periodo !== undefined && vigente !== undefined &&
    escribeEnPeriodo(migracionesAplicadas, periodo, vigente, cardType);
  const q = query.trim().toLowerCase();
  const matches = (c: Card) => !q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
  // filtro por categoría (spec 21 item 11): null = todas; "" = sin categoría
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  // filtro por etiquetas (spec 28, fase D, Task 5): AND — la card debe tener TODAS las tildadas
  const [etFiltro, setEtFiltro] = useState<string[]>([]);
  // segmentación por marca/sucursal (spec 26 item 1): solo jefe/encargado, si hay marcas configuradas
  const esGestor = meRole === "jefe" || meRole === "encargado";
  const [marcaFiltro, setMarcaFiltro] = useState<string | null>(null);
  const [sucursalFiltro, setSucursalFiltro] = useState<string | null>(null);
  const mostrarSegmento = esGestor && org.marcas.length > 0;
  const cardsSeg = mostrarSegmento
    ? filtrarPorSegmento(cards, team, { marca: marcaFiltro, sucursal: sucursalFiltro })
    : cards;
  // agrupar por categoría/prioridad/marca con colapso apilado (spec 21 item 13 / spec 26)
  const MODOS_AGRUPAR: ModoAgrupar[] = ["ninguno", "categoria", "prioridad", "marca"];
  const [agruparModo, setAgruparModoState] = useState<ModoAgrupar>(() => {
    const v = getPref(PREF.agruparModo);
    return (v && MODOS_AGRUPAR.includes(v as ModoAgrupar)) ? (v as ModoAgrupar) : "ninguno";
  });
  const setAgruparModo = (v: ModoAgrupar) => { setAgruparModoState(v); setPref(PREF.agruparModo, v); };
  // Orden y agrupación POR COLUMNA, independientes entre sí (spec 28-correcciones, item 7).
  // Se relee cuando cambia el owner: cada tablero guarda sus propias preferencias.
  const [vistas, setVistas] = useState<VistasPorColumna>(() => parseVistas(getPref(PREF.vistasColumna(ownerId))));
  useEffect(() => { setVistas(parseVistas(getPref(PREF.vistasColumna(ownerId)))); }, [ownerId]);
  const setVistaCol = (k: Status, v: VistaColumna) => {
    setVistas((prev) => {
      const next = { ...prev, [k]: v };
      setPref(PREF.vistasColumna(ownerId), JSON.stringify(next));
      return next;
    });
  };
  const visibles = cardsSeg.filter((c) => c.owner === ownerId && matches(c));
  const catsUsadas = categoriasEnUso(visibles);
  const hayMezcla = catsUsadas.length > 0 && visibles.some((c) => !c.categoria);
  // Sin la migración 31 no hay columna `etiquetas`: ninguna card puede tenerlas y el
  // filtro no debe ofrecerse (review MEDIA 1 — mismo gate que el editor en MetaSection).
  const etsUsadas = tieneEtiquetas(migracionesAplicadas) ? etiquetasEnUso(visibles) : [];
  const pasaCat = (c: Card) => pasaFiltroCategoria(c, catFiltro) && pasaFiltroEtiquetas(c, etFiltro);
  const mine = visibles.filter((c) => c.card_type !== "operativa" && pasaCat(c));
  const opers = visibles.filter((c) => c.card_type === "operativa" && pasaCat(c));
  const byId = (id: string) => cards.find((x) => x.id === id);
  const isBlocked = (c: Card) => c.status !== "term" && (c.deps ?? []).some((id) => (byId(id)?.status ?? "term") !== "term");
  const dependents = (id: string) => cards.filter((x) => (x.deps ?? []).includes(id) && x.status !== "term");

  const move = useMutation({
    mutationFn: async ({ id, status, cardPrev }: { id: string; status: Status; cardPrev: Card }) => {
      // La card SIEMPRE viene de las variables de la mutación (capturada en onDrop antes del
      // optimismo), nunca del closure de `cards`: si la mutación se pausa por falta de red
      // (networkMode "online" por defecto) y corre recién al reconectar, para entonces `cards`
      // ya refleja el estado optimista y byId(id) devolvería el status NUEVO como si fuera el
      // previo — pushUndo guardaría un no-op y done_at/proc_at se calcularían mal.
      // Mes cerrado = sólo lectura (Fase 3). El corte va acá, en la mutación, y no sólo en
      // la UI: es lo único que cubre el drag & drop, los atajos y cualquier camino futuro.
      if (cerrado) throw new Error("Este mes está cerrado. Para modificarlo, reabrilo desde Cierre.");
      const c = cardPrev;
      const now = new Date().toISOString();
      const patch: Partial<Card> = { status };
      if (status === "term") patch.done_at = now;
      else if (c.status === "term") patch.done_at = null;
      // Sellar proc_at (spec 28, Task 4): al entrar a "en proceso" por primera vez se marca el inicio del SLA;
      // al volver a "pendiente" se limpia (arranca de nuevo la próxima vez que entre a proceso).
      if (status === "proc" && !c.proc_at) patch.proc_at = now;
      else if (status === "pend") patch.proc_at = null;
      let hist = [...(c.history ?? []), { who: meName, at: now, txt: textoTransicion(c.status, status, status === "term" ? "Marcó terminada" : "Movió la tarea") }];
      if (status === "term") {
        const est = estadoTiempo({ ...c, ...patch }, tiemposConfig, now);
        hist = registrarIncumplimiento(hist, est, meName, now, patch.proc_at ?? c.proc_at ?? null);
      }
      // Mes NO vigente (Fase 2): el estado va a `card_periodos`, independiente. No toca
      // `cards`, ni sincroniza hermanas, ni notifica finalización — eso es del flujo del
      // mes en curso. El upsert crea la fila del mes si es la primera vez (materializa el
      // mes adelantado). No hay pushUndo: deshacer opera sobre `cards` (Fase 3 lo cubrirá).
      if (esEscrituraPeriodo(c.card_type)) {
        await guardarPeriodo(filaPeriodo({ ...c, ...patch, history: hist }, periodo!, { ...patch, history: hist }));
        return;
      }
      // Se calcula UNA vez y se usa para el update y para la pila de deshacer: si el
      // esquema es viejo, deshacer tampoco debe intentar reescribir proc_at.
      const body = payloadCards({ ...patch, history: hist }, migracionesAplicadas);
      pushUndo(c, body);
      const { error } = await supabase.from("cards").update(body).eq("id", id);
      if (error) throw error;
      // tareas compartidas: sincroniza las hermanas (best-effort; el trigger de la DB cubre RLS cruzada)
      for (const s of siblingSyncPatches(c, cards, status, patch.done_at ?? new Date().toISOString())) {
        await supabase.from("cards").update(s.patch).eq("id", s.id);
      }
      // Finalización con impacto → notif al encargado/jefe (spec #8). Best-effort:
      // si la tabla notifications no existe aún, la tarea se termina igual.
      // Con el trigger de la base activo esto NO corre: lo hace el servidor (Task 11).
      if (status === "term" && meId && debeNotificarDesdeCliente(triggerNotifsActivo)) {
        try {
          const notifs = notifsAlFinalizar({
            card: c, actorId: meId, actorName: meName,
            managerId: team.find((u) => u.id === c.owner)?.manager_id,
          });
          if (notifs.length) await supabase.from("notifications").insert(notifs);
        } catch { /* secundario: se ignora */ }
      }
    },
    // Optimista (spec 28, Task 12): la card cambia de columna al instante; el resto
    // (proc_at, history, notifs, siblings) lo resuelve el servidor y llega con la
    // invalidación de onSettled. Cancelamos antes de leer para que un refetch en
    // vuelo no pise el snapshot ni, después, el propio optimismo.
    onMutate: async ({ id, status }) => {
      const cc = cards.find((x) => x.id === id);
      // Mes NO vigente: optimismo sobre ["card_periodos"] (lo que alimenta el merge del
      // board de ese mes), no sobre ["cards"] — así el mes vigente no parpadea.
      if (cc && esEscrituraPeriodo(cc.card_type)) {
        await qc.cancelQueries({ queryKey: ["card_periodos"] });
        const previousPeriodos = qc.getQueryData<CardPeriodo[]>(["card_periodos"]);
        qc.setQueryData<CardPeriodo[]>(["card_periodos"], (old) => {
          const arr = old ? [...old] : [];
          const i = arr.findIndex((p) => p.card_id === id && p.periodo === periodo);
          if (i >= 0) { arr[i] = { ...arr[i], status }; return arr; }
          arr.push({
            id: `optim-${id}-${periodo}`, card_id: id, owner: cc.owner, periodo: periodo!, status,
            checklist: cc.checklist ?? [], comments: cc.comments ?? [], history: cc.history ?? [],
            done_at: cc.done_at ?? null, proc_at: cc.proc_at ?? null, due_date: cc.due_date ?? null,
            created_at: new Date().toISOString(),
          });
          return arr;
        });
        return { previousPeriodos };
      }
      await qc.cancelQueries({ queryKey: ["cards"] });
      const previous = qc.getQueryData<Card[]>(["cards"]);
      qc.setQueryData<Card[]>(["cards"], (old) => old?.map((c) => (c.id === id ? { ...c, status } : c)) ?? old);
      return { previous };
    },
    // Rollback como patch de la card fallida, no como reemplazo del snapshot completo: si dos
    // drags se solapan y uno falla, restaurar todo el array pisaría el optimismo del otro
    // (el invalidate de onSettled lo autosana, pero el flash es visible e innecesario).
    onError: (_err, { id }, ctx) => {
      if (ctx?.previousPeriodos) { qc.setQueryData(["card_periodos"], ctx.previousPeriodos); return; }
      const prevCard = ctx?.previous?.find((c) => c.id === id);
      if (prevCard) qc.setQueryData<Card[]>(["cards"], (old) => old?.map((c) => (c.id === id ? { ...c, status: prevCard.status } : c)) ?? old);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["card_periodos"] });
    },
  });

  const add = useMutation({
    mutationFn: async ({ status, title, oper }: { status: Status; title: string; oper?: boolean }) => {
      const row = {
        owner: ownerId, title,
        status: oper ? "proc" : status,
        card_type: oper ? "operativa" : "normal",
        history: [{ who: meName, at: new Date().toISOString(), txt: oper ? "Creó operativa" : "Creó la tarea" }],
      };
      const { error } = await supabase.from("cards").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });

  const registrar = useMutation({
    mutationFn: async ({ cardId, qty }: { cardId: string; qty: number }) => {
      const { error } = await supabase.from("activity_log").insert({ card_id: cardId, owner: ownerId, who_name: meName, qty, note: "" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });

  // formularios inline (adiós prompt() nativo)
  const [adding, setAdding] = useState<string | null>(null); // columna en modo alta ("oper" = operativa)
  const [newTitle, setNewTitle] = useState("");
  const [regFor, setRegFor] = useState<string | null>(null); // card operativa en modo registro
  const [regQty, setRegQty] = useState("1");
  const [creando, setCreando] = useState(false); // modal formal de alta (columna Pendiente)

  const confirmAdd = () => {
    const t = newTitle.trim();
    if (t) add.mutate(adding === "oper" ? { status: "proc", title: t, oper: true } : { status: adding as Status, title: t });
    setAdding(null); setNewTitle("");
  };
  const confirmReg = (cardId: string) => {
    registrar.mutate({ cardId, qty: Math.max(1, Math.round(Number(regQty) || 1)) });
    setRegFor(null); setRegQty("1");
  };
  const addInline = (col: string, placeholder: string) =>
    adding === col ? (
      <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") { setAdding(null); setNewTitle(""); } }}
        onBlur={() => { setAdding(null); setNewTitle(""); }}
        className="w-full bg-surface border border-accent rounded-lg px-2.5 py-2 text-sm outline-none" />
    ) : (
      <button onClick={() => { setAdding(col); setNewTitle(""); }}
        className="w-full border border-dashed border-line rounded-lg py-2 text-sm text-ink2 hover:text-accent hover:border-accent transition">
        + Añadir {col === "oper" ? "operativa" : "tarea"}</button>
    );

  // Una sola forma de dibujar una card, la use la columna plana o un carril:
  // así el arrastrar (setData con el id) es idéntico en los dos modos.
  const renderCard = (c: Card) => (
    <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>
      <CardItem c={c} blocked={isBlocked(c)} waiting={c.status !== "term" && dependents(c.id).length > 0} esperaTitulos={bloqueadaPorTitulos(c, cards)} onOpen={onOpen} />
    </div>
  );

  const hoyStr = new Date().toDateString();
  const colBg = { background: "color-mix(in srgb,var(--surface2) 55%,var(--bg))" };

  const chipCat = (lbl: string, val: string | null) => {
    const activo = catFiltro === val;
    return (
      <button key={lbl} onClick={() => setCatFiltro(activo ? null : val)}
        className={cn("border rounded-full px-3 py-1 text-xs transition",
          activo ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line bg-surface2 text-ink2 hover:border-accent/40")}>
        {lbl}</button>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex gap-1.5 flex-wrap items-center px-6 pb-3">
        <label title="Agrupar en carriles que cruzan las tres columnas"
          className={cn("inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition",
            agruparModo !== "ninguno" ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line bg-surface2 text-ink2 hover:border-accent/40")}>
          <Layers size={12} />
          <select value={agruparModo} onChange={(e) => setAgruparModo(e.target.value as ModoAgrupar)}
            className="bg-transparent outline-none cursor-pointer">
            <option value="ninguno">Sin agrupar</option>
            <option value="categoria">Categoría</option>
            <option value="prioridad">Prioridad</option>
            <option value="marca">Marca</option>
          </select>
        </label>
        {catsUsadas.length > 0 && (
          <>
            <span className="w-px h-4 bg-line mx-1" />
            <button onClick={() => setCatFiltro(null)}
              className={cn("border rounded-full px-3 py-1 text-xs transition",
                catFiltro === null ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line bg-surface2 text-ink2 hover:border-accent/40")}>
              Todas</button>
            {catsUsadas.map((cat) => chipCat(cat, cat))}
            {hayMezcla && chipCat("Sin categoría", "")}
          </>
        )}
        {etsUsadas.length > 0 && (
          <>
            <span className="w-px h-4 bg-line mx-1" />
            {etsUsadas.map((et) => {
              const activo = etFiltro.some((x) => x.toLowerCase() === et.toLowerCase());
              return (
                <button key={et} title="Filtrar por etiqueta (se pueden combinar varias)"
                  onClick={() => setEtFiltro((fs) => activo ? fs.filter((x) => x.toLowerCase() !== et.toLowerCase()) : [...fs, et])}
                  className={cn("inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs transition",
                    activo ? "bg-accent-soft border-accent text-accent font-semibold" : "border-line bg-surface2 text-ink2 hover:border-accent/40")}>
                  <Tag size={11} />{et}</button>
              );
            })}
            {etFiltro.length > 0 && (
              <button onClick={() => setEtFiltro([])} className="border border-line bg-surface2 rounded-full px-3 py-1 text-xs text-ink2 hover:border-accent/40">
                Limpiar etiquetas</button>
            )}
          </>
        )}
        {mostrarSegmento && (
          <>
            <span className="w-px h-4 bg-line mx-1" />
            <select value={marcaFiltro ?? ""} onChange={(e) => { setMarcaFiltro(e.target.value || null); setSucursalFiltro(null); }}
              className="border border-line bg-surface2 text-ink2 rounded-full px-3 py-1 text-xs outline-none">
              <option value="">Todas las marcas</option>
              {org.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {org.sucursales.length > 0 && (
              <select value={sucursalFiltro ?? ""} onChange={(e) => setSucursalFiltro(e.target.value || null)}
                className="border border-line bg-surface2 text-ink2 rounded-full px-3 py-1 text-xs outline-none">
                <option value="">Todas las sucursales</option>
                {org.sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </>
        )}
      </div>
    {/* Mes cerrado: se avisa POR QUÉ no se puede editar y CÓMO revertirlo. Un tablero que no
        responde sin explicar por qué se lee como que la app está rota. */}
    {cerrado && (
      <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3.5 py-2.5 text-sm text-ink2">
        <Lock size={14} className="shrink-0" />
        <span>Este mes está cerrado: se puede consultar, no editar. Para modificarlo, reabrilo desde <b className="text-ink font-semibold">Cierre</b>.</span>
      </div>
    )}
    <div className="flex gap-5 items-start px-6 pb-10 overflow-x-auto flex-1">
      {/* Modo "ninguno": tres columnas planas, exactamente como siempre (ruta por defecto). */}
      {agruparModo === "ninguno" && COLS.map(([k, lbl]) => {
        const deLaColumna = mine.filter((c) => c.status === k);
        // Orden y agrupación PROPIOS de esta columna (item 7). Con la vista por defecto
        // devuelve un único bloque sin cabecera → idéntico al tablero de siempre.
        const bloques = vistaDeColumna(deLaColumna, vistas[k], { profiles: team });
        return (
        <div key={k}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-accent"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-accent")}
          onDrop={(e) => { e.currentTarget.classList.remove("ring-2", "ring-accent"); const id = e.dataTransfer.getData("text/plain"); const cardPrev = id ? byId(id) : undefined; if (id && cardPrev) move.mutate({ id, status: k, cardPrev }); }}
          className="min-w-[290px] w-[290px] shrink-0 rounded-2xl p-3 border border-line/60" style={colBg}>
          <h2 className="text-xs uppercase tracking-wider text-ink2 mx-1.5 mt-1 mb-2.5 flex items-center gap-2 font-semibold">
            <i className={cn("w-2 h-2 rounded-full", DOT[k])} />{lbl}
            <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{deLaColumna.length}</span>
            <MenuColumna vista={vistas[k]} etiqueta={lbl} onCambiar={(v) => setVistaCol(k, v)} />
          </h2>
          {bloques.map((b) => (
            <div key={b.grupo || "__todo"}>
              {b.grupo && (
                <div className="mx-1.5 mt-1 mb-1.5 text-2xs font-semibold text-ink2 flex items-center gap-2">
                  <span className="truncate">{b.grupo}</span>
                  <span className="bg-chip rounded-full px-1.5 py-0.5 tnum text-2xs">{b.cards.length}</span>
                </div>
              )}
              {b.cards.map(renderCard)}
            </div>
          ))}
          {deLaColumna.length === 0 && <div className="mb-2"><EmptyState title="Sin tareas acá." /></div>}
          {/* Pendiente abre el flujo formal (spec 21 item 2); "En proceso" conserva el atajo inline. */}
          {k === "pend" && (
            <button onClick={() => setCreando(true)}
              className="w-full border border-dashed border-line rounded-lg py-2 text-sm text-ink2 hover:text-accent hover:border-accent transition">
              + Añadir tarea</button>
          )}
          {k === "proc" && addInline(k, "Título y Enter…")}
        </div>
        );
      })}

      {/* Agrupado: carriles horizontales por grupo que atraviesan las tres columnas
          de estado. La card cambia de columna sin salir de su carril. */}
      {agruparModo !== "ninguno" && (
        <div className="flex flex-col gap-3 shrink-0">
          <Carriles cards={mine} modo={agruparModo} ownerId={ownerId} profiles={team} columnas={COLS}
            renderCard={renderCard} onDropCard={(id, status) => { const cardPrev = byId(id); if (cardPrev) move.mutate({ id, status, cardPrev }); }} />
          {mine.length === 0 && <EmptyState title="Sin tareas acá." />}
          <button onClick={() => setCreando(true)}
            className="w-[290px] border border-dashed border-line rounded-lg py-2 text-sm text-ink2 hover:text-accent hover:border-accent transition">
            + Añadir tarea</button>
          {/* Atajo inline de "En proceso" (spec 21 item 2), restaurado también en modo carriles:
              la card nace sin categoría y cae en "Sin categoría", coherente con el resto. */}
          <div className="w-[290px]">{addInline("proc", "Título y Enter…")}</div>
        </div>
      )}

      <div className="min-w-[290px] w-[290px] shrink-0 rounded-2xl p-3 border border-dashed border-line/60" style={colBg}>
        <h2 className="text-xs uppercase tracking-wider text-ink2 mx-1.5 mt-1 mb-2.5 flex items-center gap-2 font-semibold">
          <i className="w-2 h-2 rounded-full bg-accent" />Operativas · a demanda
          <span className="ml-auto bg-chip rounded-full px-2 py-0.5 tnum">{opers.length}</span>
        </h2>
        {opers.map((c) => {
          const regs = activity.filter((a) => a.card_id === c.id);
          const hoy = regs.filter((a) => new Date(a.at).toDateString() === hoyStr).reduce((s, a) => s + a.qty, 0);
          const sem = regs.filter((a) => Date.now() - new Date(a.at).getTime() < 7 * 86400000).reduce((s, a) => s + a.qty, 0);
          return (
            <div key={c.id} onClick={() => onOpen(c)} className="bg-surface rounded-lg p-3 mb-2 cursor-pointer border border-transparent hover:border-accent/30 transition" style={{ boxShadow: "var(--ring),var(--shadow)" }}>
              <div className="font-semibold text-sm tracking-tight">{c.title}</div>
              <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2">
                <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">hoy: {hoy}</span>
                <span className="bg-chip rounded-md px-1.5 py-0.5 tnum">7 días: {sem}</span>
              </div>
              {regFor === c.id ? (
                <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus type="number" min={1} value={regQty} onChange={(e) => setRegQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmReg(c.id); if (e.key === "Escape") setRegFor(null); }}
                    className="w-16 bg-surface border border-accent rounded-lg px-2 py-1 text-xs outline-none tnum" />
                  <button onClick={() => confirmReg(c.id)} className="flex-1 bg-accent text-white rounded-lg py-1 text-xs font-semibold">Registrar</button>
                  <button onClick={() => setRegFor(null)} className="border border-line bg-surface2 rounded-lg px-1.5"><X size={11} /></button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setRegFor(c.id); setRegQty("1"); }}
                  className="w-full mt-2 border border-line bg-surface2 rounded-lg py-1 text-xs">+ Registrar</button>
              )}
            </div>
          );
        })}
        {opers.length === 0 && <p className="text-ink2 text-sm px-2 pb-2">Pagos, trámites y gestiones a demanda: no se cierran, se registran.</p>}
        {addInline("oper", "Ej: Pagos a proveedores…")}
      </div>
      {creando && <NuevaTareaModal ownerId={ownerId} meName={meName} cards={cards.filter((c) => c.owner === ownerId)} onClose={() => setCreando(false)} />}
    </div>
    </div>
  );
}
