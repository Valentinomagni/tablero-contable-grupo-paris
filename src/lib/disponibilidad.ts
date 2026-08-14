// ¿Esta función está habilitada? — y la diferencia entre "no" y "todavía no sé".
//
// HALLAZGO 9 DE LA AUDITORÍA DEL 05/08, LAS DOS MITADES.
//
// PRIMERA: siete pantallas le nombran un número de migración al usuario. "Los adjuntos van a
// estar disponibles tras la migración 28." En Administración es defendible —quien la abre es
// quien corre las migraciones—; en una tarjeta abierta por un empleado, no: le informa a alguien
// que no puede hacer nada al respecto que le falta algo que no entiende, con una palabra que
// sólo significa algo del lado de adentro.
//
// SEGUNDA, Y ES LA QUE DE VERDAD ROMPE: `useMigraciones()` devuelve `undefined` mientras la
// consulta está en vuelo, y el criterio de `tieneMigracion` es "ante la duda, false". Resultado:
// **ese cartel aparece aunque la migración esté aplicada**, en el primer render y ante cualquier
// corte de red. La persona ve "no disponible", parpadea, y la función aparece.
//
// Un "no disponible" que se desmiente solo dos segundos después es peor que no decir nada: le
// enseña a la gente que los mensajes de esta app no son confiables, y eso se generaliza al resto
// de la pantalla.
//
// POR ESO SON TRES ESTADOS Y NO DOS. "Sé que está", "sé que falta" y "todavía no sé" son
// respuestas distintas y necesitan salidas distintas. Meter la tercera dentro de la segunda es
// exactamente el bug.

/**
 * - `"si"`   — la migración está aplicada.
 * - `"no"`   — la lista llegó y no la incluye. Recién acá se puede afirmar que falta.
 * - `"nose"` — la consulta está en vuelo (`undefined`) o falló (`null`). No se afirma nada.
 */
export type Disponible = "si" | "no" | "nose";

export function disponibilidad(aplicadas: number[] | null | undefined, migracion: number): Disponible {
  // `undefined` = react-query todavía no resolvió. `null` = la consulta falló (así lo devuelve
  // `useMigraciones`). Los dos casos son lo mismo para quien mira la pantalla: no sabemos.
  if (!Array.isArray(aplicadas)) return "nose";
  return aplicadas.includes(migracion) ? "si" : "no";
}

/**
 * Qué decirle a alguien que NO administra el sistema cuando una función no está habilitada.
 *
 * Sin número de migración: no le sirve, no puede actuar sobre él, y nombrarlo le muestra una
 * tubería que no le corresponde ver. Lo que sí necesita es saber que no es culpa suya y a quién
 * avisarle.
 *
 * `que` va en plural o singular según corresponda y en minúscula: "los adjuntos", "el registro
 * de transferencias".
 */
export function textoNoHabilitado(que: string): string {
  return `Todavía no están habilitados ${que}. Avisale a quien administra el sistema.`;
}

/**
 * La misma idea para Administración, donde el número SÍ sirve: quien lee esa pantalla es quien
 * corre las migraciones, y sin el número tendría que ir a buscarlo.
 */
export function textoNoHabilitadoAdmin(que: string, migracion: number): string {
  return `${que}: falta correr la migración ${migracion}.`;
}
