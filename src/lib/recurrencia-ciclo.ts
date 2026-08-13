import type { RecurRule } from "./types";

// Cuándo una tarea recurrente arranca un ciclo nuevo.
//
// EL PROBLEMA QUE RESUELVE, contado como lo reportaron Yani, Mathi y Enzo: una tarea con
// recurrencia semanal —por ejemplo los jueves— se marca Finalizada y **no vuelve nunca**. Queda
// terminada para siempre y el jueves siguiente no aparece nada.
//
// LA CAUSA, que resultó no ser la que parecía. El proyecto tenía un solo proceso automático de
// recurrencias: el reinicio mensual. Ése mira `where recurring` —el tilde de "se repite todos los
// meses"— y **no sabe nada de `recur_rule`**, que es donde vive la recurrencia diaria y la
// semanal. Nunca hubo nada que mirara las semanales. No es que fallaba: no existía.
//
// LO QUE HACE ESTA LIB. Contesta dos preguntas, y nada más:
//   1. ¿Hoy le toca volver a esta tarea?
//   2. Si vuelve, ¿para cuándo vence el ciclo nuevo?
//
// PURA: la fecha entra por parámetro, no hay `new Date()` adentro. Eso la hace testeable sin
// congelar el reloj, que es la única forma de que estos tests sigan valiendo en diciembre.

/**
 * El texto que queda en el historial cuando una tarea arranca un ciclo nuevo.
 *
 * NO PUEDE DECIR "reabrió", y esto no es una preferencia de redacción. `src/lib/retrabajo.ts`
 * cuenta las reaperturas buscando su texto en el historial, y ese índice se le muestra al jefe
 * como señal de calidad del trabajo.
 *
 * Si el reinicio automático usara el mismo texto, cada ciclo de cada tarea recurrente contaría
 * como una reapertura. Una tarea diaria, ella sola, inflaría el retrabajo en unos 20 puntos por
 * mes — y el equipo aparecería rehaciendo trabajo que nunca rehízo.
 *
 * El pedido lo dice con todas las letras: "la reactivación programada debe ser tratada como un
 * Nuevo Ciclo, distinguiéndose de la Reapertura por un error operativo".
 */
export const TXT_NUEVO_CICLO = "Nuevo ciclo de la recurrencia";

/** Los tres tipos que el proyecto entiende. Cualquier otra cosa es una regla rota. */
const TIPOS = new Set(["diaria", "semanal", "mensual"]);

/**
 * Parte una fecha `YYYY-MM-DD` en sus números, o `null` si no tiene esa forma.
 *
 * POR QUÉ A MANO Y NO CON `new Date(iso)`. Porque `new Date("2026-08-13")` se parsea como
 * medianoche UTC, y después `.getDay()` devuelve el día en la zona LOCAL: en Argentina (UTC-3)
 * eso da MIÉRCOLES para una fecha que es jueves.
 *
 * Ese corrimiento de un día ya causó cuatro bugs distintos en este proyecto. Acá se evita no
 * usando el reloj para nada: los números se leen de la cadena y las cuentas se hacen en UTC.
 */
function partes(iso: string): { y: number; m: number; d: number } | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mes = Number(m[2]), d = Number(m[3]);
  // `Date.UTC` normaliza de más: el 32 de agosto se convierte en el 1 de septiembre sin
  // quejarse. Se verifica que la fecha sea la misma que entró, o era inválida.
  const t = Date.UTC(y, mes - 1, d);
  const v = new Date(t);
  if (v.getUTCFullYear() !== y || v.getUTCMonth() !== mes - 1 || v.getUTCDate() !== d) return null;
  return { y, m: mes, d };
}

/** Vuelve a `YYYY-MM-DD` desde un instante UTC. */
function aISO(t: number): string {
  const v = new Date(t);
  const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(v.getUTCDate()).padStart(2, "0");
  return `${v.getUTCFullYear()}-${mm}-${dd}`;
}

/** Día de la semana en UTC: 0 = domingo … 6 = sábado. Misma convención que `extract(dow)`. */
function diaDeSemana(p: { y: number; m: number; d: number }): number {
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** Cuántos días tiene ese mes. El día 0 del mes siguiente es el último del actual. */
function diasDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * ¿A esta tarea le toca arrancar un ciclo nuevo en esta fecha?
 *
 * Ante cualquier duda devuelve `false`. El motivo no es prolijidad: reactivar una tarea que ya
 * estaba terminada, sin que corresponda, le borra a alguien el trabajo hecho — se pierde el
 * `done_at`, se destildan los pasos, y la persona lo descubre cuando ya lo rehízo.
 * Equivocarse para el otro lado sólo demora un ciclo.
 */
export function tocaHoy(regla: RecurRule, fechaISO: string): boolean {
  if (!regla || typeof regla !== "object" || !TIPOS.has(regla.tipo)) return false;
  const p = partes(fechaISO);
  if (!p) return false;

  if (regla.tipo === "diaria") return true;

  if (regla.tipo === "semanal") {
    if (!Array.isArray(regla.dias) || regla.dias.length === 0) return false;
    return regla.dias.includes(diaDeSemana(p));
  }

  // mensual
  if (typeof regla.diaMes !== "number") return false;
  // El día 31 en un mes de 30: cae el último día, para que no se saltee el mes entero.
  const tope = Math.min(regla.diaMes, diasDelMes(p.y, p.m));
  return p.d === tope;
}

/**
 * La fecha de vencimiento del ciclo nuevo, o `null` si la regla no permite calcularla.
 *
 * Busca hacia adelante desde el día siguiente al que se pasa. Para las semanales mira los
 * próximos siete días, que siempre alcanzan para encontrar el día marcado más cercano.
 */
export function proximoVencimiento(regla: RecurRule, desdeISO: string): string | null {
  if (!regla || typeof regla !== "object" || !TIPOS.has(regla.tipo)) return null;
  const p = partes(desdeISO);
  if (!p) return null;
  const base = Date.UTC(p.y, p.m - 1, p.d);
  const UN_DIA = 86_400_000;

  if (regla.tipo === "diaria") return aISO(base + UN_DIA);

  if (regla.tipo === "semanal") {
    if (!Array.isArray(regla.dias) || regla.dias.length === 0) return null;
    // Siete intentos: en una semana completa aparece cualquier día marcado, sí o sí.
    for (let i = 1; i <= 7; i++) {
      const t = base + i * UN_DIA;
      if (regla.dias.includes(new Date(t).getUTCDay())) return aISO(t);
    }
    return null;
  }

  // mensual: mismo día del mes siguiente, recortado si ese mes es más corto.
  if (typeof regla.diaMes !== "number") return null;
  const mesSig = p.m === 12 ? 1 : p.m + 1;
  const anioSig = p.m === 12 ? p.y + 1 : p.y;
  const dia = Math.min(regla.diaMes, diasDelMes(anioSig, mesSig));
  return aISO(Date.UTC(anioSig, mesSig - 1, dia));
}
