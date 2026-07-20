import type { CierreStats } from "./cierre";

// Cierre unificado (spec 27, task 6 — alternativa A de docs/PROPUESTA-CIERRE-MENSUAL.md).
// Junta las TRES piezas del cierre (checklist, archivo del mes previo, reinicio de
// recurrentes) en un solo semáforo de lectura. No cambia la mecánica: sólo cuenta el
// estado. DEFENSIVO: sin datos → pasos "pendiente", nunca crashea.

export type PasoKey = "checklist" | "archivo" | "recurrentes";
export type PasoEstado = "ok" | "pendiente" | "atencion";

export interface PasoCierre {
  key: PasoKey;
  lbl: string;
  estado: PasoEstado;
  detalle: string;
}

export interface EstadoCierre {
  pasos: PasoCierre[];
  cerrado: boolean;
}

export function estadoCierre(input: {
  checklist: CierreStats | null;
  archivadoMesPrevio: boolean;
  recurrentesOk: boolean;
}): EstadoCierre {
  const { checklist, archivadoMesPrevio, recurrentesOk } = input;

  // 1) Checklist de cierre
  let checklistEstado: PasoEstado;
  let checklistDetalle: string;
  if (checklist === null) {
    checklistEstado = "pendiente";
    checklistDetalle = "Todavía no se generó el checklist de este mes.";
  } else if (checklist.pct === 100) {
    checklistEstado = "ok";
    checklistDetalle = `${checklist.done} de ${checklist.total} tareas cerradas`;
  } else {
    checklistEstado = "atencion";
    checklistDetalle = `${checklist.done} de ${checklist.total} tareas cerradas`;
  }

  // 2) Archivo del mes previo
  const archivoEstado: PasoEstado = archivadoMesPrevio ? "ok" : "pendiente";
  const archivoDetalle = archivadoMesPrevio
    ? "El mes pasado quedó guardado en el historial."
    : "El archivo del mes pasado se genera solo al cambiar de mes (cron).";

  // 3) Reinicio de recurrentes
  const recurrentesEstado: PasoEstado = recurrentesOk ? "ok" : "atencion";
  const recurrentesDetalle = recurrentesOk
    ? "Las tareas recurrentes arrancaron el mes en cero."
    : "Todavía hay tareas recurrentes del mes pasado sin reiniciar.";

  const pasos: PasoCierre[] = [
    { key: "checklist", lbl: "Tareas del cierre", estado: checklistEstado, detalle: checklistDetalle },
    { key: "archivo", lbl: "Foto del mes guardada", estado: archivoEstado, detalle: archivoDetalle },
    { key: "recurrentes", lbl: "Tareas del mes nuevo", estado: recurrentesEstado, detalle: recurrentesDetalle },
  ];

  const cerrado = pasos.every((p) => p.estado === "ok");
  return { pasos, cerrado };
}
