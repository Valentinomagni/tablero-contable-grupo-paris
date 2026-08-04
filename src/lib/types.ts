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
  protected?: boolean;
  categoria?: string | null;
  reset_policy?: "mensual" | "mantener" | "manual";
  requiere_resultado?: boolean; // tarea de control (ej. arqueo): al completar pide resultado ok/dif
  sucursal?: string | null; // sucursal (migración 27)
  marca?: string | null; // marca dinámica (migración 27, consumida por Task 4)
  proc_at?: string | null; // cuándo pasó a "en proceso" (migración 29)
  tiempo_max_horas?: number | null; // SLA en horas (migración 29)
  dato_control?: string | null; // dato de control libre (migración 29)
  etiquetas?: string[]; // etiquetas contextuales múltiples, independientes de categoria (migración 31)
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
}
export interface CardArchive { id: string; owner: string; mes: string; card: Card; archived_at: string; }
export interface Empresa {
  id: string; nombre: string; cuit: string | null; cierre_balance: string | null;
  reporta_fabrica: boolean; prioridad: number; created_at: string;
}
export interface CardPausa { id: string; card_id: string; owner: string | null; desde: string; hasta: string | null; }
/**
 * Fila de la vista materializada `mv_resumen_mensual` (migración 30), tal como la
 * devuelve el RPC `public.resumen_mensual(p_mes)` — que es la ÚNICA vía de lectura:
 * las vistas materializadas no soportan RLS, así que la vista tiene el select
 * revocado y la función filtra por propio / encargado / jefe.
 */
export interface ResumenMensual {
  mes: string;        // 'YYYY-MM'
  owner: string;
  marca: string;      // 'Sin marca' cuando el snapshot no tenía marca
  total: number;
  terminadas: number;
}
export interface Consulta {
  id: string; autor: string; tipo: "consulta" | "sugerencia" | "error";
  texto: string; estado: "nueva" | "leida" | "archivada";
  respuesta: string | null; created_at: string; respondida_at: string | null;
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
