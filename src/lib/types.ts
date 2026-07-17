export type Role = "jefe" | "encargado" | "empleado";
export type Status = "pend" | "proc" | "term";

export interface Profile { id: string; name: string; role: Role; email: string; username: string | null; puesto: string; ficha: string; manager_id: string | null; marca: string | null; }
export interface ChecklistItem { txt: string; done: boolean; done_at: string | null; }
export interface RecurRule { tipo: "diaria" | "semanal" | "mensual"; dias?: number[]; diaMes?: number; }
export interface TaskOccurrence {
  id: string; card_id: string; owner: string; fecha: string; done: boolean; done_at: string | null;
  // Resultado de control (migración 23, arqueo de caja): 'ok' sin diferencias, 'dif' con diferencias
  resultado?: "ok" | "dif" | null; dif_importe?: number | null; dif_obs?: string | null;
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
}
export interface CardArchive { id: string; owner: string; mes: string; card: Card; archived_at: string; }
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
export type NotifTipo = "asignacion" | "delegacion" | "vencida" | "dep_liberada" | "avance" | "sin_asignar" | "sistema";
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
}

export const COLS: [Status, string][] = [["pend", "Pendiente"], ["proc", "En proceso"], ["term", "Terminado"]];
