import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import { useConsultas } from "../../hooks/useData";
import { esTablaInexistente } from "../../hooks/usePeriodos";
import { validarConsulta } from "../../lib/consultas";
import type { Consulta } from "../../lib/types";
import { mensajeUsuario } from "../../lib/fallas";

const TIPO_LBL: Record<Consulta["tipo"], string> = { consulta: "Consulta", sugerencia: "Sugerencia", error: "Error" };
const ESTADO_LBL: Record<Consulta["estado"], string> = { nueva: "Enviada", leida: "Leída", archivada: "Archivada" };

export function ConsultasModal({ meId, onClose }: { meId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: todas = [], isError, error } = useConsultas();
  // No mentir (MEDIA 4): sólo si la tabla no existe se habla de la migración pendiente.
  // Un error de red o de RLS es otra cosa y tiene que decirse como lo que es.
  const faltaMigracion = isError && esTablaInexistente(error);
  const mias = todas.filter((c) => c.autor === meId);
  const [tipo, setTipo] = useState<Consulta["tipo"]>("consulta");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enviar() {
    const v = validarConsulta(texto);
    if (v) { setErr(v); return; }
    setErr(null); setBusy(true);
    const { error } = await supabase.from("consultas").insert({ autor: meId, tipo, texto: texto.trim(), estado: "nueva" });
    setBusy(false);
    if (error) { toast.error(mensajeUsuario(error, "enviar la consulta")); return; }
    toast.success("Consulta enviada.");
    setTexto("");
    qc.invalidateQueries({ queryKey: ["consultas"] });
    qc.invalidateQueries({ queryKey: ["consultas-nuevas"] });
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 className="text-lg font-semibold m-0 flex items-center gap-2"><MessageSquarePlus size={18} /> Consultas</h3>
      <div className="text-xs text-ink2 mb-3.5">Canal interno para consultas, sugerencias o errores del tablero.</div>

      {isError ? (
        faltaMigracion
          ? <p className="text-ink2 text-sm">Las consultas se habilitan tras la migración 29.</p>
          : <p className="text-ink2 text-sm">No se pudieron cargar las consultas. Revisá tu conexión y probá de nuevo.</p>
      ) : (
        <>
          <div className="grid gap-2.5">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Consulta["tipo"])} className={inputCls}>
              <option value="consulta">Consulta</option>
              <option value="sugerencia">Sugerencia</option>
              <option value="error">Error</option>
            </select>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
              placeholder="Escribí acá tu consulta, sugerencia o el error que encontraste…"
              className={inputCls + " resize-none"} />
            {err && <p className="text-danger text-sm m-0">{err}</p>}
            <button onClick={enviar} disabled={busy}
              className="bg-accent text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-60 justify-self-start">
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </div>

          <h4 className="text-xs uppercase tracking-wide text-ink2 mt-5 mb-2">Mis consultas</h4>
          {mias.length === 0 ? (
            <p className="text-ink2 text-sm m-0">Todavía no enviaste ninguna.</p>
          ) : (
            <div className="grid gap-2">
              {mias.map((c) => (
                <div key={c.id} className="border border-line rounded-lg p-2.5 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{TIPO_LBL[c.tipo]}</span>
                    <span className="text-ink2 text-2xs ml-auto">{ESTADO_LBL[c.estado]}</span>
                  </div>
                  <p className="m-0 text-ink">{c.texto}</p>
                  {c.respuesta && (
                    <div className="mt-2 pt-2 border-t border-line/60">
                      <span className="text-ink2 text-2xs uppercase tracking-wide">Respuesta</span>
                      <p className="m-0 mt-0.5">{c.respuesta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
