import { useEffect, useState } from "react";
import { CalendarDays, Pencil, Archive, RotateCcw, Plus, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAnnouncements } from "../../hooks/useData";
import { useArca, ArcaAgenda } from "./arca";
import { relevantes } from "../../lib/arca-filtro";
import type { Announcement, Profile } from "../../lib/types";
import { fmtDateTime } from "../../lib/metrics";
import { PREF, setPref } from "../../lib/prefs";
import { estadoVencimiento, ordenarVencimientos, CLS_TONO } from "../../lib/vencimientos";
import { AnuncioEditForm } from "../../components/AnuncioEditForm";
import { puedeEditarAnuncio } from "../../lib/anuncios";
import { activos, archivados } from "../../lib/tablon";
import { cn, Avatar } from "../../lib/ui";

function useMarkVisto() {
  useEffect(() => { setPref(PREF.tablon, new Date().toISOString()); }, []);
}

function dueBadge(due: string | null) {
  const e = estadoVencimiento(due, new Date());
  if (!e) return null;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tnum ${CLS_TONO[e.tono]}`}>{e.txt}</span>;
}

// Badge de prioridad (spec 24 item 1): urgente/importante visibles, normal sin badge.
function prioridadBadge(p: Announcement["prioridad"]) {
  if (p === "urgente") return <span className="bg-danger-soft text-danger rounded-md px-2 py-0.5 text-[11px] font-semibold">Urgente</span>;
  if (p === "importante") return <span className="bg-warn-soft text-warn rounded-md px-2 py-0.5 text-[11px] font-semibold">Importante</span>;
  return null;
}
function bordePrioridad(p: Announcement["prioridad"]) {
  if (p === "urgente") return "border-l-[3px] border-l-danger";
  if (p === "importante") return "border-l-[3px] border-l-warn";
  return "";
}

export function Tablon({ me, team = [], onGoCalendario }: { me?: Profile; team?: Profile[]; onGoCalendario?: () => void }) {
  useMarkVisto();
  const qc = useQueryClient();
  const { data: annos = [] } = useAnnouncements();
  const isJefe = me?.role === "jefe";
  const [editId, setEditId] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const arca = relevantes(useArca());
  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const hoy = new Date().toISOString().slice(0, 10);

  const vivos = activos(annos, hoy);
  const guardados = archivados(annos, hoy);

  // Archivar / restaurar — defensivo: si la migración 23 no está aplicada, toast de error.
  const setArchivado = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await supabase.from("announcements").update({ archivado: valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success(v.valor ? "Aviso archivado" : "Aviso restaurado"); },
    onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
  });

  const secciones: [Announcement["kind"], string, string][] = [
    ["vencimiento", "Vencimientos y fechas límite", "Hasta estas fechas se puede trabajar cada período."],
    ["aviso", "Avisos y recordatorios", ""],
    ["proceso", "Procesos y criterios unificados", "Cómo hacemos las cosas, por escrito."],
  ];

  return (
    <div className="px-6 py-4 w-full max-w-[900px]">
      <div className="flex justify-end mb-1">
        <button onClick={() => setPublicando((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border bg-surface2 border-line text-ink2 hover:text-accent transition">
          <Plus size={14} /> Publicar aviso
        </button>
      </div>
      {publicando && me && <PublicarForm me={me} team={team} onDone={() => setPublicando(false)} />}

      {secciones.map(([kind, titulo, sub]) => {
        const items = kind === "vencimiento" ? ordenarVencimientos(vivos) : vivos.filter((a) => a.kind === kind);
        return (
          <div key={kind}>
            <div className="flex items-center gap-3 mt-5 mb-2.5">
              <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink m-0">{titulo}</h2>
              {kind === "vencimiento" && onGoCalendario && (
                <button onClick={onGoCalendario}
                  className="flex items-center gap-1 text-accent text-[12px] font-semibold hover:underline">
                  <CalendarDays size={13} /> Ver en calendario
                </button>
              )}
            </div>
            {sub && <p className="text-ink2 text-[13px] -mt-1 mb-2.5">{sub}</p>}
            {items.length === 0 && <p className="text-ink2 text-sm">Nada publicado todavía.</p>}
            {items.map((a) => (
              <div key={a.id} className={cn("bg-surface border border-line rounded-xl px-4 py-3 mb-2", bordePrioridad(a.prioridad))} style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
                {editId === a.id ? (
                  <AnuncioEditForm a={a} onDone={() => setEditId(null)} />
                ) : (
                  <>
                    <div className="flex justify-between items-center gap-2.5 flex-wrap">
                      <span className="flex items-center gap-2 flex-wrap"><b>{a.title}</b>{prioridadBadge(a.prioridad)}</span>
                      <span className="flex items-center gap-2">
                        {kind === "vencimiento" && dueBadge(a.due_date)}
                        {me && puedeEditarAnuncio(a, me.id, isJefe) && (
                          <>
                            <button onClick={() => setEditId(a.id)} title="Editar"
                              className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-accent shrink-0"><Pencil size={13} /></button>
                            <button onClick={() => setArchivado.mutate({ id: a.id, valor: true })} title="Archivar"
                              className="border border-line bg-surface2 rounded-lg p-1.5 text-ink2 hover:text-accent shrink-0"><Archive size={13} /></button>
                          </>
                        )}
                      </span>
                    </div>
                    {a.detail && (kind === "proceso"
                      ? <details className="my-1.5"><summary className="cursor-pointer text-accent text-[13px] font-semibold">Ver procedimiento</summary><p className="text-sm mt-1 whitespace-pre-line">{a.detail}</p></details>
                      : <p className="text-sm my-1.5 whitespace-pre-line">{a.detail}</p>)}
                    <span className="text-ink2 text-xs">Publicado por {a.created_by} · {fmtDateTime(a.created_at)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {guardados.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-ink2 text-[13px] font-semibold">Archivados y vencidos ({guardados.length})</summary>
          <div className="mt-2.5">
            {guardados.map((a) => (
              <div key={a.id} className="bg-surface border border-line rounded-xl px-4 py-3 mb-2 opacity-80">
                <div className="flex justify-between items-center gap-2.5 flex-wrap">
                  <span className="flex items-center gap-2 flex-wrap"><b>{a.title}</b>{prioridadBadge(a.prioridad)}</span>
                  {me && puedeEditarAnuncio(a, me.id, isJefe) && (
                    <button onClick={() => setArchivado.mutate({ id: a.id, valor: false })} title="Restaurar"
                      className="flex items-center gap-1 border border-line bg-surface2 rounded-lg px-2.5 py-1 text-[12px] text-ink2 hover:text-accent shrink-0"><RotateCcw size={13} /> Restaurar</button>
                  )}
                </div>
                {a.detail && <p className="text-sm my-1.5 whitespace-pre-line">{a.detail}</p>}
                <span className="text-ink2 text-xs">Publicado por {a.created_by} · {fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {arca.length > 0 && <>
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink mt-5 mb-1">Agenda ARCA — {mes}</h2>
        <p className="text-ink2 text-[13px] mb-2.5">Vencimientos oficiales por terminación de CUIT. Fuente: arca.gob.ar, se actualiza sola.</p>
        <ArcaAgenda items={arca} />
      </>}
    </div>
  );
}

// Publicación desde el Tablón (spec 24 item 1): todos los roles, la RLS de insert lo permite con owner_id.
function PublicarForm({ me, team, onDone }: { me: Profile; team: Profile[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [kind, setKind] = useState<Announcement["kind"]>("aviso");
  const [detalle, setDetalle] = useState("");
  const [prioridad, setPrioridad] = useState<NonNullable<Announcement["prioridad"]>>("normal");
  const [vigencia, setVigencia] = useState("");
  const [dest, setDest] = useState<string[]>([]);
  const toggle = (id: string) => setDest((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  const companeros = team.filter((u) => u.id !== me.id);

  const publicar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({
        kind, title: titulo.trim(), detail: detalle.trim(), due_date: null,
        created_by: me.name, owner_id: me.id, visible_to: dest,
        prioridad, vigente_hasta: vigencia || null,
      });
      if (error) throw error;
      // Notificación best-effort a cada destinatario (patrón DelegarModal / notificaciones).
      if (dest.length) {
        try {
          const notifs = dest.map((destId) => ({
            owner: destId, tipo: "sistema" as const, titulo: "Nuevo aviso: " + titulo.trim(),
            detalle: "", card_id: null, leida: false,
          }));
          await supabase.from("notifications").insert(notifs);
        } catch { /* secundario: se ignora */ }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast.success("Aviso publicado"); onDone(); },
    onError: (e: Error) => toast.error("No se pudo publicar: " + e.message),
  });

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3.5 mt-2 grid gap-2" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del aviso" className={inputCls} />
      <div className="flex gap-2 flex-wrap">
        <select value={kind} onChange={(e) => setKind(e.target.value as Announcement["kind"])} className={inputCls + " flex-1 min-w-[160px]"}>
          <option value="aviso">Aviso / Reunión</option>
          <option value="proceso">Proceso</option>
          <option value="vencimiento">Vencimiento</option>
        </select>
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as NonNullable<Announcement["prioridad"]>)} className={inputCls + " flex-1 min-w-[140px]"}>
          <option value="normal">Prioridad normal</option>
          <option value="importante">Importante</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-ink2 text-[12px]">Vigente hasta (opcional)
        <input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={inputCls + " w-auto"} /></label>
      <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} placeholder="Detalle opcional" className={inputCls + " resize-y"} />
      {companeros.length > 0 && (
        <div>
          <label className="block text-xs uppercase tracking-wide text-ink2 mb-1.5">Notificar a</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto">
            {companeros.map((u) => {
              const on = dest.includes(u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggle(u.id)}
                  className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] border text-left transition", on ? "border-accent bg-accent-soft" : "border-line bg-surface2")}>
                  <Avatar name={u.name} size={20} />
                  <span className="flex-1 truncate">{u.name}</span>
                  {on && <Check size={14} className="text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => titulo.trim() ? publicar.mutate() : toast.error("Ponele un título al aviso")}
          disabled={publicar.isPending}
          className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-60">
          <Plus size={14} /> {publicar.isPending ? "Publicando…" : "Publicar"}</button>
        <button onClick={onDone} className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px]">Cancelar</button>
      </div>
    </div>
  );
}
