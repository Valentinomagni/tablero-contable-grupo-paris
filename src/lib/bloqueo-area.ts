import type { Card } from "./types";
import { toARTDate } from "./metrics";
import { diasHabilesTranscurridos } from "./dias-habiles";

// Cuando el trabajo se traba por otra área que NO usa el tablero.
//
// EL PEDIDO, textual: "añadir dependencia de otras áreas, pero sin implicarlas, porque no van a
// usar la aplicación por el momento; pero estaría bueno marcar que si algo está trabado sea por
// otra área. Ej: ventas, administración, recursos humanos".
//
// POR QUÉ NO SIRVE `deps` PARA ESTO. `src/lib/deps.ts` es tarea-a-tarea y sólo funciona entre
// tareas que existen en la app. Ventas no tiene tareas acá y no las va a tener. Esto no es una
// dependencia: es UNA ESPERA REGISTRADA.
//
// EL VALOR REAL, y conviene tenerlo claro porque decide el diseño: hoy, cuando el trabajo se
// traba por otra área, esa demora aparece como demora del equipo contable. El jefe ve tareas
// quietas y no tiene forma de saber que la pelota está afuera. Esto separa las dos cosas.
//
// POR ESO LA FECHA NO ES OPCIONAL. Sin `bloqueo_desde`, "bloqueada por Ventas" es una etiqueta y
// no se puede hacer nada con ella. Con fecha es "hace 6 días hábiles que espera a Ventas", que
// sí es accionable: alguien puede levantar el teléfono.
//
// DÍAS HÁBILES Y NO CORRIDOS, por la misma razón que en `estancadas.ts`: un pedido hecho el
// viernes a la tarde no lleva tres días de demora el lunes a la mañana.

/** Lo que hace falta para considerar una tarea bloqueada. Las dos cosas, o ninguna. */
export function estaBloqueada(c: Pick<Card, "bloqueo_area" | "bloqueo_desde">): boolean {
  return !!c?.bloqueo_area && !!c?.bloqueo_desde;
}

/**
 * Hace cuántos días HÁBILES espera, o `0` si no está bloqueada.
 *
 * `hoyISO` entra por parámetro y no se lee de `new Date()` adentro: así se puede testear sin
 * congelar el reloj, que es como está escrito el resto de las libs de este proyecto.
 */
export function diasEsperando(
  c: Pick<Card, "bloqueo_area" | "bloqueo_desde">, hoyISO: string, noLaborables: Set<string>,
): number {
  if (!estaBloqueada(c)) return 0;
  return diasHabilesTranscurridos(toARTDate(c.bloqueo_desde!), toARTDate(hoyISO), noLaborables);
}

/**
 * El chip de la tarjeta: "Espera a Ventas · 6 días", o `null` si no está bloqueada.
 *
 * El día cero NO dice "0 días" —queda raro y no aporta— sino sólo el área. Recién desde el
 * primer día hábil el número significa algo.
 */
export function textoBloqueo(
  c: Pick<Card, "bloqueo_area" | "bloqueo_desde">, hoyISO: string, noLaborables: Set<string>,
): string | null {
  if (!estaBloqueada(c)) return null;
  const d = diasEsperando(c, hoyISO, noLaborables);
  if (d <= 0) return `Espera a ${c.bloqueo_area}`;
  return d === 1 ? `Espera a ${c.bloqueo_area} · 1 día` : `Espera a ${c.bloqueo_area} · ${d} días`;
}

export interface EsperaPorArea {
  area: string;
  cantidad: number;
  /** Días hábiles de la que lleva más tiempo esperando. */
  masVieja: number;
}

/**
 * Para el resumen del jefe: cuántas tareas espera cada área y hace cuánto la más vieja.
 *
 * ORDENADO POR LA MÁS VIEJA, no por cantidad. Cuatro tareas de dos días son ruido normal; una
 * sola parada hace once días es el problema. Ordenar por cantidad escondería justo eso.
 *
 * ENCUADRE: esto agrupa por ÁREA, nunca por persona. Es una descripción de dónde está trabado el
 * proceso, no de quién tiene tareas trabadas — que sería un ranking encubierto.
 */
export function esperasPorArea(
  cards: Card[], hoyISO: string, noLaborables: Set<string>,
): EsperaPorArea[] {
  if (!Array.isArray(cards)) return [];
  const acc = new Map<string, EsperaPorArea>();
  for (const c of cards) {
    // Una tarea terminada ya no espera a nadie, aunque haya quedado el campo puesto.
    if (!c || c.status === "term" || !estaBloqueada(c)) continue;
    const area = c.bloqueo_area!;
    const d = diasEsperando(c, hoyISO, noLaborables);
    const previo = acc.get(area);
    if (previo) {
      previo.cantidad += 1;
      previo.masVieja = Math.max(previo.masVieja, d);
    } else {
      acc.set(area, { area, cantidad: 1, masVieja: d });
    }
  }
  return [...acc.values()].sort((a, b) => b.masVieja - a.masVieja || a.area.localeCompare(b.area));
}
