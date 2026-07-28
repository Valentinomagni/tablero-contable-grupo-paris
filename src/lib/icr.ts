// ICR — Índice de Calidad del Registro (ver docs/PROPUESTA-ICR.md, secciones 3.2 y 3.5).
//
// ENCUADRE (regla dura del proyecto, no un comentario decorativo): este indicador califica
// AL DATO, no a la persona. Un ICR bajo significa que las métricas de tiempo de ese conjunto
// no son representativas y no deberían usarse para decidir — nunca que alguien trabajó mal.
// Por eso no hay ranking entre personas acá y la lectura viaja pegada al número.
//
// Función PURA: la fecha entra por `hoyISO`. Prohibido `new Date()` sin argumento adentro.
import type { Card } from "./types";
import { TXT_REAPERTURA } from "./retrabajo";

export interface FactorICR {
  clave: "F1" | "F2" | "F3" | "F4" | "F5";
  nombre: string;
  valor: number; // 0..1
  peso: number;  // los cinco pesos suman exactamente 100
}

export interface ResultadoICR {
  puntaje: number | null;
  muestra: number;
  suficiente: boolean;
  factores: FactorICR[];
  lectura: string;
}

// SALVAGUARDA 4: umbral de muestra mínima. Con pocas tareas el índice es ruido, y publicar
// un número basado en 3 casos invita a conclusiones falsas. Mismo criterio que puntualidad.ts:
// si la muestra no alcanza, no se publica el número (null), no se maquilla.
export const MUESTRA_MINIMA = 8;

export const LECTURA_ICR = "Un ICR bajo invalida las métricas de ese conjunto, no a la persona.";

const DIA = 86400000;
const DIEZ_MIN = 10 * 60000;
const VENTANA_DIAS = 30;

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Última señal real de trabajo: la entrada de history más reciente por `at`. */
function ultimaSenal(c: Card): number | null {
  const historial = c.history ?? [];
  let max: number | null = null;
  for (const h of historial) {
    const t = ms(h.at);
    if (t !== null && (max === null || t > max)) max = t;
  }
  // Sin historial, la única señal disponible es proc_at. No inventamos una señal que no existe.
  return max ?? ms(c.proc_at);
}

function tieneReapertura(c: Card): boolean {
  // El texto viene de retrabajo.ts a propósito: ese archivo advierte que el literal debe
  // vivir en un solo lugar para que las tres vías de UI sigan siendo detectables.
  return (c.history ?? []).some((h) => h.txt === TXT_REAPERTURA);
}

/** Proporción sobre una muestra; sin muestra devuelve 1 (no penalizamos lo que no se puede medir). */
const proporcion = (aciertos: number, total: number): number => (total === 0 ? 1 : aciertos / total);

export function icr(cards: Card[], hoyISO: string): ResultadoICR {
  const lista = Array.isArray(cards) ? cards : [];
  const hoy = ms(hoyISO) ?? 0;
  const desde = hoy - VENTANA_DIAS * DIA;

  // SALVAGUARDA 5: las tareas operativas recurrentes por diseño no pasan por "En proceso".
  // Contarlas como falla de trazabilidad sería castigar al usuario por seguir el proceso
  // previsto, así que se excluyen de toda la muestra.
  const elegibles = lista.filter((c) => c.card_type !== "operativa");

  // Ventana: sólo lo cerrado en los últimos 30 días respecto de hoyISO.
  const cerradas = elegibles.filter((c) => {
    if (c.status !== "term") return false;
    const t = ms(c.done_at);
    return t !== null && t >= desde && t <= hoy;
  });

  const muestra = cerradas.length;
  const suficiente = muestra >= MUESTRA_MINIMA;

  // F1 — Trazabilidad de estados. Sin un proc_at real y anterior al cierre, ninguna métrica
  // de tiempo existe. Es el factor fundacional y el más fácil de corregir.
  const trazables = cerradas.filter((c) => {
    const p = ms(c.proc_at);
    const d = ms(c.done_at);
    return p !== null && d !== null && p < d;
  }).length;
  const f1 = proporcion(trazables, muestra);

  // F2 — Registro no colapsado: marcar "En proceso" recién al terminar.
  // SALVAGUARDA 1: penaliza SÓLO la combinación de duración registrada < 10 minutos CON una
  // tarea que venía viva hace más de 1 día. Sin la segunda condición se castigaría a quien
  // hace tareas legítimamente cortas, que no es un defecto de registro sino trabajo rápido.
  // SALVAGUARDA 2: ningún factor mide duración absoluta; el ICR nunca premia terminar rápido.
  const colapsadas = cerradas.filter((c) => {
    const p = ms(c.proc_at);
    const d = ms(c.done_at);
    const cr = ms(c.created_at);
    if (p === null || d === null || cr === null) return false;
    return d - p < DIEZ_MIN && d - cr > DIA;
  }).length;
  const f2 = 1 - proporcion(colapsadas, muestra) * (muestra === 0 ? 0 : 1);

  // F3 — Actualización oportuna: el cierre se registra dentro de 1 día de la última señal real
  // de trabajo. Detecta el patrón "cargo todo el viernes", que distorsiona las series de tiempo.
  // Las tareas sin ninguna señal disponible se excluyen del denominador en vez de contarse como
  // falla: no tenemos evidencia de cierre tardío, y ante la duda el índice no castiga.
  const conSenal = cerradas.filter((c) => ultimaSenal(c) !== null);
  const oportunas = conSenal.filter((c) => {
    const d = ms(c.done_at)!;
    const s = ultimaSenal(c)!;
    return Math.abs(d - s) <= DIA;
  }).length;
  const f3 = proporcion(oportunas, conSenal.length);

  // F4 — Ausencia de huérfanas: tareas abiertas hace más de 10 días sin ninguna entrada de
  // historial. Peso bajo a propósito, porque hay motivos legítimos y frecuentes (esperar a un
  // tercero). Si no hay abiertas, F4 = 1: la ausencia de casos no es una falla.
  const abiertas = elegibles.filter((c) => c.status !== "term");
  const huerfanas = abiertas.filter((c) => {
    const s = ultimaSenal(c) ?? ms(c.created_at);
    return s !== null && hoy - s > 10 * DIA;
  }).length;
  const f4 = 1 - proporcion(huerfanas, abiertas.length) * (abiertas.length === 0 ? 0 : 1);

  // F5 — Coherencia del cierre: un cierre que se deshace a los dos días no era un cierre.
  // Peso bajo porque retrabajo.ts ya lo reporta aparte y no conviene contarlo dos veces fuerte.
  const sinReapertura = cerradas.filter((c) => !tieneReapertura(c)).length;
  const f5 = proporcion(sinReapertura, muestra);

  const factores: FactorICR[] = [
    { clave: "F1", nombre: "Trazabilidad de estados", valor: f1, peso: 30 },
    { clave: "F2", nombre: "Registro no colapsado", valor: f2, peso: 25 },
    { clave: "F3", nombre: "Actualización oportuna", valor: f3, peso: 20 },
    { clave: "F4", nombre: "Ausencia de huérfanas", valor: f4, peso: 15 },
    { clave: "F5", nombre: "Coherencia del cierre", valor: f5, peso: 10 },
  ];

  const puntaje = suficiente
    ? Math.round(factores.reduce((s, f) => s + f.valor * f.peso, 0))
    : null;

  return { puntaje, muestra, suficiente, factores, lectura: LECTURA_ICR };
}
