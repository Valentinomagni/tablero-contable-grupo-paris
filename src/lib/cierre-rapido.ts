import type { Card } from "./types";

// Cerrar una tarea de UN TOQUE desde la lista — P5 de docs/PROPUESTAS-ADOPCION.md.
//
// PROBLEMA QUE ATACA: actualizar cuesta demasiados toques. Marcar terminada implica abrir la
// card, cambiar el estado y, si el sistema pide datos, la persona posterga. El documento lo
// resume así: "bajar el costo de decir la verdad es más efectivo que insistir en que la
// digan". Mientras actualizar cueste cuatro toques, todo recordatorio pelea contra la
// fricción — por eso esta es la propuesta que más mueve la aguja a largo plazo.
//
// LA REGLA DURA (riesgo de calidad de dato, no de molestia): NO se precarga nada que
// implique una AFIRMACIÓN DE CONTROL. Un arqueo de caja tiene que seguir siendo una
// elección explícita: si "sin diferencias" viniera precargado, terminaríamos registrando
// arqueos que nadie miró. Un default demasiado cómodo se acepta sin leer, y ahí el sistema
// se llena de datos que son mentira — que es exactamente lo que este proyecto quiere evitar.
//
// PURO: la fecha y el nombre entran por parámetro; sin `new Date()` adentro.

const TXT_CIERRE_RAPIDO = "Marcó terminada desde Mi día";

/** ¿Esta tarea se puede cerrar sin abrirla? Ante cualquier duda, false. */
export function sePuedeCerrarRapido(c: Card, todas: Card[]): boolean {
  if (!c || c.status === "term") return false;
  // Tarea de control (arqueo): el resultado es una decisión, no un default.
  if (c.requiere_resultado === true) return false;
  // Protegida por un jefe: el candado existe justamente para que no se toque de pasada.
  if (c.protected === true) return false;
  // Bloqueada: cerrarla saltearía el motivo por el que espera.
  if (estaBloqueada(c, todas)) return false;
  return true;
}

function estaBloqueada(c: Card, todas: Card[]): boolean {
  const lista = Array.isArray(todas) ? todas : [];
  return (c.deps ?? []).some((id) => {
    const dep = lista.find((x) => x.id === id);
    return !!dep && dep.status !== "term";
  });
}

/**
 * Por qué esta tarea no se puede cerrar de un toque, en lenguaje de usuario.
 * `null` cuando sí se puede. Sirve para explicar en vez de mostrar un botón muerto.
 */
export function MOTIVO_NO_RAPIDO(c: Card, todas: Card[]): string | null {
  if (!c || c.status === "term") return null;
  if (c.requiere_resultado === true) return "Abrila para elegir el resultado del control.";
  if (c.protected === true) return "Está protegida: abrila para modificarla.";
  if (estaBloqueada(c, todas)) return "Espera a que se libere otra tarea.";
  return null;
}

/**
 * El patch que cierra la tarea. Sólo toca ESTADO — nunca campos de definición
 * (título, prioridad, categoría), que no tienen nada que ver con darla por terminada.
 */
export function patchCierreRapido(c: Card, quien: string, ahoraISO: string): Partial<Card> {
  const patch: Partial<Card> = {
    status: "term",
    done_at: ahoraISO,
    history: [...(c.history ?? []), { who: quien, at: ahoraISO, txt: TXT_CIERRE_RAPIDO }],
  };
  // Si nunca pasó por "en proceso", se sella ahora. Sin `proc_at` ninguna métrica de tiempo
  // (SLA, ICR) puede decir nada sobre esta tarea — y cerrar rápido no debería ser el camino
  // que degrada el dato. Si ya lo tenía, NO se pisa: el arranque real manda.
  if (!c.proc_at) patch.proc_at = ahoraISO;
  return patch;
}
