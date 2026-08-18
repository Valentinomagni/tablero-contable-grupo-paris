import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, RotateCcw, ListChecks } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings, useTareasEstandar, useMigraciones } from "../../hooks/useData";
import { tieneCatalogo } from "../../lib/esquema";
import {
  ordenarEstandares, validarEstandar, checklistDesdeTexto, textoDeChecklist,
  type BorradorEstandar,
} from "../../lib/catalogo";
import type { TareaEstandar } from "../../lib/types";
import { EmptyState } from "../../components/EmptyState";
import { mensajeUsuario } from "../../lib/fallas";

// Catálogo de tareas estándar (migración 55).
//
// EL PEDIDO, textual: "Juan hace las conciliaciones de Chevrolet, pero su descripción no es como
// la de Valentino. Si son las mismas tareas, diferente empresa o marca, deberíamos tenerlo igual
// para que mi jefe pueda comparar y además para que nos sirva de dato general."
//
// SÓLO EL JEFE, con dos gates: el `!esEncargado` que envuelve a esta sección en `Admin.tsx` y la
// RLS de la tabla, que lo vuelve a exigir del lado del servidor. Cambiar una definición cambia
// cómo se llama y cómo se describe el trabajo de todo el equipo; no es una preferencia personal.
//
// BAJA LÓGICA, NUNCA BORRADO. Las tareas ya creadas apuntan a la definición de la que salieron:
// borrarla dejaría el histórico sin poder decir de dónde vino cada cosa. Desactivar la saca de
// la lista de "crear desde el catálogo" y no toca nada de lo hecho.
//
// El estilo es el mismo de las demás secciones de Administración (feriados, tiempo máximo por
// categoría, empresas): la misma tarjeta, los mismos inputs. No es la tarjeta canónica de
// `Panel` (p-4 y rounded-xl, no p-[18px] y rounded-2xl) — se sigue el molde de la pantalla donde
// vive, porque una sola sección con otra forma se ve como un error.

const inputCls = "bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";
const cardCls = "bg-surface border border-line rounded-xl p-4 mb-6";
const cardSombra = { boxShadow: "var(--ring-sh),var(--shadow)" };

/** El formulario, con los números como texto: un input numérico vacío devuelve "". */
type Form = {
  nombre: string; descripcion: string; pasos: string;
  categoria: string; effort: 1 | 2 | 3 | 5; tiempoMax: string;
};
const FORM_VACIO: Form = { nombre: "", descripcion: "", pasos: "", categoria: "", effort: 1, tiempoMax: "" };

export function CatalogoTareas() {
  const qc = useQueryClient();
  const { data: aplicadas } = useMigraciones();
  const { data: settings = { edit_closed: false } } = useSettings();
  const { data: estandares = [] } = useTareasEstandar();
  const [editId, setEditId] = useState<string | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [busy, setBusy] = useState(false);

  // Sin la migración, la tabla no existe y el hook devuelve [] — que se vería igual que un
  // catálogo vacío. Decirlo evita que alguien cargue definiciones que no se guardan en ningún
  // lado y crea que las perdió.
  if (!tieneCatalogo(aplicadas)) {
    return (
      <div className={cardCls + " text-sm text-ink2"} style={cardSombra}>
        Se habilita cuando esté aplicada la migración 55.
      </div>
    );
  }

  const lista = ordenarEstandares(estandares);
  const categorias = settings.categorias ?? [];
  const formularioAbierto = nuevaAbierta || editId !== null;

  function abrirEdicion(e: TareaEstandar) {
    setNuevaAbierta(false);
    setEditId(e.id);
    setForm({
      nombre: e.nombre, descripcion: e.descripcion ?? "",
      pasos: textoDeChecklist(e.checklist), categoria: e.categoria ?? "",
      effort: e.effort, tiempoMax: e.tiempo_max_horas === null ? "" : String(e.tiempo_max_horas),
    });
  }

  function cancelar() {
    setEditId(null);
    setNuevaAbierta(false);
    setForm(FORM_VACIO);
  }

  async function guardar() {
    const borrador: BorradorEstandar = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      checklist: checklistDesdeTexto(form.pasos),
      categoria: form.categoria || null,
      effort: form.effort,
      tiempo_max_horas: form.tiempoMax.trim() === "" ? null : Number(form.tiempoMax),
    };
    // Se valida acá y no sólo en la base: el índice único de `nombre` rechazaría el duplicado
    // igual, pero devolvería el error crudo de Postgres, que no le dice a nadie qué hacer.
    const problema = validarEstandar(borrador, estandares, editId);
    if (problema) { toast.error(problema); return; }

    setBusy(true);
    const { error } = editId
      ? await supabase.from("tareas_estandar").update(borrador).eq("id", editId)
      : await supabase.from("tareas_estandar").insert(borrador);
    setBusy(false);
    if (error) { toast.error(mensajeUsuario(error, editId ? "guardar la tarea estándar" : "crear la tarea estándar")); return; }
    qc.invalidateQueries({ queryKey: ["tareas_estandar"] });
    toast.success(editId
      ? "Definición guardada. Las tareas ya creadas no cambian: cada una guardó su copia."
      : "Tarea estándar creada. Ya se puede usar al crear tareas.");
    cancelar();
  }

  async function alternarActiva(e: TareaEstandar) {
    const { error } = await supabase.from("tareas_estandar").update({ activa: !e.activa }).eq("id", e.id);
    if (error) { toast.error(mensajeUsuario(error, "cambiar el estado de la tarea estándar")); return; }
    qc.invalidateQueries({ queryKey: ["tareas_estandar"] });
    toast.success(e.activa
      ? "Dada de baja. No se ofrece más al crear tareas; las que ya salieron de ella siguen intactas."
      : "Vuelve a estar disponible al crear tareas.");
  }

  return (
    <div className={cardCls} style={cardSombra}>
      <p className="text-ink2 text-sm mt-0 mb-3 max-w-[640px]">
        La definición de una tarea que se repite en varias marcas o empresas: cómo se llama, qué incluye y qué pasos
        tiene. Quien crea la tarea la elige y ya viene escrita, así el mismo trabajo se llama igual lo haga quien lo
        haga — y recién ahí se puede comparar y sumar. Lo que se crea desde una definición se puede editar entero
        después: es un punto de partida, no una plantilla cerrada.
      </p>

      {lista.length === 0 && !formularioAbierto ? (
        <EmptyState
          title="Todavía no hay tareas estándar."
          hint="Empezá por el trabajo que hacen varias personas con distinta marca: conciliaciones, IVA, cierres."
        />
      ) : (
        <div className="flex flex-col gap-1.5 mb-3">
          {lista.map((e) => (
            <div key={e.id} className={"flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0 last:pb-0" + (e.activa ? "" : " opacity-60")}>
              <span className="flex-1 min-w-[160px] text-sm text-ink font-medium truncate">{e.nombre}</span>
              <span className="text-ink2 text-sm">{e.categoria ?? "sin categoría"}</span>
              <span className="text-ink2 text-sm">{e.effort} pt{e.effort === 1 ? "" : "s"}</span>
              {e.tiempo_max_horas !== null && <span className="text-ink2 text-sm">{e.tiempo_max_horas}h</span>}
              {e.checklist.length > 0 && (
                <span className="inline-flex items-center gap-1 text-ink2 text-2xs">
                  <ListChecks size={11} /> {e.checklist.length} paso{e.checklist.length === 1 ? "" : "s"}
                </span>
              )}
              {!e.activa && (
                <span className="inline-flex items-center gap-1 bg-chip text-ink2 rounded-full px-2 py-0.5 text-2xs font-medium">
                  <Archive size={11} /> Dada de baja
                </span>
              )}
              <button onClick={() => abrirEdicion(e)} title="Editar" className="text-ink2 hover:text-ink"><Pencil size={14} /></button>
              <button onClick={() => alternarActiva(e)}
                title={e.activa ? "Dar de baja (las tareas que ya salieron de acá no se tocan)" : "Volver a habilitar"}
                className="text-ink2 hover:text-ink">
                {e.activa ? <Archive size={14} /> : <RotateCcw size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {!formularioAbierto && (
        <button onClick={() => setNuevaAbierta(true)}
          className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-sm font-semibold">
          <Plus size={14} /> Nueva tarea estándar
        </button>
      )}

      {formularioAbierto && (
        <form className="border-t border-line pt-4" onSubmit={(ev) => { ev.preventDefault(); guardar(); }}>
          <div className="flex flex-wrap gap-2 mb-2">
            <input value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })}
              placeholder="Nombre (ej: Conciliación bancaria)" className={inputCls + " w-[260px] max-w-full"} />
            <select value={form.categoria} onChange={(ev) => setForm({ ...form, categoria: ev.target.value })} className={inputCls}>
              <option value="">Categoría…</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={String(form.effort)} onChange={(ev) => setForm({ ...form, effort: Number(ev.target.value) as 1 | 2 | 3 | 5 })}
              className={inputCls} title="Esfuerzo sugerido">
              <option value="1">1 pt</option><option value="2">2 pts</option><option value="3">3 pts</option><option value="5">5 pts</option>
            </select>
            <input type="number" min={1} step="1" value={form.tiempoMax} onChange={(ev) => setForm({ ...form, tiempoMax: ev.target.value })}
              placeholder="Horas máx." className={inputCls + " w-[110px]"} title="Tiempo máximo propio. Vacío = manda el de la categoría." />
          </div>

          <textarea value={form.descripcion} onChange={(ev) => setForm({ ...form, descripcion: ev.target.value })}
            placeholder="Descripción: qué incluye esta tarea y qué no. Esto es lo que va a leer quien la haga."
            rows={3} className={inputCls + " w-full mb-2 resize-y"} />

          {/* Los pasos como texto y no como lista con botones: el jefe carga ocho pasos pegando
              un texto, no con ocho clicks. La pantalla se usa de vez en cuando; que sea rápida
              de llenar importa más que que sea vistosa. */}
          <textarea value={form.pasos} onChange={(ev) => setForm({ ...form, pasos: ev.target.value })}
            placeholder={"Pasos, uno por renglón (opcional)\nBajar el extracto\nCruzar contra el mayor"}
            rows={4} className={inputCls + " w-full mb-2 resize-y"} />

          <p className="text-ink2 text-xs mt-0 mb-2 max-w-[640px]">
            Los pasos se copian a cada tarea que se cree desde acá. Cambiar esta definición no toca las tareas que ya
            existen: cada una se quedó con su copia, para que el mes cerrado siga diciendo lo que de verdad se hizo.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !form.nombre.trim()}
              className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              {busy ? "Guardando…" : editId ? "Guardar cambios" : "Crear"}
            </button>
            <button type="button" onClick={cancelar} className="text-ink2 text-sm">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
