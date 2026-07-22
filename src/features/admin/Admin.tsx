import { useState } from "react";
import { Archive, Download, UserPlus, ArrowRightLeft, Plus, X, Trash2, CalendarPlus, ShieldCheck, AlertTriangle, HelpCircle, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { mesLabel } from "../../lib/archivo";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL } from "../../lib/supabase";
import type { Card, Profile, Role, AppSettings, PlantillaTareas } from "../../lib/types";
import { filasDePlantilla } from "../../lib/plantillas";
import { generarVencimientosMes } from "../../lib/fiscal";
import { MESES } from "../../lib/cierre";
import { useAnnouncements } from "../../hooks/useData";
import { PlantillaCierre } from "./PlantillaCierre";
import { ReasignarModal } from "./ReasignarModal";
import { Huerfanas } from "./Huerfanas";
import { equipoDe } from "../../lib/jerarquia";
import { personasVisibles } from "../../lib/visibilidad";
import { Avatar } from "../../lib/ui";
import { useSettings, useMigraciones, useTiemposMax } from "../../hooks/useData";
import { estadoMigraciones } from "../../lib/migraciones";
import { enLinea, textoUltimaConexion } from "../../lib/presencia";
import { BandejaConsultas } from "../consultas/BandejaConsultas";

// chip de estado de migraciones (spec 27, T2): verde al día / ámbar faltan / gris desconocido
function MigracionesChip() {
  const { data: aplicadas } = useMigraciones();
  const { ok, faltan, desconocido } = estadoMigraciones(aplicadas ?? null);
  if (desconocido) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-chip text-ink2 rounded-full px-3 py-1 text-[13px] font-medium mb-2.5">
        <HelpCircle size={14} /> Estado de la base desconocido — corré la migración 28
      </span>
    );
  }
  if (!ok) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-warn-soft text-warn rounded-full px-3 py-1 text-[13px] font-medium mb-2.5">
        <AlertTriangle size={14} /> Faltan migraciones: {faltan.join(", ")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-accent-soft text-done rounded-full px-3 py-1 text-[13px] font-medium mb-2.5">
      <ShieldCheck size={14} /> Base de datos al día
    </span>
  );
}

export function Admin({ team, cards, me, meName, onOpenUser }: { team: Profile[]; cards: Card[]; me: Profile; meName: string; onOpenUser: (u: Profile) => void }) {
  const qc = useQueryClient();
  const esEncargado = me.role === "encargado";
  // Encargado: solo su equipo (subordinados) + reasignar. Sin permisos/parámetros/respaldo/crear-usuario.
  const equipo = esEncargado ? equipoDe(me.id, team) : team;
  // El roster (tabla de abajo) sí muestra al usuario oculto, con chip, para poder administrarlo.
  // Todo lo demás (selects de responsable, reasignar, huérfanas, plantilla de cierre) lo excluye.
  const equipoVisible = personasVisibles(equipo);
  const [reasignar, setReasignar] = useState(false);
  const { data: settings = { edit_closed: false } } = useSettings();
  const tiemposMax = useTiemposMax();
  const [tmCat, setTmCat] = useState("");
  const [tmHoras, setTmHoras] = useState("");
  const [tmMsg, setTmMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [permMsg, setPermMsg] = useState("");
  const [parBoardName, setParBoardName] = useState<string | null>(null);
  const [parWarn, setParWarn] = useState<string | null>(null);
  const [parStuck, setParStuck] = useState<string | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  // Plantillas de tareas (propuesta P6): responsable por defecto elegido al generar y borrador de creación.
  const [plOwner, setPlOwner] = useState<Record<number, string>>({});
  const [plGenBusy, setPlGenBusy] = useState<number | null>(null);
  const [plDraft, setPlDraft] = useState<PlantillaTareas>({ nombre: "", categoria: "", items: [] });
  const [plItem, setPlItem] = useState<{ titulo: string; owner: string; effort: 1 | 2 | 3 | 5; priority: "alta" | "media" | "baja" }>({ titulo: "", owner: "", effort: 1, priority: "media" });
  // Archivo mensual (spec 21 item 9): opciones = mes actual y anterior (YYYY-MM)
  const hoy = new Date();
  const mesFmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesesArchivo = [mesFmt(hoy), mesFmt(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))];
  const [archMes, setArchMes] = useState(mesesArchivo[0]);
  const [archBusy, setArchBusy] = useState(false);
  const [nu, setNu] = useState({ email: "", username: "", name: "", role: "empleado" as Role, puesto: "", pass: "" });
  const [nuBusy, setNuBusy] = useState(false);
  const [nuMsg, setNuMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  // Calendario fiscal autogenerado (spec 28, E3 Task 2): jefe genera con vista previa,
  // nunca inserta a ciegas — se muestra qué se va a crear antes de confirmar.
  const { data: annos = [] } = useAnnouncements();
  const [fiscalPreview, setFiscalPreview] = useState<{ title: string; detail: string; due_date: string }[] | null>(null);
  const [fiscalBusy, setFiscalBusy] = useState(false);
  const hoyFiscal = new Date();
  const fiscalYear = hoyFiscal.getFullYear();
  const fiscalMonth = hoyFiscal.getMonth() + 1;

  async function saveSettings(next: AppSettings, okTxt: string) {
    const { error } = await supabase.from("settings").update({ value: next }).eq("key", "permissions");
    setPermMsg(error ? "No se pudo guardar: " + error.message : okTxt);
    if (!error) qc.invalidateQueries({ queryKey: ["settings"] });
    setTimeout(() => setPermMsg(""), 3000);
  }

  const plantillas = settings.plantillas ?? [];

  // Tiempo máximo por categoría (settings key='tiempos_max', spec 28 Task 4). Patrón idéntico al de plantillas:
  // se lee con un hook propio y se guarda con upsert directo a la fila de esa key.
  async function saveTiemposMax(next: Record<string, number>, okTxt: string) {
    const { error } = await supabase.from("settings").upsert({ key: "tiempos_max", value: next }, { onConflict: "key" });
    setTmMsg(error ? "No se pudo guardar: " + error.message : okTxt);
    if (!error) qc.invalidateQueries({ queryKey: ["tiempos_max"] });
    setTimeout(() => setTmMsg(""), 3000);
  }

  function agregarTiempoMax() {
    const cat = tmCat.trim();
    const horas = Number(tmHoras);
    if (!cat) { toast.error("Elegí una categoría."); return; }
    if (!horas || horas <= 0) { toast.error("Ingresá un número de horas mayor a 0."); return; }
    saveTiemposMax({ ...tiemposMax, [cat]: horas }, "Tiempo máximo guardado");
    setTmCat(""); setTmHoras("");
  }

  function eliminarTiempoMax(cat: string) {
    const next = { ...tiemposMax };
    delete next[cat];
    saveTiemposMax(next, "Tiempo máximo eliminado");
  }

  async function generarPlantilla(pl: PlantillaTareas, idx: number) {
    const porDefecto = plOwner[idx] ?? "";
    // Si algún ítem no tiene owner propio, necesitamos un responsable por defecto.
    if (pl.items.some((it) => !it.owner) && !porDefecto) { toast.error("Elegí un responsable por defecto para los ítems sin responsable."); return; }
    if (!pl.items.length) { toast.error("La plantilla no tiene ítems."); return; }
    setPlGenBusy(idx);
    const filas = filasDePlantilla(pl, meName, new Date().toISOString(), porDefecto);
    const { error } = await supabase.from("cards").insert(filas);
    setPlGenBusy(null);
    if (error) { toast.error("No se pudo generar: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["cards"] });
    toast.success(`${filas.length} tarea(s) generada(s) desde "${pl.nombre}"`);
  }

  function armarPreviewFiscal() {
    const props = generarVencimientosMes(fiscalYear, fiscalMonth, annos);
    if (!props.length) { toast(`Los vencimientos fiscales de ${MESES[fiscalMonth - 1]} ya están generados.`); setFiscalPreview(null); return; }
    setFiscalPreview(props);
  }

  async function confirmarVencimientosFiscales() {
    if (!fiscalPreview || !fiscalPreview.length) return;
    setFiscalBusy(true);
    const { error } = await supabase.from("announcements").insert(fiscalPreview.map((p) => ({
      kind: "vencimiento" as const, title: p.title, detail: p.detail, due_date: p.due_date,
      created_by: meName, owner_id: me.id, visible_to: [],
    })));
    setFiscalBusy(false);
    if (error) { toast.error("No se pudo generar: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["announcements"] });
    toast.success(`${fiscalPreview.length} vencimiento(s) fiscal(es) generado(s)`);
    setFiscalPreview(null);
  }

  function eliminarPlantilla(idx: number) {
    saveSettings({ ...settings, plantillas: plantillas.filter((_, i) => i !== idx) }, "Plantilla eliminada");
  }

  function agregarItem() {
    if (!plItem.titulo.trim()) { toast.error("El ítem necesita un título."); return; }
    setPlDraft({ ...plDraft, items: [...plDraft.items, { titulo: plItem.titulo.trim(), ...(plItem.owner ? { owner: plItem.owner } : {}), effort: plItem.effort, priority: plItem.priority }] });
    setPlItem({ titulo: "", owner: "", effort: 1, priority: "media" });
  }

  function guardarPlantilla() {
    if (!plDraft.nombre.trim()) { toast.error("Ponele un nombre a la plantilla."); return; }
    if (!plDraft.categoria) { toast.error("Elegí una categoría."); return; }
    if (!plDraft.items.length) { toast.error("Agregá al menos un ítem."); return; }
    saveSettings({ ...settings, plantillas: [...plantillas, { ...plDraft, nombre: plDraft.nombre.trim() }] }, "Plantilla guardada");
    setPlDraft({ nombre: "", categoria: "", items: [] });
    setPlItem({ titulo: "", owner: "", effort: 1, priority: "media" });
  }

  async function crearUsuario() {
    if (!nu.name.trim()) { setNuMsg({ ok: false, txt: "El nombre es obligatorio" }); return; }
    setNuMsg(null); setNuBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    let out: { ok?: boolean; error?: string };
    try {
      const r = await fetch(SUPABASE_URL + "/functions/v1/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token },
        body: JSON.stringify({ email: nu.email.trim(), username: nu.username.trim(), password: nu.pass, name: nu.name.trim(), role: nu.role, puesto: nu.puesto.trim() }),
      });
      out = await r.json();
    } catch {
      out = { error: "No se pudo contactar la función crear-usuario. ¿Está desplegada en Supabase?" };
    }
    setNuBusy(false);
    setNuMsg(out.ok ? { ok: true, txt: "Usuario creado. Ya puede ingresar." } : { ok: false, txt: "" + (out.error ?? "Error") });
    if (out.ok) { qc.invalidateQueries({ queryKey: ["team"] }); setNu({ email: "", username: "", name: "", role: "empleado", puesto: "", pass: "" }); }
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";

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
    setBusy(false); setMsg("Backup descargado. Guardalo en el Drive.");
  }

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      <div>{!esEncargado && <MigracionesChip />}</div>
      <div className="flex items-center gap-3 mb-2.5">
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink m-0">
          {esEncargado ? "Mi equipo — clic en una persona para ver su ficha" : "Equipo — clic en una persona para editar su ficha"}
        </h2>
        {esEncargado && equipo.length > 0 && (
          <button onClick={() => setReasignar(true)}
            className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-[13px] font-semibold ml-auto">
            <ArrowRightLeft size={14} /> Reasignar tareas</button>
        )}
      </div>
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-ink2">
            <th className="text-left px-4 py-2.5">Persona</th><th className="text-left px-4 py-2.5">Rol</th><th className="text-left px-4 py-2.5">Puesto</th><th className="text-left px-4 py-2.5">Marca</th><th className="text-left px-4 py-2.5">Sucursal</th>
          </tr></thead>
          <tbody>
            {equipo.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-ink2 text-[13px]">Todavía no tenés personas asignadas a tu equipo.</td></tr>
            )}
            {equipo.map((u) => {
              const ahora = new Date().toISOString();
              const online = enLinea(u.last_seen, ahora);
              return (
              <tr key={u.id} onClick={() => onOpenUser(u)} className="border-t border-line cursor-pointer hover:bg-surface2">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={u.name} size={24} /><div><div className="flex items-center gap-1.5"><b>{u.name}</b>{u.oculto === true && (
                  <span className="inline-flex items-center gap-1 bg-chip text-ink2 rounded-full px-2 py-0.5 text-[11px] font-medium"><EyeOff size={11} /> Oculto</span>
                )}</div><div className="flex items-center gap-2"><span className="text-ink2 text-xs">{u.username ? "@" + u.username : "sin usuario"}</span><span className="flex items-center gap-1 text-[11px] text-ink2">{online && <span className="w-2 h-2 rounded-full bg-done" />}{textoUltimaConexion(u.last_seen, ahora)}</span></div></div></div></td>
                <td className="px-4 py-2.5 capitalize">{u.role}</td>
                <td className="px-4 py-2.5 text-ink2">{u.puesto || "—"}</td>
                <td className="px-4 py-2.5 text-[13px]">{u.marca ?? "—"}</td>
                <td className="px-4 py-2.5 text-[13px]">{u.sucursal ?? "—"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!esEncargado && <>
      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Consultas del equipo</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <BandejaConsultas team={team} />
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Crear usuario nuevo</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <input placeholder="usuario (ej: Vmagni)" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} className={inputCls + " w-[160px]"} />
        <input type="email" placeholder="correo corporativo (acceso/recuperación)" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className={inputCls + " w-[200px]"} />
        <input placeholder="nombre y apellido" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className={inputCls + " w-[180px]"} />
        <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })} className={inputCls}>
          <option value="empleado">empleado</option><option value="encargado">encargado</option><option value="jefe">jefe</option>
        </select>
        <input placeholder="puesto (ej: Analista contable)" value={nu.puesto} onChange={(e) => setNu({ ...nu, puesto: e.target.value })} className={inputCls + " w-[200px]"} />
        <input placeholder="contraseña inicial (mín. 8)" value={nu.pass} onChange={(e) => setNu({ ...nu, pass: e.target.value })} className={inputCls + " w-[180px]"} />
        <button onClick={crearUsuario} disabled={nuBusy || !nu.email.trim() || !nu.name.trim() || nu.pass.length < 8}
          className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
          <UserPlus size={15} /> {nuBusy ? "Creando…" : "Crear usuario"}</button>
        {nuMsg && <p className={"w-full text-sm m-0 " + (nuMsg.ok ? "text-done" : "text-danger")}>{nuMsg.txt}</p>}
      </div>

      <Huerfanas team={team} cards={cards} />

      <PlantillaCierre team={equipoVisible} />

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Calendario fiscal</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <p className="text-ink2 text-[13px] mt-0 mb-3">
          Genera en el Tablón los vencimientos impositivos de {MESES[fiscalMonth - 1]} ({fiscalYear}): IVA, F931, IIBB y SICORE.
          Son fechas de referencia para gestión interna, no la fecha exacta por terminación de CUIT.
        </p>
        {!fiscalPreview && (
          <button onClick={armarPreviewFiscal}
            className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold">
            <CalendarPlus size={15} /> Generar vencimientos fiscales del mes</button>
        )}
        {fiscalPreview && (
          <div>
            <p className="text-ink text-[13px] font-semibold mt-0 mb-2">Se van a crear {fiscalPreview.length} vencimiento(s):</p>
            <ul className="mb-3 pl-0 list-none grid gap-1.5">
              {fiscalPreview.map((p) => (
                <li key={p.title} className="bg-surface2 border border-line rounded-lg px-3 py-2 text-[13px]">
                  <b>{p.title}</b> — vence {p.due_date}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setFiscalPreview(null)} disabled={fiscalBusy}
                className="bg-surface2 border border-line rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">Cancelar</button>
              <button onClick={confirmarVencimientosFiscales} disabled={fiscalBusy}
                className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
                <CalendarPlus size={15} /> {fiscalBusy ? "Generando…" : "Confirmar"}</button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Permisos</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={settings.edit_closed} className="accent-accent w-4 h-4"
            onChange={(e) => saveSettings({ ...settings, edit_closed: e.target.checked }, "Permiso actualizado")} />
          Permitir que encargados y empleados modifiquen o reabran tareas ya terminadas
        </label>
        <p className="text-ink2 text-[13px] mt-1.5 mb-0">Apagado: solo los jefes pueden tocar una tarea cerrada. La restricción se aplica en el servidor.</p>
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Categorías de tareas</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(settings.categorias ?? []).map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5 bg-chip rounded-full px-3 py-1 text-[13px]">
              {cat}
              <button title={`Quitar "${cat}"`}
                onClick={() => saveSettings({ ...settings, categorias: (settings.categorias ?? []).filter((c) => c !== cat) }, "Categorías guardadas")}
                className="text-ink2 hover:text-danger"><X size={12} /></button>
            </span>
          ))}
          {(settings.categorias ?? []).length === 0 && <p className="text-ink2 text-[13px] m-0">Sin categorías todavía. Agregá las que use el estudio.</p>}
        </div>
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const cat = nuevaCat.trim();
          if (!cat) return;
          const actuales = settings.categorias ?? [];
          if (!actuales.some((c) => c.toLowerCase() === cat.toLowerCase()))
            saveSettings({ ...settings, categorias: [...actuales, cat] }, "Categorías guardadas");
          setNuevaCat("");
        }}>
          <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
            placeholder="Ej: Facturación, Conciliaciones, Impuestos, Bancos…" className={inputCls + " w-[320px] max-w-full"} />
          <button type="submit" disabled={!nuevaCat.trim()}
            className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            <Plus size={14} /> Agregar</button>
        </form>
        <p className="text-ink2 text-[13px] mt-2 mb-0">Aparecen como opción al crear o editar tareas y como filtros del tablero. Quitar una categoría no toca las tarjetas que ya la tienen.</p>
        {permMsg && <p className={"text-sm mt-2 mb-0 " + (!permMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{permMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Plantillas de tareas</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <p className="text-ink2 text-[13px] mt-0 mb-3 max-w-[640px]">Definí un lote de tareas repetitivo (conciliaciones, IVA por marca…) y generalo con un click. Cada ítem puede tener su responsable; si no, se usa el responsable por defecto que elijas al generar.</p>

        {plantillas.length === 0 && <p className="text-ink2 text-[13px] m-0 mb-3">Todavía no hay plantillas. Creá una abajo.</p>}
        {plantillas.map((pl, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2 py-2 border-b border-line/60 last:border-0">
            <div className="min-w-[200px] flex-1">
              <b className="text-[13px] text-ink">{pl.nombre}</b>
              <span className="text-ink2 text-[12px]"> · {pl.categoria} · {pl.items.length} ítem{pl.items.length === 1 ? "" : "s"}</span>
            </div>
            <select value={plOwner[idx] ?? ""} onChange={(e) => setPlOwner({ ...plOwner, [idx]: e.target.value })} className={inputCls}
              title="Responsable por defecto para los ítems sin responsable">
              <option value="">Responsable por defecto…</option>
              {equipoVisible.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={() => generarPlantilla(pl, idx)} disabled={plGenBusy === idx}
              className="flex items-center gap-1.5 bg-[#0b0b0d] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">
              <CalendarPlus size={14} /> {plGenBusy === idx ? "Generando…" : "Generar"}</button>
            <button title="Eliminar plantilla" onClick={() => eliminarPlantilla(idx)}
              className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger"><Trash2 size={13} /></button>
          </div>
        ))}

        <div className="border-t border-line mt-4 pt-4">
          <h3 className="text-[13px] font-semibold text-ink mt-0 mb-2.5">Nueva plantilla</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <input value={plDraft.nombre} onChange={(e) => setPlDraft({ ...plDraft, nombre: e.target.value })} placeholder="Nombre (ej: IVA por marca)" className={inputCls + " w-[220px] max-w-full"} />
            <select value={plDraft.categoria} onChange={(e) => setPlDraft({ ...plDraft, categoria: e.target.value })} className={inputCls}>
              <option value="">Categoría…</option>
              {(settings.categorias ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(settings.categorias ?? []).length === 0 && <p className="text-ink2 text-[12px] mt-0 mb-2">Definí primero alguna categoría arriba para poder clasificar la plantilla.</p>}

          {plDraft.items.length > 0 && (
            <div className="mb-3">
              {plDraft.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-[13px]">
                  <span className="flex-1 min-w-[160px] text-ink">{it.titulo}</span>
                  <span className="text-ink2 text-[12px]">{it.owner ? (equipo.find((u) => u.id === it.owner)?.name ?? "responsable") : "por defecto"} · {it.effort} pt · {it.priority}</span>
                  <button title="Quitar ítem" onClick={() => setPlDraft({ ...plDraft, items: plDraft.items.filter((_, idx) => idx !== i) })}
                    className="border border-line bg-surface2 rounded-lg p-1 text-ink2 hover:text-danger"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input value={plItem.titulo} onChange={(e) => setPlItem({ ...plItem, titulo: e.target.value })} placeholder="Título del ítem" className={inputCls + " flex-1 min-w-[180px]"} />
            <select value={plItem.owner} onChange={(e) => setPlItem({ ...plItem, owner: e.target.value })} className={inputCls}>
              <option value="">Responsable (opcional)…</option>
              {equipoVisible.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={String(plItem.effort)} onChange={(e) => setPlItem({ ...plItem, effort: Number(e.target.value) as 1 | 2 | 3 | 5 })} className={inputCls}>
              <option value="1">1 pt</option><option value="2">2 pts</option><option value="3">3 pts</option><option value="5">5 pts</option>
            </select>
            <select value={plItem.priority} onChange={(e) => setPlItem({ ...plItem, priority: e.target.value as "alta" | "media" | "baja" })} className={inputCls}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
            <button onClick={agregarItem} disabled={!plItem.titulo.trim()}
              className="flex items-center gap-1.5 border border-dashed border-line rounded-lg px-3 py-1.5 text-[13px] text-ink2 hover:text-accent hover:border-accent disabled:opacity-50">
              <Plus size={14} /> Agregar ítem</button>
          </div>

          <button onClick={guardarPlantilla} disabled={!plDraft.nombre.trim() || !plDraft.categoria || !plDraft.items.length}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold mt-3 disabled:opacity-60">Guardar plantilla</button>
        </div>
        {permMsg && <p className={"text-sm mt-2 mb-0 " + (!permMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{permMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Tiempo máximo por categoría</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <p className="text-ink2 text-[13px] mt-0 mb-3 max-w-[640px]">SLA por categoría de tarea: horas máximas desde que entra en proceso hasta que se termina. Una tarea puede pisar este valor con su propio campo "Tiempo máximo (horas)".</p>
        {Object.keys(tiemposMax).length === 0 && <p className="text-ink2 text-[13px] m-0 mb-3">Todavía no hay categorías con tiempo máximo configurado.</p>}
        {Object.entries(tiemposMax).map(([cat, horas]) => (
          <div key={cat} className="flex items-center gap-2 py-1.5 border-b border-line/60 last:border-0">
            <span className="flex-1 text-[13px] text-ink">{cat}</span>
            <span className="text-ink2 text-[13px]">{horas}h</span>
            <button title={`Quitar "${cat}"`} onClick={() => eliminarTiempoMax(cat)}
              className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-danger"><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select value={tmCat} onChange={(e) => setTmCat(e.target.value)} className={inputCls}>
            <option value="">Categoría…</option>
            {(settings.categorias ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min={0} step="1" placeholder="Horas" value={tmHoras} onChange={(e) => setTmHoras(e.target.value)} className={inputCls + " w-24"} />
          <button onClick={agregarTiempoMax} className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            <Plus size={14} /> Agregar</button>
        </div>
        {tmMsg && <p className={"text-sm mt-2 mb-0 " + (!tmMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{tmMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Parámetros de la plataforma</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <div className="flex flex-wrap gap-4">
          <label className="text-[13px] text-ink2">Nombre del equipo (sidebar)<br />
            <input value={parBoardName ?? settings.board_name ?? "Grupo Paris"} onChange={(e) => setParBoardName(e.target.value)} className={inputCls + " w-[200px] mt-1"} /></label>
          <label className="text-[13px] text-ink2">Preaviso de vencimiento (días en amarillo)<br />
            <input type="number" min={1} max={30} value={parWarn ?? String(settings.due_warn_days ?? 3)} onChange={(e) => setParWarn(e.target.value)} className={inputCls + " w-[90px] mt-1"} /></label>
          <label className="text-[13px] text-ink2">Días sin novedades para marcar "trabada"<br />
            <input type="number" min={1} max={30} value={parStuck ?? String(settings.stuck_days ?? 2)} onChange={(e) => setParStuck(e.target.value)} className={inputCls + " w-[90px] mt-1"} /></label>
        </div>
        <button onClick={() => saveSettings({
            ...settings,
            board_name: (parBoardName ?? settings.board_name ?? "Grupo Paris").trim() || "Grupo Paris",
            due_warn_days: Math.max(1, Math.min(30, Number(parWarn ?? settings.due_warn_days ?? 3) || 3)),
            stuck_days: Math.max(1, Math.min(30, Number(parStuck ?? settings.stuck_days ?? 2) || 2)),
          }, "Parámetros guardados")}
          className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold mt-3">Guardar parámetros</button>
        {permMsg && <p className={"text-sm mt-2 mb-0 " + (!permMsg.startsWith("No se pudo") ? "text-done" : "text-danger")}>{permMsg}</p>}
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Archivo mensual</h2>
      <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={archMes} onChange={(e) => setArchMes(e.target.value)} className={inputCls + " capitalize"}>
            {mesesArchivo.map((m) => <option key={m} value={m} className="capitalize">{mesLabel(m)} ({m})</option>)}
          </select>
          <button disabled={archBusy}
            onClick={async () => {
              setArchBusy(true);
              const { data, error } = await supabase.rpc("archivar_mes", { p_mes: archMes });
              setArchBusy(false);
              if (error) toast.error("No se pudo archivar: " + error.message + ". ¿Está aplicada la migración 22?");
              else { toast.success(`Mes ${mesLabel(archMes)} archivado: ${data ?? 0} tareas.`); qc.invalidateQueries({ queryKey: ["archive"] }); }
            }}
            className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            <Archive size={14} /> {archBusy ? "Archivando…" : "Archivar mes"}</button>
        </div>
        <p className="text-ink2 text-[13px] mt-2 mb-0">Guarda una foto de todas las tareas del equipo en el historial del mes elegido. Es seguro repetirlo: reemplaza la foto anterior de ese mismo mes, nunca toca las tareas vivas.</p>
      </div>

      <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mb-2.5">Respaldo</h2>
      <button onClick={backup} disabled={busy}
        className="flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-60" style={{ boxShadow: "var(--ring-sh)" }}>
        <Download size={16} /> {busy ? "Generando…" : "Descargar backup completo (JSON)"}
      </button>
      {msg && <p className="text-done text-sm mt-2">{msg}</p>}
      <p className="text-ink2 text-[13px] mt-1.5 max-w-[560px]">Todas las tablas en un archivo. Guardalo en el Drive del estudio una vez por mes: es tu seguro ante borrados accidentales.</p>
      </>}

      {reasignar && <ReasignarModal me={me} equipo={equipo} profiles={team} cards={cards} onClose={() => setReasignar(false)} />}
    </div>
  );
}
