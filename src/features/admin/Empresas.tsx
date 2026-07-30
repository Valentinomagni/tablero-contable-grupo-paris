import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Factory, Pencil } from "lucide-react";
import { useEmpresas, useCrearEmpresa, useEditarEmpresa, useBorrarEmpresa } from "../../hooks/useData";
import { esTablaInexistente } from "../../hooks/usePeriodos";
import { ordenarEmpresas } from "../../lib/empresas";
import type { Empresa } from "../../lib/types";
import { EmptyState } from "../../components/EmptyState";

// Datos estratégicos de empresas (spec 28, Task 8): SOLO 4 campos (nombre, CUIT,
// cierre de balance, reporta a fábrica, prioridad manual). A propósito NO hay
// domicilio, contactos, condición de IVA ni cuentas: es parametrización interna
// para priorizar trabajo, no un maestro de clientes tipo ERP (eso es Quiter).
// No agregar campos acá aunque "quede mejor" — ver .superpowers/sdd/task-8-brief.md.
//
// Solo la ve el jefe (gate acá + RLS de la tabla `empresas`, que además refuerza
// del lado del servidor que solo `es_jefe()` puede escribir).

const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";

type Form = { nombre: string; cuit: string; cierre_balance: string; reporta_fabrica: boolean; prioridad: number };
const FORM_VACIO: Form = { nombre: "", cuit: "", cierre_balance: "", reporta_fabrica: false, prioridad: 0 };

export function Empresas() {
  const empresasQuery = useEmpresas();
  const crear = useCrearEmpresa();
  const editar = useEditarEmpresa();
  const borrar = useBorrarEmpresa();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const migracionPendiente = empresasQuery.isError && esTablaInexistente(empresasQuery.error);

  if (migracionPendiente) {
    return (
      <div className="bg-surface border border-line rounded-xl p-4 mb-6 text-sm text-ink2" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        Se habilita tras la migración 31.
      </div>
    );
  }

  if (empresasQuery.isError) {
    return (
      <div className="bg-surface border border-line rounded-xl p-4 mb-6 text-sm text-danger" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
        No se pudieron cargar las empresas.
      </div>
    );
  }

  const empresas = ordenarEmpresas(empresasQuery.data ?? []);

  function abrirEdicion(e: Empresa) {
    setNuevaAbierta(false);
    setEditId(e.id);
    setForm({
      nombre: e.nombre, cuit: e.cuit ?? "", cierre_balance: e.cierre_balance ?? "",
      reporta_fabrica: e.reporta_fabrica, prioridad: e.prioridad,
    });
  }

  function cancelar() {
    setEditId(null);
    setNuevaAbierta(false);
    setForm(FORM_VACIO);
  }

  function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) return;
    const payload = {
      nombre, cuit: form.cuit.trim() || null, cierre_balance: form.cierre_balance || null,
      reporta_fabrica: form.reporta_fabrica, prioridad: form.prioridad,
    };
    if (editId) {
      editar.mutate({ id: editId, ...payload }, {
        onSuccess: () => { toast.success("Empresa actualizada."); cancelar(); },
        onError: (e: Error) => toast.error("No se pudo actualizar: " + e.message),
      });
    } else {
      crear.mutate(payload, {
        onSuccess: () => { toast.success("Empresa creada."); cancelar(); },
        onError: (e: Error) => toast.error("No se pudo crear: " + e.message),
      });
    }
  }

  function eliminar(e: Empresa) {
    if (!confirm(`¿Eliminar "${e.nombre}"?`)) return;
    borrar.mutate(e.id, {
      onSuccess: () => toast.success("Empresa eliminada."),
      onError: (err: Error) => toast.error("No se pudo eliminar: " + err.message),
    });
  }

  const formularioAbierto = nuevaAbierta || editId !== null;
  const busy = crear.isPending || editar.isPending;

  return (
    <div className="bg-surface border border-line rounded-xl p-4 mb-6" style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
      {empresas.length === 0 && !formularioAbierto ? (
        <EmptyState title="Todavía no hay empresas cargadas." hint="Agregá una para empezar a priorizar el trabajo automáticamente." />
      ) : (
        <div className="flex flex-col gap-1.5 mb-3">
          {empresas.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
              <span className="flex-1 min-w-[140px] text-sm text-ink font-medium truncate">{e.nombre}</span>
              <span className="text-ink2 text-sm">{e.cuit ?? "sin CUIT"}</span>
              <span className="text-ink2 text-sm">{e.cierre_balance ? `cierre ${e.cierre_balance}` : "sin cierre"}</span>
              {e.reporta_fabrica && (
                <span className="inline-flex items-center gap-1 bg-accent-soft text-done rounded-full px-2 py-0.5 text-2xs font-medium">
                  <Factory size={11} /> Reporta a fábrica
                </span>
              )}
              <span className="text-ink2 text-2xs">prioridad {e.prioridad}</span>
              <button onClick={() => abrirEdicion(e)} title="Editar" className="text-ink2 hover:text-ink"><Pencil size={14} /></button>
              <button onClick={() => eliminar(e)} title="Eliminar" className="text-ink2 hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {!formularioAbierto && (
        <button onClick={() => setNuevaAbierta(true)}
          className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-sm font-semibold">
          <Plus size={14} /> Nueva empresa
        </button>
      )}

      {formularioAbierto && (
        <form className="flex flex-wrap gap-2 items-center" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
          <input placeholder="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls + " w-[180px]"} />
          <input placeholder="CUIT" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} className={inputCls + " w-[140px]"} />
          <input type="date" placeholder="cierre de balance" value={form.cierre_balance} onChange={(e) => setForm({ ...form, cierre_balance: e.target.value })} className={inputCls} />
          <label className="flex items-center gap-1.5 text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={form.reporta_fabrica} onChange={(e) => setForm({ ...form, reporta_fabrica: e.target.checked })} className="accent-accent w-4 h-4" />
            Reporta a fábrica
          </label>
          <div className="flex flex-col gap-1">
            <input type="number" min={0} max={4} placeholder="prioridad" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: Number(e.target.value) || 0 })} className={inputCls + " w-[90px]"} />
            <span className="text-ink2 text-xs">Prioridad 0–4. Las empresas que reportan a fábrica siempre quedan por encima de las que no.</span>
          </div>
          <button type="submit" disabled={busy || !form.nombre.trim()}
            className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            {busy ? "Guardando…" : editId ? "Guardar cambios" : "Crear"}
          </button>
          <button type="button" onClick={cancelar} className="text-ink2 text-sm">Cancelar</button>
        </form>
      )}
    </div>
  );
}
