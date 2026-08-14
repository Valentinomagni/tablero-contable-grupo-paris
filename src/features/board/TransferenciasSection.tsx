import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useMigraciones } from "../../hooks/useData";
import { mensajeUsuario } from "../../lib/fallas";
import { nombreSeguro, validarAdjunto } from "../../lib/adjuntos";
import { textoNoHabilitado } from "../../lib/disponibilidad";
import { toARTDate } from "../../lib/metrics";
import {
  posibleDuplicado, montoValido, textoAviso, fechaCorta, montoTexto,
  MIGRACION_TRANSFERENCIAS, type Transferencia,
} from "../../lib/transferencias";

// Registro de transferencias de clientes DENTRO de la tarea que las controla.
//
// EL REPORTE DE PATRICIA: hoy esto se lleva con PDFs sueltos en un grupo de mensajería. No hay
// lista, no se puede buscar, y sobre todo no hay forma de darse cuenta de que un comprobante ya
// se cargó — el mismo pago entra dos veces y el error aparece semanas después conciliando.
//
// EL AVISO DE REPETIDA NO BLOQUEA NADA. Muestra la transferencia parecida y pregunta si es la
// misma. Quien está mirando el comprobante decide. Si el sistema impidiera cargar lo que él cree
// repetido, quien sabe que no lo es tendría que falsear un dato para poder seguir trabajando
// —cambiar un peso el monto, inventar un número— y a partir de ahí el registro entero es mentira.
//
// Lo único duro es el número de comprobante repetido, y lo impide la base (índice único parcial
// de la migración 49): eso no es una sospecha, es un hecho. Ese caso llega acá como error y se
// traduce a una frase que se entiende, nunca al texto crudo de Postgres.
//
// ALCANCE DEL AVISO, escrito para que nadie lo dé por más de lo que es: compara contra las
// transferencias DE ESTA TAREA, que es la lista que la sección tiene cargada. El duplicado que
// entra por otra tarea (otro mes, otra persona) no lo ve el aviso — lo ataja el índice único de
// la base cuando hay número de comprobante, y no lo ataja nadie cuando no lo hay. Ampliarlo es
// posible y no está hecho: preferimos que quede anotado a que se suponga cubierto.

/** Lo que se está por cargar, antes de tener id. */
type Borrador = Pick<Transferencia, "fecha" | "cliente" | "cuit" | "monto" | "nro_comprobante">;

/** Un comprobante repetido lo rechaza la base. El texto tiene que decir qué hacer, no el 23505. */
function mensajeDeGuardado(e: unknown): string {
  const codigo = (e as { code?: string } | null)?.code ?? "";
  const msg = (e as { message?: string } | null)?.message ?? "";
  if (codigo === "23505" || /duplicate key|unique constraint/i.test(msg)) {
    return "Ese número de comprobante ya figura en el registro. Si es otra transferencia, revisá el número; si es la misma, ya está cargada.";
  }
  return mensajeUsuario(e, "registrar la transferencia");
}

export function TransferenciasSection({ cardId, meId, canEdit }:
  { cardId: string; meId?: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const inputArchivo = useRef<HTMLInputElement>(null);
  const { data: aplicadas } = useMigraciones();
  const habilitada = Array.isArray(aplicadas) && aplicadas.includes(MIGRACION_TRANSFERENCIAS);

  const [fecha, setFecha] = useState(() => toARTDate(new Date().toISOString()));
  const [cliente, setCliente] = useState("");
  const [cuit, setCuit] = useState("");
  const [monto, setMonto] = useState("");
  const [nro, setNro] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<{ previa: Transferencia; datos: Borrador } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data: filas = [], isLoading, isError } = useQuery({
    queryKey: ["transferencias", cardId],
    enabled: habilitada,
    queryFn: async (): Promise<Transferencia[]> => {
      const { data, error } = await supabase.from("transferencias")
        .select("*").eq("card_id", cardId).order("fecha", { ascending: false });
      // A PROPÓSITO no se devuelve [] cuando falla la consulta, que es lo que hacen otras
      // pantallas defensivas de este proyecto. Acá una lista vacía por error no es un vacío
      // inofensivo: el aviso de repetida compara contra ESTA lista, así que "no pude traer
      // nada" se vería igual que "no hay ninguna cargada" y el aviso nunca saltaría. Falla
      // ruidosa y el formulario se apaga, que es lo correcto cuando lo que está en juego es
      // cargar dos veces el mismo pago.
      if (error) throw error;
      return (data ?? []) as Transferencia[];
    },
  });

  const limpiar = () => {
    setCliente(""); setCuit(""); setMonto(""); setNro(""); setArchivo(null);
    if (inputArchivo.current) inputArchivo.current.value = "";
  };

  const registrar = useMutation({
    mutationFn: async (datos: Borrador) => {
      if (!meId) throw new Error("Sesión sin identificar");
      // El comprobante se sube ANTES de la fila: si la fila entra y el archivo falla, queda una
      // transferencia sin respaldo y nadie se entera. Al revés, lo peor que pasa es un archivo
      // huérfano en el bucket, que no engaña a nadie.
      let adjunto_path: string | null = null;
      if (archivo) {
        const ruta = `${cardId}/${nombreSeguro(archivo.name)}`;
        const { error } = await supabase.storage.from("adjuntos").upload(ruta, archivo);
        if (error) throw error;
        adjunto_path = ruta;
      }
      const { error } = await supabase.from("transferencias")
        .insert({ card_id: cardId, owner: meId, ...datos, adjunto_path });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transferencias", cardId] });
      qc.invalidateQueries({ queryKey: ["adjuntos", cardId] });
      setAviso(null);
      limpiar();
      toast.success("Transferencia registrada");
    },
    onError: (e: Error) => toast.error(mensajeDeGuardado(e)),
  });

  const borrar = useMutation({
    mutationFn: async (t: Transferencia) => {
      const { error } = await supabase.from("transferencias").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transferencias", cardId] });
      setConfirmDel(null);
      toast.success("Transferencia eliminada del registro");
    },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "eliminar la transferencia")),
  });

  const descargar = async (ruta: string) => {
    const win = window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage.from("adjuntos").createSignedUrl(ruta, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Sin enlace");
      if (win) win.location.href = data.signedUrl;
      else window.open(data.signedUrl, "_blank");
    } catch {
      win?.close();
      toast.error("No se pudo abrir el comprobante.");
    }
  };

  const enviar = () => {
    const n = montoValido(monto);
    if (!cliente.trim()) { toast.error("Falta el cliente."); return; }
    if (n === null) { toast.error("El monto tiene que ser un número mayor a cero. Usá coma para los centavos."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { toast.error("Falta la fecha de la transferencia."); return; }
    if (archivo) {
      const problema = validarAdjunto(archivo);
      if (problema) { toast.error(problema); return; }
    }
    // El comprobante vacío viaja como null, NUNCA como cadena vacía: el índice único de la base
    // ignora los null pero no los '' — con '' la segunda transferencia sin número sería rechazada
    // por "repetida" sin haber ningún número repetido.
    const datos: Borrador = {
      fecha,
      cliente: cliente.trim(),
      cuit: cuit.trim() || null,
      monto: n,
      nro_comprobante: nro.trim() || null,
    };
    const previa = posibleDuplicado(datos as Transferencia, filas);
    if (previa) { setAviso({ previa, datos }); return; }
    registrar.mutate(datos);
  };

  if (!habilitada) {
    return (
      <>
        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Transferencias de clientes</h4>
        {/* Sin el número de migración: esto lo ve quien carga transferencias, no quien las
            corre. Ver `src/lib/disponibilidad.ts`. */}
        <p className="text-ink2 text-xs m-0">{textoNoHabilitado("las transferencias de clientes")}</p>
      </>
    );
  }

  const puedeCargar = canEdit && !!meId && !isError && !isLoading;

  return (
    <>
      <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Transferencias de clientes ({filas.length})</h4>

      {isError && (
        <p className="text-warn text-sm m-0 mb-2">
          No se pudieron traer las transferencias ya cargadas. El aviso de repetidas no puede
          funcionar sin esa lista, así que la carga queda en pausa hasta que vuelva. Cerrá y abrí
          la tarea para reintentar.
        </p>
      )}

      {!isError && filas.length === 0 && <p className="text-ink2 text-sm m-0">Todavía no hay transferencias cargadas en esta tarea.</p>}

      {filas.map((t) => (
        <div key={t.id} className="flex items-center gap-2 py-1 text-sm border-b border-line last:border-b-0">
          <span className="text-ink2 text-xs tnum shrink-0 w-20">{fechaCorta(t.fecha)}</span>
          <span className="flex-1 truncate" title={t.cuit ? `CUIT ${t.cuit}` : undefined}>{t.cliente}</span>
          <span className="tnum shrink-0">{montoTexto(t.monto)}</span>
          {t.nro_comprobante && <span className="text-ink2 text-xs shrink-0 truncate max-w-[7rem]" title={`Comprobante ${t.nro_comprobante}`}>{t.nro_comprobante}</span>}
          {t.adjunto_path && (
            <button title="Ver comprobante" onClick={() => descargar(t.adjunto_path!)}
              className="text-ink2 hover:text-accent transition shrink-0"><FileText size={14} /></button>
          )}
          {canEdit && (
            confirmDel === t.id ? (
              <span className="flex items-center gap-1 text-xs shrink-0">
                <span className="text-ink2">¿Eliminar?</span>
                <button onClick={() => borrar.mutate(t)} disabled={borrar.isPending} className="text-danger hover:underline">Sí</button>
                <button onClick={() => setConfirmDel(null)} className="text-ink2 hover:underline">No</button>
              </span>
            ) : (
              <button title="Eliminar del registro" onClick={() => setConfirmDel(t.id)}
                className="border border-line bg-surface2 rounded-lg px-1.5 py-1 shrink-0"><Trash2 size={12} /></button>
            )
          )}
        </div>
      ))}

      {puedeCargar && (
        <>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} title="Fecha de la transferencia"
              className="bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm outline-none" />
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente"
              className="bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm outline-none" />
            <input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="CUIT (opcional)" inputMode="numeric"
              className="bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm outline-none tnum" />
            <input value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" inputMode="decimal"
              className="bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm outline-none tnum" />
            <input value={nro} onChange={(e) => setNro(e.target.value)} placeholder="N° de comprobante (opcional)"
              className="col-span-2 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm outline-none" />
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <input ref={inputArchivo} type="file" className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            <button onClick={() => inputArchivo.current?.click()}
              className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm">
              <Paperclip size={13} /> {archivo ? "Cambiar comprobante" : "Adjuntar comprobante"}
            </button>
            {archivo && <span className="text-ink2 text-xs truncate max-w-[12rem]" title={archivo.name}>{archivo.name}</span>}
            <button onClick={enviar} disabled={registrar.isPending}
              className="ml-auto bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-1.5 text-sm disabled:opacity-60">
              {registrar.isPending ? "Registrando…" : "Registrar"}
            </button>
          </div>

          {/* El aviso de repetida. Muestra la transferencia parecida y PREGUNTA: las dos salidas
              están a la misma distancia, ninguna está escondida. Cargar igual no es una
              transgresión — dos pagos iguales el mismo mes existen y son normales. */}
          {aviso && (
            <div className="mt-2 border border-warn/40 bg-surface2 rounded-lg px-3 py-2">
              <p className="flex items-start gap-1.5 text-sm m-0">
                <AlertTriangle size={14} className="text-warn shrink-0 mt-0.5" />
                <span>{textoAviso(aviso.previa)} ¿Es la misma?</span>
              </p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button onClick={() => setAviso(null)}
                  className="border border-line bg-surface rounded-lg px-3 py-1.5 text-sm">Sí, es la misma — no la cargo</button>
                <button onClick={() => registrar.mutate(aviso.datos)} disabled={registrar.isPending}
                  className="border border-line bg-surface rounded-lg px-3 py-1.5 text-sm disabled:opacity-60">
                  No, es otra — registrarla igual</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
