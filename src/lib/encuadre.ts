/**
 * Textos de encuadre no punitivo — FUENTE ÚNICA.
 *
 * La regla más dura del proyecto: las métricas describen situaciones y procesos, nunca juzgan
 * personas (ver `encuadre.guard.test.ts`, que verifica que ninguna pantalla arme un podio).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. La aclaración que acompaña a las tablas por persona vivía escrita
 * a mano dentro del PDF del Reporte, y el Excel del Análisis —que muestra los MISMOS datos por
 * persona— salía sin nada (hallazgo 3 de la auditoría del 05/08). Un artefacto que se descarga
 * viaja solo: se abre sin la pantalla que lo explica, se reenvía, se imprime y sobrevive meses.
 * Es el peor lugar posible para que falte el encuadre.
 *
 * Que el texto sea una constante compartida y no dos strings iguales es deliberado: el hallazgo
 * 2 de esa misma auditoría existe porque un criterio estaba escrito dos veces y divergió.
 */

/**
 * Acompaña a toda tabla que muestre números al lado de nombres de personas.
 *
 * Se usa como sufijo del título, con guion largo: `<título> — <encuadre>`. En minúscula porque
 * continúa la frase del título, que es como ya salía en el PDF.
 */
export const ENCUADRE_REPARTO = "describe reparto de trabajo, no desempeño";
