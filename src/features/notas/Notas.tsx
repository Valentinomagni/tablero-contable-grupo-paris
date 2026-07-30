import { EmptyState } from "../../components/EmptyState";
import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Archive, ArchiveRestore, Trash2, StickyNote, ListPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { filtrarOrdenar, notaATarea } from "../../lib/notas";
import { useNotes } from "../../hooks/useNotes";
import type { Note, Profile } from "../../lib/types";
import { cn } from "../../lib/ui";
import { mensajeUsuario } from "../../lib/fallas";

const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };

export function Notas({ me }: { me: Profile }) {
  const { data: notes = [] } = useNotes();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<"modificado" | "creado">("modificado");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const lista = filtrarOrdenar(notes, q, orden, verArchivadas);
  const sel = notes.find((n) => n.id === selId) ?? null;

  // sincroniza el editor cuando cambia la nota seleccionada
  useEffect(() => {
    setTitle(sel?.title ?? "");
    setBody(sel?.body ?? "");
    setConfirmDel(false);
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => qc.invalidateQueries({ queryKey: ["notes"] });

  const crear = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("notes").insert({ owner: me.id, title: "", body: "" }).select("*").single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (nueva) => { refetch(); setSelId(nueva.id); },
    onError: (e: unknown) => toast.error(mensajeUsuario(e, "crear la nota")),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!sel) return;
      if (sel.title === title && sel.body === body) return;
      const { error } = await supabase.from("notes")
        .update({ title, body, updated_at: new Date().toISOString() }).eq("id", sel.id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: unknown) => toast.error(mensajeUsuario(e, "guardar la nota")),
  });

  const archivar = useMutation({
    mutationFn: async (nota: Note) => {
      const { error } = await supabase.from("notes")
        .update({ archived: !nota.archived, updated_at: new Date().toISOString() }).eq("id", nota.id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: unknown) => toast.error(mensajeUsuario(e, "archivar la nota")),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); setSelId(null); },
    onError: (e: unknown) => toast.error(mensajeUsuario(e, "eliminar la nota")),
  });

  const convertir = useMutation({
    mutationFn: async (nota: Note) => {
      const row = {
        ...notaATarea(nota, me.id),
        history: [{ who: me.name, at: new Date().toISOString(), txt: "Creó la tarea desde una anotación" }],
      };
      const { error } = await supabase.from("cards").insert(row);
      if (error) throw error;
      // archiva la nota convertida (best-effort)
      if (!nota.archived) await supabase.from("notes").update({ archived: true, updated_at: new Date().toISOString() }).eq("id", nota.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      refetch();
      toast.success("Creada en tu tablero");
    },
    onError: (e: unknown) => toast.error(mensajeUsuario(e, "convertir la nota en tarea")),
  });

  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

  return (
    <div className="flex gap-4 px-6 pt-4 pb-6 h-[calc(100vh-120px)]">
      {/* Lista */}
      <div className="w-[320px] shrink-0 flex flex-col rounded-2xl bg-surface border border-line overflow-hidden" style={cardSh}>
        <div className="p-3 border-b border-line flex flex-col gap-2">
          <button onClick={() => crear.mutate()}
            className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-accent text-white hover:opacity-90 transition">
            <Plus size={15} /> Nueva nota
          </button>
          <div className="flex items-center gap-2 bg-surface2 border border-line rounded-lg px-2.5">
            <Search size={14} className="text-ink2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
              className="w-full py-1.5 bg-transparent text-sm outline-none" />
          </div>
          <div className="flex items-center gap-1.5 text-2xs">
            <button onClick={() => setOrden("modificado")}
              className={cn("rounded-md px-2 py-1 border transition", orden === "modificado" ? "bg-accent-soft border-accent text-accent" : "bg-surface2 border-line text-ink2")}>Modificadas</button>
            <button onClick={() => setOrden("creado")}
              className={cn("rounded-md px-2 py-1 border transition", orden === "creado" ? "bg-accent-soft border-accent text-accent" : "bg-surface2 border-line text-ink2")}>Creadas</button>
            <label className="flex items-center gap-1 ml-auto text-ink2 cursor-pointer">
              <input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Archivadas
            </label>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {lista.length === 0 && <div className="m-1.5"><EmptyState title="Sin anotaciones" /></div>}
          {lista.map((n) => (
            <button key={n.id} onClick={() => setSelId(n.id)}
              className={cn("w-full text-left rounded-lg px-3 py-2.5 mb-1 transition border",
                n.id === selId ? "bg-accent-soft border-accent" : "border-transparent hover:bg-surface2")}>
              <div className="flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm font-semibold text-ink">{n.title.trim() || "Sin título"}</span>
                {n.archived && <Archive size={12} className="text-ink2 shrink-0" />}
                <span className="text-2xs text-ink2 tnum shrink-0">{fecha(orden === "creado" ? n.created_at : n.updated_at)}</span>
              </div>
              <div className="text-xs text-ink2 truncate">{n.body.trim() || "…"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-surface border border-line overflow-hidden" style={cardSh}>
        {!sel ? (
          <div className="flex-1 grid place-items-center text-ink2">
            <div className="flex flex-col items-center gap-3">
              <StickyNote size={40} strokeWidth={1.4} className="opacity-40" />
              <p className="text-sm">Elegí una nota o creá una nueva.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 border-b border-line">
              <button onClick={() => archivar.mutate(sel)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border bg-surface2 border-line text-ink2 hover:bg-surface transition">
                {sel.archived ? <><ArchiveRestore size={14} /> Desarchivar</> : <><Archive size={14} /> Archivar</>}
              </button>
              <button onClick={() => convertir.mutate(sel)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border bg-surface2 border-line text-ink2 hover:text-accent transition">
                <ListPlus size={14} /> Convertir en tarea
              </button>
              <div className="flex-1" />
              {confirmDel ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-ink2">¿Eliminar?</span>
                  <button onClick={() => eliminar.mutate(sel.id)} className="rounded-lg px-3 py-1.5 border border-red-500/40 text-red-500 hover:bg-red-500/10 transition">Sí, eliminar</button>
                  <button onClick={() => setConfirmDel(false)} className="rounded-lg px-3 py-1.5 border border-line bg-surface2 text-ink2">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border bg-surface2 border-line text-ink2 hover:text-red-500 transition">
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
            <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
              <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => guardar.mutate()}
                placeholder="Título" className="text-xl font-bold tracking-[-0.02em] bg-transparent outline-none text-ink" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => guardar.mutate()}
                placeholder="Escribí tu anotación…" className="flex-1 resize-none bg-transparent outline-none text-base leading-relaxed text-ink" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
