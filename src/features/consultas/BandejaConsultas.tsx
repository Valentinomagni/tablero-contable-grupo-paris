import { useState } from "react";
import { CheckCheck, Archive, Reply } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useConsultas } from "../../hooks/useData";
import { esTablaInexistente } from "../../hooks/usePeriodos";
// Las etiquetas viven en la lib y no acá: el informe de `scripts/consultas.mjs` usa las
// mismas, y cuando estaban duplicadas la misma consulta se llamaba distinto en cada lado.
import { ordenarConsultas, TIPO_LBL, ESTADO_LBL } from "../../lib/consultas";
import type { Consulta } from "../../lib/types";

export function BandejaConsultas({ team }: { team: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const { data: todas = [], isError, error } = useConsultas();
  const [filtro, setFiltro] = useState<"todas" | Consulta["estado"]>("todas");
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  // No mentir (MEDIA 4): "falta la migración" sólo cuando la tabla realmente no existe.
  // Cualquier otro error (red, RLS) se reporta como error, no como función deshabilitada.
  if (isError) {
    return esTablaInexistente(error)
      ? <p className="text-ink2 text-sm">Las consultas se habilitan tras la migración 29.</p>
      : <p className="text-ink2 text-sm">No se pudieron cargar las consultas. Revisá tu conexión y probá de nuevo.</p>;
  }

  const ordenadas = ordenarConsultas(todas);
  const visibles = filtro === "todas" ? ordenadas : ordenadas.filter((c) => c.estado === filtro);
  const nombreDe = (id: string) => team.find((u) => u.id === id)?.name ?? "—";

  async function actualizar(id: string, patch: Partial<Consulta>) {
    const { error } = await supabase.from("consultas").update(patch).eq("id", id);
    if (error) { toast.error("No se pudo actualizar: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["consultas"] });
    qc.invalidateQueries({ queryKey: ["consultas-nuevas"] });
  }

  async function responder(id: string) {
    if (!borrador.trim()) { toast.error("Escribí una respuesta."); return; }
    await actualizar(id, { respuesta: borrador.trim(), respondida_at: new Date().toISOString(), estado: "leida" });
    setRespondiendo(null); setBorrador("");
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className={inputCls}>
          <option value="todas">Todas</option>
          <option value="nueva">Nuevas</option>
          <option value="leida">Leídas</option>
          <option value="archivada">Archivadas</option>
        </select>
      </div>
      {visibles.length === 0 ? (
        <p className="text-ink2 text-sm m-0">No hay consultas para este filtro.</p>
      ) : (
        <div className="grid gap-2">
          {visibles.map((c) => (
            <div key={c.id} className="border border-line rounded-lg p-2.5 text-sm bg-surface">
              <div className="flex items-center gap-2 mb-1">
                <b>{nombreDe(c.autor)}</b>
                <span className="text-ink2">· {TIPO_LBL[c.tipo]}</span>
                <span className="text-ink2 text-2xs ml-auto">{ESTADO_LBL[c.estado]}</span>
              </div>
              <p className="m-0 text-ink">{c.texto}</p>
              {c.respuesta && (
                <div className="mt-2 pt-2 border-t border-line/60">
                  <span className="text-ink2 text-2xs uppercase tracking-wide">Respuesta</span>
                  <p className="m-0 mt-0.5">{c.respuesta}</p>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                {c.estado === "nueva" && (
                  <button onClick={() => actualizar(c.id, { estado: "leida" })}
                    className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-2.5 py-1 text-xs">
                    <CheckCheck size={13} /> Marcar leída</button>
                )}
                {c.estado !== "archivada" && (
                  <button onClick={() => actualizar(c.id, { estado: "archivada" })}
                    className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-2.5 py-1 text-xs">
                    <Archive size={13} /> Archivar</button>
                )}
                <button onClick={() => { setRespondiendo(respondiendo === c.id ? null : c.id); setBorrador(c.respuesta ?? ""); }}
                  className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-2.5 py-1 text-xs">
                  <Reply size={13} /> Responder</button>
              </div>
              {respondiendo === c.id && (
                <div className="mt-2 grid gap-1.5">
                  <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} rows={3}
                    placeholder="Escribí la respuesta…" className={inputCls + " resize-none"} />
                  <button onClick={() => responder(c.id)}
                    className="bg-accent text-white rounded-lg px-3 py-1.5 text-xs font-semibold justify-self-start">
                    Guardar respuesta</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
