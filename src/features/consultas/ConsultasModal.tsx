import { useState } from "react";
import { MessageSquarePlus, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import { useConsultas } from "../../hooks/useData";
import { esTablaInexistente } from "../../hooks/usePeriodos";
import { validarConsulta } from "../../lib/consultas";
import type { Consulta } from "../../lib/types";
import { mensajeUsuario } from "../../lib/fallas";
import { textoNoHabilitado } from "../../lib/disponibilidad";
import { validarCaptura, imagenDelPegado, rutaCaptura } from "../../lib/captura";

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
  // La captura y su vista previa. `previa` es una URL de objeto: se libera al cambiarla o al
  // sacarla, porque si no queda el blob entero en memoria hasta que se cierre la pestaña.
  const [captura, setCaptura] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);

  function ponerCaptura(f: File | null) {
    const problema = validarCaptura(f);
    if (problema) { setErr(problema); return; }
    if (previa) URL.revokeObjectURL(previa);
    setErr(null);
    setCaptura(f);
    setPrevia(f ? URL.createObjectURL(f) : null);
  }

  function sacarCaptura() {
    if (previa) URL.revokeObjectURL(previa);
    setCaptura(null);
    setPrevia(null);
  }

  // Ctrl+V es el CAMINO PRINCIPAL, no un extra (reporte de Mathi). Cuando alguien encuentra un
  // error aprieta la tecla de captura y la imagen queda en el portapapeles. Obligarla a
  // guardarla como archivo, buscar la carpeta y elegirla son cuatro pasos más justo cuando ya
  // está frustrada: es la fricción exacta que hace que no se adjunte nada.
  function alPegar(e: React.ClipboardEvent) {
    const img = imagenDelPegado(e.clipboardData?.items);
    // Sin imagen no se hace NADA y no se avisa: pegar texto en este cuadro es lo normal y lo
    // más frecuente. El `preventDefault` sólo va cuando de verdad hay una imagen, para no
    // romper el pegado de texto de siempre.
    if (!img) return;
    e.preventDefault();
    ponerCaptura(img);
  }

  async function enviar() {
    const v = validarConsulta(texto);
    if (v) { setErr(v); return; }
    setErr(null); setBusy(true);

    // La captura se sube ANTES de la fila. Si la fila entrara primero y la subida fallara,
    // quedaría un reporte que dice "mirá la captura" sin captura, y nadie se enteraría. Al
    // revés, lo peor que pasa es una imagen huérfana en el bucket, que no engaña a nadie.
    let adjunto_path: string | null = null;
    if (captura) {
      const ruta = rutaCaptura(meId, captura.type, new Date().toISOString());
      if (ruta) {
        const { error: eSubida } = await supabase.storage.from("consultas").upload(ruta, captura);
        if (eSubida) {
          setBusy(false);
          toast.error(mensajeUsuario(eSubida, "subir la captura"));
          return;
        }
        adjunto_path = ruta;
      }
    }

    const { error } = await supabase.from("consultas")
      .insert({ autor: meId, tipo, texto: texto.trim(), estado: "nueva", adjunto_path });
    setBusy(false);
    if (error) { toast.error(mensajeUsuario(error, "enviar la consulta")); return; }
    toast.success("Consulta enviada.");
    setTexto("");
    sacarCaptura();
    qc.invalidateQueries({ queryKey: ["consultas"] });
    qc.invalidateQueries({ queryKey: ["consultas-nuevas"] });
  }

  const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 className="text-lg font-semibold m-0 flex items-center gap-2"><MessageSquarePlus size={18} /> Consultas</h3>
      <div className="text-xs text-ink2 mb-3.5">Canal interno para consultas, sugerencias o errores del tablero.</div>

      {/* Decía "se habilitan tras la migración 29". Este es el canal por el que alguien reporta
          un problema: recibirlo con un número de migración es la peor primera impresión posible,
          porque le contesta con jerga a quien vino justamente porque algo no le funcionaba. */}
      {isError ? (
        faltaMigracion
          ? <p className="text-ink2 text-sm">{textoNoHabilitado("las consultas")}</p>
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
              onPaste={alPegar}
              placeholder="Escribí acá tu consulta, sugerencia o el error que encontraste. Si sacaste una captura, pegala con Ctrl+V."
              className={inputCls + " resize-none"} />

            {/* La captura. El texto dice PRIMERO lo de pegar, porque es de donde viene la
                imagen recién sacada; elegir un archivo es el camino de respaldo. */}
            {previa ? (
              <div className="flex items-start gap-2.5 border border-line rounded-lg p-2">
                <img src={previa} alt="Vista previa de la captura"
                  className="w-24 h-16 object-cover rounded-md border border-line shrink-0" />
                <div className="text-xs text-ink2 grid gap-1">
                  <span>Captura lista para enviar.</span>
                  <button onClick={sacarCaptura}
                    className="inline-flex items-center gap-1 text-ink2 hover:text-danger transition justify-self-start">
                    <X size={12} /> Sacarla
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                <ImagePlus size={14} className="shrink-0" />
                <span>Pegá una captura con Ctrl+V, o <u>elegí una imagen</u>.</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => ponerCaptura(e.target.files?.[0] ?? null)} />
              </label>
            )}

            {/* Quién la va a ver, dicho ANTES de mandarla. Una captura muestra más de lo que el
                texto dice —la pestaña de al lado, el archivo abierto— y quien la manda tiene
                derecho a saber dónde va antes de apretar Enviar, no después. */}
            {previa && (
              <p className="text-ink2 text-2xs m-0">
                La captura la ve quien administra el sistema, y vos. El resto del equipo no.
              </p>
            )}

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
