import type { CierreStats } from "./cierre";
import type { Card, Snapshot } from "./types";
import { diasHabilesDelRango } from "./ociosidad";

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

// J8 — proyección "al ritmo actual, ¿el cierre llega a tiempo?" (spec 28, task 9).
// `daily_snapshots.done_count` es DIARIO, no acumulado (ver migracion-11.sql: "cerradas
// ESE día" + upsert por (day, owner)): el ritmo se saca SUMANDO los done_count de la
// ventana, no restando snapshots consecutivos.
// DEFENSIVO: sin ritmo medible (0 tareas/día en la ventana) no se proyecta nada — es
// mejor callar que dar una falsa alarma sin datos. Por eso `alcanza: true` en ese caso.

export interface ProyeccionCierre {
  ritmoDiario: number;
  faltan: number;
  alcanza: boolean;
  diasNecesarios: number | null;
}

export function proyeccionCierre(
  closing: Card[],
  snapshots: Snapshot[],
  hoyISO: string,
  finDeMesISO: string,
): ProyeccionCierre {
  const faltan = (closing ?? []).filter((c) => c.status !== "term").length;

  // Ritmo: promedio de tareas cerradas por día hábil en los últimos 7 días CALENDARIO,
  // sin contar hoy (todavía no terminó), y sólo de los dueños del cierre analizado.
  const owners = new Set((closing ?? []).map((c) => c.owner));
  const hoy = new Date(hoyISO + "T12:00:00");
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - 7);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const desdeISO = desde.toISOString().slice(0, 10);
  const ayerISO = ayer.toISOString().slice(0, 10);

  const diasHabilesVentana = diasHabilesDelRango(desdeISO, ayerISO).length;
  const cerradasVentana = (snapshots ?? [])
    .filter((s) => owners.has(s.owner) && s.day.slice(0, 10) >= desdeISO && s.day.slice(0, 10) <= ayerISO)
    .reduce((acc, s) => acc + s.done_count, 0);
  const ritmoDiario = diasHabilesVentana > 0 ? cerradasVentana / diasHabilesVentana : 0;

  if (faltan === 0) return { ritmoDiario, faltan, alcanza: true, diasNecesarios: 0 };
  if (ritmoDiario === 0) return { ritmoDiario, faltan, alcanza: true, diasNecesarios: null };

  const diasNecesarios = Math.ceil(faltan / ritmoDiario);
  const restantes = diasHabilesDelRango(hoyISO, finDeMesISO).length;
  const alcanza = diasNecesarios <= restantes;
  return { ritmoDiario, faltan, alcanza, diasNecesarios };
}
