export type Role = "jefe" | "encargado" | "empleado";
export type Status = "pend" | "proc" | "term";

export interface Profile { id: string; name: string; role: Role; email: string; username: string | null; puesto: string; ficha: string; manager_id: string | null; marca: string | null; sucursal?: string | null; oculto?: boolean; last_seen?: string | null;
  // Administrador del sistema (migración 33): usuario fantasma APARTE — no es ningún
  // empleado. Recibe las consultas/errores del equipo en lugar del jefe. Va siempre
  // junto con oculto=true, así no aparece en listados ni métricas.
  admin_sistema?: boolean; }
export interface ChecklistItem { txt: string; done: boolean; done_at: string | null; }
export interface RecurRule { tipo: "diaria" | "semanal" | "mensual"; dias?: number[]; diaMes?: number; }
export interface TaskOccurrence {
  id: string; card_id: string; owner: string; fecha: string; done: boolean; done_at: string | null;
  // Resultado de control (migración 23, arqueo de caja): 'ok' sin diferencias, 'dif' con diferencias
  resultado?: "ok" | "dif" | null; dif_importe?: number | null; dif_obs?: string | null;
  // Detalle DEL DÍA (migración 34, queja #2): cada fecha tiene su propio checklist y su
  // observación. Antes había uno solo en la card, compartido por todas las fechas, y al
  // reiniciarse la recurrencia se perdía lo tildado ayer. Opcionales: sin la migración 34
  // aplicada las columnas no existen y llegan `undefined`.
  checklist?: ChecklistItem[]; obs?: string | null;
}
export interface Comment { who: string; when: string; txt: string; }
export interface HistoryEntry { who: string; at: string; txt: string; }
export interface Card {
  id: string; owner: string; title: string; status: Status; description: string;
  checklist: ChecklistItem[]; comments: Comment[]; history: HistoryEntry[];
  done_at: string | null; due_date: string | null; recurring: boolean;
  priority: "alta" | "media" | "baja"; effort: 1 | 2 | 3 | 5;
  card_type: "normal" | "operativa"; deps: string[]; created_at: string;
  recur_rule?: RecurRule | null;
  /**
   * Área externa que tiene trabada esta tarea (migración 54). `null` = no está trabada.
   *
   * NO es una dependencia: `deps` es tarea-a-tarea y sólo funciona entre tareas que existen acá.
   * Ventas no usa el tablero y no lo va a usar. Esto registra una espera, que es otra cosa.
   *
   * Para qué sirve: hoy, cuando el trabajo se traba por otra área, esa demora aparece como
   * demora del equipo contable. El jefe ve tareas quietas y no tiene cómo saber que la pelota
   * está afuera.
   */
  bloqueo_area?: string | null;
  /**
   * Desde cuándo espera. Va junta con `bloqueo_area` — la base tiene un check que exige las dos
   * o ninguna.
   *
   * Sin la fecha, "bloqueada por Ventas" es una etiqueta con la que no se puede hacer nada: no
   * se sabe si espera hace un día o hace un mes. Con fecha es "hace 6 días hábiles", y con eso
   * alguien puede levantar el teléfono.
   */
  bloqueo_desde?: string | null;
  protected?: boolean;
  categoria?: string | null;
  reset_policy?: "mensual" | "mantener" | "manual";
  requiere_resultado?: boolean; // tarea de control (ej. arqueo): al completar pide resultado ok/dif
  exige_checklist?: boolean;   // VESTIGIAL (migracion 41): ya no controla nada. La regla del checklist vale para todas las tareas (transicion.ts + migracion 53). La columna sigue en la base; ninguna pantalla la escribe.
  sucursal?: string | null; // sucursal (migración 27)
  marca?: string | null; // marca dinámica (migración 27, consumida por Task 4)
  proc_at?: string | null; // cuándo pasó a "en proceso" (migración 29)
  tiempo_max_horas?: number | null; // SLA en horas (migración 29)
  dato_control?: string | null; // dato de control libre (migración 29)
  etiquetas?: string[]; // etiquetas contextuales múltiples, independientes de categoria (migración 31)
  /**
   * De qué definición del catálogo salió esta tarea (migración 55). `null`/ausente = se creó a
   * mano, que sigue estando permitido y no es un error.
   *
   * Es el campo que permite comparar: sin él, "Conciliación Chevrolet" de una persona y
   * "Concil. bancaria Chevrolet" de otra son dos filas de texto libre que nadie puede sumar.
   *
   * OJO — apuntar a una definición NO ata la tarea a ella. El título, la descripción y el
   * checklist se copian al crearla y después se editan libremente; este campo sólo recuerda el
   * origen. La foránea es `on delete set null`: si se borra la definición, la tarea sigue.
   */
  estandar_id?: string | null;
}
/**
 * Una tarea estándar del catálogo (migración 55): la definición canónica de un trabajo que se
 * repite en varias marcas, empresas o personas.
 *
 * POR QUÉ EXISTE, con las palabras del dueño: *"Juan hace las conciliaciones de Chevrolet, pero
 * su descripción no es como la de Valentino. Si son las mismas tareas, diferente empresa o
 * marca, deberíamos tenerlo igual para que mi jefe pueda comparar y además para que nos sirva de
 * dato general."*
 *
 * NO reemplaza a `AppSettings.closing_template` (`plantilla.ts`), que es una lista plana para
 * GENERAR las tareas del mes. Esto define QUÉ ES una tarea, y tiene un id al que la tarjeta
 * creada puede apuntar — que es lo que la lista plana no puede dar.
 *
 * `activa` es baja lógica: una definición nunca se borra, porque las tareas viejas siguen
 * apuntando a ella y el histórico tiene que poder decir de dónde salieron.
 */
export interface TareaEstandar {
  id: string;
  nombre: string;
  descripcion: string;
  /** Pasos sugeridos. Al instanciar SE COPIAN, no se referencian — ver `src/lib/catalogo.ts`. */
  checklist: ChecklistItem[];
  categoria: string | null;
  effort: 1 | 2 | 3 | 5;
  /** Horas máximas propias de esta tarea. `null` = manda el tiempo máximo de la categoría. */
  tiempo_max_horas: number | null;
  activa: boolean;
  created_at: string;
}
/**
 * Estado de trabajo de una card en un período mensual (migración 32, propuesta de
 * períodos Fase 0). Una fila por (card_id, periodo 'YYYY-MM'): junio y julio de la
 * misma tarea son filas distintas y nunca se pisan. Los campos de DEFINICIÓN
 * (title, owner, recur_rule, priority, effort, deps, categoria, etiquetas) viven en
 * `cards`; acá vive sólo el ESTADO del mes. Ver src/lib/periodo-instancias.ts.
 */
export interface CardPeriodo {
  id: string; card_id: string; owner: string; periodo: string; status: Status;
  checklist: ChecklistItem[]; comments: Comment[]; history: HistoryEntry[];
  done_at: string | null; proc_at: string | null; due_date: string | null; created_at: string;
  /**
   * Cuándo el reinicio mensual volcó esta fila sobre `cards` (migración 51). `null` mientras el
   * mes sigue siendo futuro.
   *
   * POR QUÉ EXISTE. `card_periodos` es el borrador de un mes que todavía no llegó. Cuando ese mes
   * pasa a ser el vigente, la app deja de leer de acá y lee de `cards`, así que el reinicio tiene
   * que volcar el trabajo adelantado o desaparece (hallazgo 4 de la auditoría del 05/08).
   *
   * Y una vez volcada, la fila NO se puede seguir leyendo: si el mes más adelante deja de ser
   * vigente, mergearla otra vez mostraría la foto adelantada por encima de todo lo que se hizo
   * durante el mes. Se marca en vez de borrarse — borrar seria irreversible y esto deja ver
   * cuándo se volcó cada cosa.
   */
  aplicado_at?: string | null;
}
export interface CardArchive { id: string; owner: string; mes: string; card: Card; archived_at: string; }
export interface Empresa {
  id: string; nombre: string; cuit: string | null; cierre_balance: string | null;
  reporta_fabrica: boolean; prioridad: number; created_at: string;
}
export interface CardPausa { id: string; card_id: string; owner: string | null; desde: string; hasta: string | null; }
/**
 * Un día que la oficina no trabaja, cargado a mano por el jefe (migración 48).
 *
 * Los sábados y domingos NO viven acá: los calcula `src/lib/dias-habiles.ts`. Esta tabla es
 * sólo para lo que hay que decidir — feriados móviles, puentes por decreto, y días propios de
 * la empresa como un inventario o una capacitación. Ninguna lista fija los cubre.
 *
 * `motivo` es texto libre corto y existe para que dentro de un año se sepa por qué ese día no
 * contaba: un feriado sin explicación se parece demasiado a un error de carga.
 */
export interface DiaNoLaborable { fecha: string; motivo: string; }
export interface Consulta {
  id: string; autor: string; tipo: "consulta" | "sugerencia" | "error";
  texto: string; estado: "nueva" | "leida" | "archivada";
  respuesta: string | null; created_at: string; respondida_at: string | null;
  /**
   * Ruta de la captura dentro del bucket privado `consultas` (migración 52). `null` si no
   * mandó ninguna.
   *
   * El bucket NO es público: la imagen sólo se abre con una URL firmada, y la policy la
   * concede al autor y a la cuenta de administración. El jefe no.
   */
  adjunto_path?: string | null;
}
export interface CierrePeriodo { id: string; owner: string; mes: string; cerrado_at: string; nota: string | null; }
export interface Objective {
  id: string; owner: string; title: string; description: string; weight: number;
  kpi_name: string; kpi_unit: string; kpi_target: number | null; kpi_current: number; notes: string;
}
export interface Announcement {
  id: string; kind: "vencimiento" | "aviso" | "proceso"; title: string; detail: string;
  due_date: string | null; created_by: string; created_at: string;
  owner_id: string | null; visible_to: string[];
  // Migración 23 (tablón útil): opcionales para bases sin migrar
  prioridad?: "normal" | "importante" | "urgente";
  vigente_hasta?: string | null;
  archivado?: boolean;
}
export interface Vacacion {
  id: string; owner: string; desde: string; hasta: string; motivo: string;
  reemplazante: string | null; notas: string; created_by: string | null; created_at: string;
}
export interface Note { id: string; owner: string; title: string; body: string; archived: boolean; created_at: string; updated_at: string; }
export type NotifTipo = "asignacion" | "delegacion" | "vencida" | "dep_liberada" | "avance" | "sin_asignar" | "sistema" | "vencimiento_propio";
export interface Notification {
  id: string; owner: string; tipo: NotifTipo; titulo: string; detalle: string;
  card_id: string | null; leida: boolean; created_at: string;
}
export interface ActivityLog { id: string; card_id: string; owner: string; who_name: string; qty: number; note: string; at: string; }
export interface Snapshot { day: string; owner: string; open_count: number; open_effort: number; done_count: number; done_effort: number; activity_qty: number; }
export interface AppSettings {
  edit_closed: boolean; board_name?: string; due_warn_days?: number; stuck_days?: number;
  closing_template?: import("./plantilla").TemplateItem[];
  categorias?: string[];
  plantillas?: PlantillaTareas[];
  /** Pesos del orden sugerido: el criterio de qué va primero, escrito y configurable. */
  pesos_prioridad?: import("./prioridad-calculada").PesosPrioridad;
}
export interface PlantillaTareas {
  nombre: string;
  categoria: string;
  items: { titulo: string; owner?: string; effort?: 1 | 2 | 3 | 5; priority?: "alta" | "media" | "baja" }[];
}

export const COLS: [Status, string][] = [["pend", "Pendiente"], ["proc", "En proceso"], ["term", "Terminado"]];
