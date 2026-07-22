import type { Announcement, Card, NotifTipo, Role } from "./types";

// Reglas puras de notificaciones (spec #8): deciden QUÉ notificar y a quién según rol
// e impacto, SIN redundancia. La escritura en la tabla `notifications` es best-effort
// en los puntos de acción (delegar, finalizar): si la migración 21 no está aplicada,
// la operación principal se hace igual y la notificación se descarta en silencio.

export interface NotifInsert {
  owner: string; tipo: NotifTipo; titulo: string; detalle: string; card_id: string | null;
}

type Impactable = Pick<Card, "priority" | "due_date">;

// Impacto: prioridad alta O con vencimiento. Lo demás es ruido para el equipo.
export function tieneImpacto(c: Impactable): boolean {
  return c.priority === "alta" || !!c.due_date;
}

export type Evento =
  | { kind: "delegacion" }
  | { kind: "asignacion" }
  | { kind: "dep_liberada" }
  | ({ kind: "finalizacion" } & Impactable)
  | ({ kind: "vencida" } & Impactable);

// Relevancia por rol destino (anti-ruido):
// - Empleado: lo que le pasa a ÉL (asignación/delegación, dependencia liberada).
// - Encargado/Jefe: además, finalizaciones y vencidas de su gente SOLO con impacto.
// - Nadie recibe finalizaciones sin impacto (prioridad != alta y sin vencimiento).
export function esRelevante(e: Evento, rolDestino: Role): boolean {
  switch (e.kind) {
    case "delegacion":
    case "asignacion":
    case "dep_liberada":
      return true;
    case "finalizacion":
    case "vencida":
      return rolDestino !== "empleado" && tieneImpacto(e);
  }
}

// Al delegar: una notificación por receptor (nunca al propio delegador).
export function notifsAlDelegar(p: {
  delegadorId: string; delegadorName: string; title: string; at: string;
  destinos: { owner: string; cardId: string | null }[];
}): NotifInsert[] {
  return p.destinos
    .filter((d) => d.owner !== p.delegadorId)
    .map((d) => ({
      owner: d.owner, tipo: "delegacion" as const, titulo: "Te delegaron una tarea",
      detalle: `${p.delegadorName} te delegó "${p.title.trim()}"`, card_id: d.cardId,
    }));
}

// Al finalizar una tarea CON impacto: aviso al manager del dueño (encargado o jefe).
// Sin impacto, sin manager o auto-finalización del propio manager → nada (anti-ruido).
export function notifsAlFinalizar(p: {
  card: Pick<Card, "id" | "title" | "priority" | "due_date">;
  actorId: string; actorName: string; managerId: string | null | undefined;
}): NotifInsert[] {
  if (!tieneImpacto(p.card)) return [];
  if (!p.managerId || p.managerId === p.actorId) return [];
  return [{
    owner: p.managerId, tipo: "avance", titulo: "Tarea importante terminada",
    detalle: `${p.actorName} terminó "${p.card.title}"${p.card.priority === "alta" ? " (prioridad alta)" : ""}`,
    card_id: p.card.id,
  }];
}

// ¿El cliente tiene que insertar la notificación de finalización, o ya la genera la base?
// (spec 28 fase C, Task 11.)
//
// Desde la migración 30 existe el trigger `cards_notificar_finalizacion`, que hace
// EXACTAMENTE lo mismo que notifsAlFinalizar() pero del lado del servidor. Las dos vías
// no pueden convivir:
//   - trigger activo + insert del cliente → CADA finalización avisa DOS veces.
//   - trigger apagado + sin insert        → NADIE recibe nada, y nadie se entera.
//
// `triggerActivo` viene de useTriggerNotificaciones(), que llama al RPC
// `public.trigger_notificaciones_activo()`: ese RPC lee pg_trigger.tgenabled, o sea la
// verdad real. NO se deduce del número de migración: la 30 puede estar aplicada y el
// trigger seguir apagado, porque activarlo es un paso manual aparte.
//
// CRITERIO ANTE LO DESCONOCIDO (null/undefined: query cargando, sin red, RPC inexistente
// porque la 30 no corrió): el cliente SÍ inserta. Es la asimetría del daño — un duplicado
// ocasional es una molestia visible y transitoria, mientras que un silencio es una falla
// invisible y permanente: el encargado nunca se entera de que dejó de recibir avisos.
export function debeNotificarDesdeCliente(triggerActivo: boolean | null | undefined): boolean {
  return triggerActivo !== true;
}

// E8: avisos propios (tablón) cuyo vencimiento es hoy o mañana (fecha calendario ART),
// para autonotificar al dueño. `hoyISO` viene ya calculado por el caller (toARTDate).
// Excluye: de otro dueño, archivados, sin due_date, fuera de la ventana hoy/mañana,
// y los que ya generaron notificación (yaNotificados: ids de aviso ya referenciados).
// NOTA: Deduplicación es por id de aviso, NO por (id + día). Un aviso que pasa de
// "vence mañana" a "vence hoy" NO genera segunda notificación (decisión anti-spam).
export function avisosParaNotificar(
  annos: Announcement[], meId: string, hoyISO: string, yaNotificados: string[],
): Announcement[] {
  const manana = new Date(hoyISO + "T00:00:00Z");
  manana.setUTCDate(manana.getUTCDate() + 1);
  const mananaISO = manana.toISOString().slice(0, 10);
  return annos.filter((a) =>
    a.owner_id === meId &&
    !a.archivado &&
    !!a.due_date &&
    (a.due_date === hoyISO || a.due_date === mananaISO) &&
    !yaNotificados.includes(a.id),
  );
}

// Tiempo relativo corto para el panel ("recién", "hace 15 min", "hace 3 h", "hace 2 días").
export function tiempoRelativo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
