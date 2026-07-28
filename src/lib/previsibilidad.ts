import type { Card } from "./types";

// Previsibilidad: cuánto del trabajo del mes estaba previsto y cuánto entró de golpe.
//
// POR QUÉ IMPORTA EL ENCUADRE: esta métrica mide a la ORGANIZACIÓN, no a las personas. Si un
// mes el 60% entra como urgencia, el problema es de planificación del área —no de quien la
// ejecutó—. Es de las pocas métricas que apunta hacia arriba, y por eso vale la pena.
//
// HEURÍSTICA (explícita, para no confundirla con una verdad): se considera PLANIFICADA la
// tarea creada ANTES del mes en que vence, e IMPREVISTA la creada dentro de ese mismo mes.
// No es perfecta —alguien puede cargar tarde una tarea que sabía—, pero no requiere que
// nadie complete un campo nuevo, y por eso no se degrada con el uso.
//
// PURA: el mes entra por parámetro.

export interface Previsibilidad {
  planificadas: number;
  imprevistas: number;
  total: number;
  pctPlanificado: number;
  /** true cuando las urgencias superan a lo planificado: señal para revisar el proceso. */
  alerta: boolean;
}

const VACIO: Previsibilidad = { planificadas: 0, imprevistas: 0, total: 0, pctPlanificado: 0, alerta: false };

export function previsibilidad(cards: Card[], mes: string): Previsibilidad {
  if (!Array.isArray(cards)) return { ...VACIO };
  let planificadas = 0, imprevistas = 0;
  for (const c of cards) {
    // Sin vencimiento no hay nada que planificar; las operativas son a demanda por diseño.
    if (!c?.due_date || c.card_type === "operativa") continue;
    if (!c.due_date.startsWith(mes)) continue;
    const creadaEn = (c.created_at ?? "").slice(0, 7);
    if (!creadaEn) continue;
    if (creadaEn < mes) planificadas++; else imprevistas++;
  }
  const total = planificadas + imprevistas;
  if (total === 0) return { ...VACIO };
  return {
    planificadas, imprevistas, total,
    pctPlanificado: Math.round((planificadas / total) * 100),
    alerta: imprevistas > planificadas,
  };
}
