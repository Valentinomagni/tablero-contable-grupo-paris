import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Trash2, FileText } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { nombreSeguro, validarAdjunto } from "../../lib/adjuntos";
import { mensajeUsuario } from "../../lib/fallas";

// Tamaño legible en KB/MB (sin dependencias externas).
function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ArchivoStorage = { name: string; metadata?: { size?: number } | null };

// Sección "Adjuntos" del detalle de tarea. Defensiva: si el bucket de Storage
// todavía no existe (migración 28 no aplicada), no rompe — muestra un aviso chico.
export function Adjuntos({ cardId, canEdit }: { cardId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adjuntos", cardId],
    queryFn: async (): Promise<{ pendiente: true } | { pendiente: false; archivos: ArchivoStorage[] }> => {
      const { data, error } = await supabase.storage.from("adjuntos").list(cardId);
      if (error) return { pendiente: true };
      return { pendiente: false, archivos: (data ?? []) as ArchivoStorage[] };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["adjuntos", cardId] });

  const subir = useMutation({
    mutationFn: async (file: File) => {
      const msg = validarAdjunto(file);
      if (msg) throw new Error(msg);
      const path = `${cardId}/${nombreSeguro(file.name)}`;
      const { error } = await supabase.storage.from("adjuntos").upload(path, file);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Adjunto subido"); },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "subir el archivo")),
  });

  const borrar = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage.from("adjuntos").remove([`${cardId}/${name}`]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirmDel(null); toast.success("Adjunto eliminado"); },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "eliminar el archivo")),
  });

  const descargar = async (name: string) => {
    const win = window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage.from("adjuntos").createSignedUrl(`${cardId}/${name}`, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No se pudo generar el enlace de descarga");
      if (win) win.location.href = data.signedUrl;
      else window.open(data.signedUrl, "_blank");
    } catch {
      win?.close();
      toast.error("No se pudo descargar el adjunto.");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const msg = validarAdjunto(file);
    if (msg) { toast.error(msg); return; }
    subir.mutate(file);
  };

  if (isLoading) return null;

  if (!data || data.pendiente) {
    return (
      <>
        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Adjuntos</h4>
        <p className="text-ink2 text-xs m-0">Los adjuntos van a estar disponibles tras la migración 28.</p>
      </>
    );
  }

  const archivos = data.archivos;

  return (
    <>
      <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Adjuntos</h4>
      {archivos.length === 0 && <p className="text-ink2 text-sm m-0">Sin adjuntos.</p>}
      {archivos.map((a) => (
        <div key={a.name} className="flex items-center gap-2 py-1 text-sm">
          <FileText size={14} className="text-ink2 shrink-0" />
          <button onClick={() => descargar(a.name)} className="flex-1 text-left truncate hover:text-accent transition" title="Descargar">
            {a.name}
          </button>
          <span className="text-ink2 text-xs tnum shrink-0">{tamanoLegible(a.metadata?.size ?? 0)}</span>
          {canEdit && (
            confirmDel === a.name ? (
              <span className="flex items-center gap-1 text-xs shrink-0">
                <span className="text-ink2">¿Eliminar?</span>
                <button onClick={() => borrar.mutate(a.name)} disabled={borrar.isPending}
                  className="text-danger hover:underline">Sí</button>
                <button onClick={() => setConfirmDel(null)} className="text-ink2 hover:underline">No</button>
              </span>
            ) : (
              <button title="Borrar" onClick={() => setConfirmDel(a.name)}
                className="border border-line bg-surface2 rounded-lg px-1.5 py-1 shrink-0"><Trash2 size={12} /></button>
            )
          )}
        </div>
      ))}
      {canEdit && (
        <div className="mt-2">
          <input ref={inputRef} type="file" className="hidden" onChange={onFileChange} />
          <button onClick={() => inputRef.current?.click()} disabled={subir.isPending}
            className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm disabled:opacity-60">
            <Paperclip size={13} /> {subir.isPending ? "Subiendo…" : "Adjuntar archivo"}
          </button>
        </div>
      )}
    </>
  );
}
