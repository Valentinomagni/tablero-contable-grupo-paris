import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { supabase } from "../../lib/supabase";
import { similares } from "../../lib/similitud";
import { categoriasEnUso, mergeCategorias } from "../../lib/categorias";
import { useSettings, useMigraciones, useTareasEstandar } from "../../hooks/useData";
import { payloadCards, tieneCatalogo } from "../../lib/esquema";
import { desdeEstandar, estandaresElegibles } from "../../lib/catalogo";
import { camposDeAlta, TIPO_ALTA_POR_DEFECTO, type TipoAlta } from "../../lib/recurrencia-alta";
import type { Card } from "../../lib/types";
import { mensajeUsuario } from "../../lib/fallas";

// Flujo formal de alta (spec 21, item 2): las tareas nacen en Pendiente con sus
// datos completos. Nunca ofrece "Marcar terminada" — eso es del ciclo de vida, no del alta.
// cards: tareas del owner para detectar duplicadas al tipear (spec 21, item 12) y para
// sugerir categorías ya usadas (spec 21, item 11: visible/asignable para todos los roles).
export function NuevaTareaModal({ ownerId, meName, cards = [], onClose }: { ownerId: string; meName: string; cards?: Card[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: settings = { categorias: [] } } = useSettings();
  // Esquema de la base (ALTA 1): sin la migración 29 la columna dato_control no existe
  // y el insert entero falla — crear una tarea dejaría de funcionar.
  const { data: migracionesAplicadas } = useMigraciones();
  const categorias = mergeCategorias(categoriasEnUso(cards), settings.categorias ?? []);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Card["priority"]>("media");
  const [effort, setEffort] = useState<Card["effort"]>(1);
  const [categoria, setCategoria] = useState("");
  const [datoControl, setDatoControl] = useState("");
  // Si se repite o no. Arranca en "una-vez" a propósito: es lo reversible. Sin esta pregunta,
  // la base asumía 'mensual' y toda tarea puntual volvía a Pendiente cada mes para siempre.
  const [tipoAlta, setTipoAlta] = useState<TipoAlta>(TIPO_ALTA_POR_DEFECTO);

  // ── Crear desde el catálogo (migración 55) ──────────────────────────────────
  //
  // EL PROBLEMA QUE RESUELVE: "Juan hace las conciliaciones de Chevrolet, pero su descripción no
  // es como la de Valentino". Con siete caminos que crean tareas y el título como texto libre, la
  // misma tarea termina escrita de siete formas y el jefe no puede comparar nada.
  //
  // TODO QUEDA EDITABLE DESPUÉS DE ELEGIR, Y ESO NO ES UN DETALLE: si la definición fuera una
  // jaula, el primer caso que no encaje se crearía por afuera y en dos semanas nadie usaría el
  // catálogo. Es un punto de partida.
  const catalogoHabilitado = tieneCatalogo(migracionesAplicadas);
  const { data: catalogo = [] } = useTareasEstandar();
  const estandares = estandaresElegibles(catalogo);
  const [estandarId, setEstandarId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Card["checklist"]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [tiempoMax, setTiempoMax] = useState<number | null>(null);

  function elegirEstandar(id: string) {
    const e = estandares.find((x) => x.id === id);
    if (!e) {
      // Volver a "ninguna" NO borra lo que la persona ya escribió: podría haber elegido una
      // definición, editado el título y después arrepentirse del vínculo. Se suelta el vínculo,
      // no el trabajo.
      setEstandarId(null);
      return;
    }
    const base = desdeEstandar(e, ownerId, null, null);
    setEstandarId(e.id);
    setTitle(base.title ?? "");
    setDescripcion(base.description ?? "");
    setChecklist(base.checklist ?? []);
    setCategoria(base.categoria ?? "");
    setEffort(base.effort ?? 1);
    setTiempoMax(base.tiempo_max_horas ?? null);
  }

  const crear = useMutation({
    mutationFn: async () => {
      const row = {
        owner: ownerId, title: title.trim(), status: "pend" as const,
        due_date: dueDate || null, priority, effort,
        categoria: categoria.trim() || null,
        dato_control: datoControl.trim() || null,
        // La descripción y el checklist sólo llegan cuando salieron del catálogo: sin él, esta
        // pantalla nunca los pidió y el comportamiento no cambia.
        description: descripcion,
        checklist,
        tiempo_max_horas: tiempoMax,
        // El vínculo con la definición. Es lo que después permite comparar la conciliación de
        // Chevrolet con la de Peugeot: sin este campo, son dos títulos parecidos y nada más.
        estandar_id: estandarId,
        // Van por `payloadCards` junto con el resto del row (ver abajo), que es el gateado
        // defensivo del esquema: nunca se manda una columna que la base todavía no tiene.
        ...camposDeAlta(tipoAlta),
        history: [{ who: meName, at: new Date().toISOString(), txt: "Creó la tarea" }],
      };
      const { error } = await supabase.from("cards").insert(payloadCards(row, migracionesAplicadas));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Tarea creada");
      onClose();
    },
    onError: (e: Error) => toast.error(mensajeUsuario(e, "crear la tarea")),
  });

  const puedeCrear = title.trim().length > 0 && !crear.isPending;

  // Advertencia de duplicadas (spec 21, item 12): no bloquea, solo avisa.
  const parecidas = title.trim().length >= 4 ? similares(title.trim(), cards) : [];
  const masParecida = parecidas[0];

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <h3 className="text-lg font-semibold m-0 mb-3.5">Nueva tarea</h3>
      <form onSubmit={(e) => { e.preventDefault(); if (puedeCrear) crear.mutate(); }}>
        {/* Va PRIMERO, arriba del título: elegir la definición completa el resto, así que
            preguntarlo después obligaría a escribir para que se lo pisen. Sin la migración 55
            (o sin ninguna definición cargada) no se muestra nada y la pantalla es la de siempre. */}
        {catalogoHabilitado && estandares.length > 0 && (
          <label className="block text-sm text-ink2 mb-3">¿Es una tarea estándar?
            <select value={estandarId ?? ""} onChange={(e) => elegirEstandar(e.target.value)}
              className="w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm mt-1">
              <option value="">No, la escribo yo</option>
              {estandares.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            {estandarId && (
              <span className="block text-2xs mt-1">
                Se completó con la definición del catálogo. Podés cambiar lo que haga falta.
              </span>
            )}
          </label>
        )}
        <label className="block text-sm text-ink2 mb-3">Título
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Conciliación bancaria de julio…"
            className="mt-1 w-full bg-surface2 border border-line rounded-lg px-2.5 py-2 text-ink text-sm outline-none focus:border-accent" />
        </label>
        <div className="flex gap-4 flex-wrap items-center text-sm text-ink2 mb-3">
          <label className="flex items-center gap-1.5">Vencimiento
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm" />
          </label>
          <label className="flex items-center gap-1.5">Prioridad
            <select value={priority} onChange={(e) => setPriority(e.target.value as Card["priority"])}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Esfuerzo
            <select value={String(effort)} onChange={(e) => setEffort(Number(e.target.value) as Card["effort"])}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm">
              <option value="1">1 — Baja</option><option value="2">2 — Media</option><option value="3">3 — Alta</option><option value="5">5 — Muy alta</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Categoría
            <input list="cats-nueva" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Sin categoría"
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-36" />
            <datalist id="cats-nueva">
              {categorias.map((cat) => <option key={cat} value={cat} />)}
            </datalist>
          </label>
          <label className="flex items-center gap-1.5">Dato de control a adjuntar
            <input value={datoControl} onChange={(e) => setDatoControl(e.target.value)}
              className="bg-surface2 border border-line rounded-lg px-2 py-1 text-ink text-sm w-36" />
          </label>
        </div>
        {/* ACÁ ESTABA LA CASILLA "No se puede cerrar con pasos sin tildar", y se sacó porque
            MENTÍA. Escribía `cards.exige_checklist` (migración 41), un flag que desde
            `transicion.ts` ya no controla nada: la regla vale para todas las tareas, con o sin
            flag, y desde la migración 53 también la aplica la base. Destildarla no desactivaba
            nada, así que ofrecerla era prometer una elección que no existía.

            La columna sigue en la base a propósito —borrarla es otra migración y no urge—, pero
            ninguna pantalla la escribe más. */}
        {/* La pregunta que faltaba. Dos opciones y nada más: lo que se necesita saber al crear
            es si la tarea vuelve o no. El default queda en "Una sola vez" (ver recurrencia-alta.ts). */}
        <div className="mb-3">
          <div className="text-sm text-ink2 mb-1.5">Repetición</div>
          <div className="flex gap-4 flex-wrap items-center text-sm text-ink">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipo-alta" value="una-vez"
                checked={tipoAlta === "una-vez"} onChange={() => setTipoAlta("una-vez")} />
              Una sola vez
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipo-alta" value="cada-mes"
                checked={tipoAlta === "cada-mes"} onChange={() => setTipoAlta("cada-mes")} />
              Todos los meses
            </label>
          </div>
          <div className="text-xs text-ink2 mt-1.5">Las de todos los meses vuelven a Pendiente cuando arranca el mes nuevo.</div>
        </div>
        {masParecida && (
          <div className="bg-warn-soft text-warn rounded-lg px-3 py-2 text-sm mb-3">
            Se detectó una tarea similar: «{masParecida.title}». Revisá antes de crear una duplicada.
          </div>
        )}
        <div className="flex gap-2 items-center pt-2">
          <button type="submit" disabled={!puedeCrear}
            className="bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3.5 py-2 text-sm disabled:opacity-60">
            {crear.isPending ? "Creando…" : masParecida ? "Crear igualmente" : "Crear tarea"}</button>
          <button type="button" onClick={onClose}
            className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
