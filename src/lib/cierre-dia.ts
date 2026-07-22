// Cierre del día (spec 28, task 2) — semáforo de repaso personal al final de la jornada.
// Es una ayuda para el propio empleado, NO un control: repasa lo que ya se hizo hoy,
// no audita lo pendiente. Un paso que no aplica no se muestra. DEFENSIVO: sin nada
// aplicable, listo: true y pasos: [] (no hay nada que cerrar).

export type PasoDiaKey = "arqueo" | "vencenHoy" | "operativas";
export type PasoDiaEstado = "ok" | "pendiente";

export interface PasoDia {
  key: PasoDiaKey;
  lbl: string;
  estado: PasoDiaEstado;
  detalle: string;
}

export function cierreDelDia(input: {
  arqueoHoy: { existe: boolean; hecho: boolean };
  vencenHoy: { total: number; cerradas: number };
  operativas: { total: number; conActividadHoy: number };
}): { pasos: PasoDia[]; listo: boolean } {
  const { arqueoHoy, vencenHoy, operativas } = input;
  const pasos: PasoDia[] = [];

  if (arqueoHoy.existe) {
    pasos.push({
      key: "arqueo",
      lbl: "Arqueo de hoy",
      estado: arqueoHoy.hecho ? "ok" : "pendiente",
      detalle: arqueoHoy.hecho ? "Ya quedó registrado." : "Todavía no lo registraste.",
    });
  }

  if (vencenHoy.total > 0) {
    const ok = vencenHoy.cerradas >= vencenHoy.total;
    pasos.push({
      key: "vencenHoy",
      lbl: "Tareas que vencían hoy",
      estado: ok ? "ok" : "pendiente",
      detalle: `${vencenHoy.cerradas} de ${vencenHoy.total} cerradas`,
    });
  }

  if (operativas.total > 0) {
    const ok = operativas.conActividadHoy >= operativas.total;
    pasos.push({
      key: "operativas",
      lbl: "Tareas operativas del día",
      estado: ok ? "ok" : "pendiente",
      detalle: `${operativas.conActividadHoy} de ${operativas.total} con movimiento hoy`,
    });
  }

  const listo = pasos.every((p) => p.estado === "ok");
  return { pasos, listo };
}
