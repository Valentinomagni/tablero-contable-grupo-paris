import type { ResultadoICR } from "./icr";
import type { Exposicion } from "./exposicion";
import type { SaludOperativa } from "./salud-operativa";
import type { Concentracion } from "./busfactor";
import type { Previsibilidad } from "./previsibilidad";
import type { FlujoPersona } from "./flujo-mensual";

// Motor de recomendaciones (idea 48 de la tormenta de ideas).
//
// ESTO NO ES IA. Es un motor de REGLAS: toma señales que las libs ya calculan y las convierte
// en frases accionables. Que no sea IA es una ventaja, no una limitación — cada recomendación
// es explicable, reproducible y auditable: siempre se puede decir exactamente qué número la
// disparó (por eso cada una lleva su `motivo`).
//
// LA REGLA MÁS IMPORTANTE — EL ICR MANDA:
// Si el propio sistema declara que el registro no es representativo, el motor NO recomienda
// sobre el trabajo: recomienda arreglar el registro y se calla. Recomendar sobre datos que
// sabemos malos es peor que no recomendar nada, porque una sugerencia con formato de
// conclusión se lee como verdad. Esta es la diferencia entre un motor útil y un generador
// de ruido con aires de autoridad.
//
// ENCUADRE (regla dura del proyecto): las recomendaciones apuntan a REPARTIR, DESBLOQUEAR o
// FORMAR RESPALDO. Cuando aparece un nombre es para saber a quién acompañar, nunca para
// señalar a quién culpar. Los tests verifican explícitamente que no aparezcan palabras de
// reproche.

export type Prioridad = "alta" | "media" | "baja";

export interface Recomendacion {
  id: string;
  prioridad: Prioridad;
  /** Qué conviene hacer, en lenguaje de usuario. */
  texto: string;
  /** En qué dato se basa. Hace la recomendación auditable en vez de un oráculo. */
  motivo: string;
}

export interface SenalesRecomendacion {
  icr: ResultadoICR;
  exposiciones: Exposicion[];
  salud: SaludOperativa;
  concentraciones: Concentracion[];
  previsibilidad: Previsibilidad;
  flujo: FlujoPersona[];
  /** Para no filtrar uuids crudos a la pantalla. */
  nombrePorId: Record<string, string>;
}

/** Por debajo de esto el dato no sostiene ninguna conclusión (ver docs/PROPUESTA-ICR.md 3.4). */
export const ICR_MINIMO_PARA_RECOMENDAR = 50;

/** A partir de cuántas tareas abiertas en paralelo conviene sugerir repartir. */
const MULTITAREA_ALTA = 10;

const ORDEN: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

export function recomendaciones(s: SenalesRecomendacion): Recomendacion[] {
  if (!s || typeof s !== "object") return [];
  const nombre = (id: string) => s.nombrePorId?.[id] ?? "—";

  // ---- Compuerta del ICR: antes de cualquier otra regla ----
  const icr = s.icr;
  if (!icr) return [];
  if (!icr.suficiente) {
    return [{
      id: "muestra-chica",
      prioridad: "baja",
      texto: "Todavía no hay suficiente trabajo cerrado para sacar conclusiones. Con más movimiento registrado, acá van a aparecer sugerencias concretas.",
      motivo: `Sólo ${icr.muestra} tareas cerradas en los últimos 30 días.`,
    }];
  }
  if ((icr.puntaje ?? 0) < ICR_MINIMO_PARA_RECOMENDAR) {
    return [{
      id: "icr-bajo",
      prioridad: "alta",
      texto: "Antes de sacar conclusiones conviene mejorar cómo se registra el trabajo: mover la tarea a “En proceso” al empezarla y cerrarla el día que se termina. Con el registro al día, las métricas empiezan a representar lo que realmente pasa.",
      motivo: `La calidad del registro es de ${icr.puntaje}/100, por debajo de ${ICR_MINIMO_PARA_RECOMENDAR}. ${icr.lectura}`,
    }];
  }

  const out: Recomendacion[] = [];

  // ---- Vencimientos inminentes ----
  const manana = (s.exposiciones ?? []).find((e) => e.horizonte === 1);
  if (manana && manana.total > 0) {
    const top = manana.porCategoria?.[0];
    out.push({
      id: "vence-manana",
      prioridad: "alta",
      texto: top
        ? `Hay ${manana.total} ${manana.total === 1 ? "tarea que vence" : "tareas que vencen"} mañana, sobre todo de ${top.categoria}. Conviene resolverlas hoy.`
        : `Hay ${manana.total} ${manana.total === 1 ? "tarea que vence" : "tareas que vencen"} mañana. Conviene resolverlas hoy.`,
      motivo: "Tareas abiertas con vencimiento dentro de las próximas 24 horas.",
    });
  }

  // ---- Concentración de conocimiento (bus factor) ----
  for (const c of s.concentraciones ?? []) {
    out.push({
      id: `concentracion-${c.categoria}`,
      prioridad: "media",
      texto: `${c.categoria} lo resuelve casi siempre la misma persona (${c.principal}). Conviene formar un respaldo para que el proceso no dependa de una sola.`,
      motivo: `${c.pct}% del trabajo histórico de esa categoría lo hizo una sola persona.`,
    });
  }

  // ---- Previsibilidad: apunta al proceso, no a quien ejecuta ----
  if (s.previsibilidad?.alerta) {
    out.push({
      id: "previsibilidad",
      prioridad: "media",
      texto: "Este mes entraron más urgencias que trabajo planificado. Conviene revisar cómo se planifica el mes: cuando casi todo es urgente, el equipo trabaja a demanda y no se puede anticipar nada.",
      motivo: `Sólo el ${s.previsibilidad.pctPlanificado}% del trabajo del mes estaba previsto.`,
    });
  }

  // ---- Carga concentrada al cierre ----
  for (const f of s.flujo ?? []) {
    if (f?.perfil !== "tardio") continue;
    out.push({
      id: `flujo-tardio-${f.owner}`,
      prioridad: "baja",
      texto: `El trabajo de ${nombre(f.owner)} se concentra sobre el cierre del mes. Si parte se puede adelantar a la primera semana, se descomprime el final.`,
      motivo: `La mayor parte de su carga cae en la segunda mitad del mes (pico el día ${f.picoDia}).`,
    });
  }

  // ---- Demasiadas cosas abiertas a la vez ----
  for (const m of s.salud?.multitarea ?? []) {
    if (!m || m.abiertas < MULTITAREA_ALTA) continue;
    out.push({
      id: `multitarea-${m.owner}`,
      prioridad: "baja",
      texto: `${nombre(m.owner)} tiene ${m.abiertas} tareas abiertas al mismo tiempo. Repartir algunas ayuda a que todas avancen más rápido.`,
      motivo: "Muchas tareas en paralelo hacen que cada una tarde más en terminarse.",
    });
  }

  // Orden estable: dentro de cada prioridad se respeta el orden en que se generaron.
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ORDEN[a.r.prioridad] - ORDEN[b.r.prioridad] || a.i - b.i)
    .map(({ r }) => r);
}
