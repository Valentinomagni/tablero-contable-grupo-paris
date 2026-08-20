// Confiabilidad por métrica (ICR mecanismo 1, ver docs/PROPUESTA-ICR.md 3.4).
//
// ENCUADRE (regla dura del proyecto): esto califica AL DATO, nunca a una persona. Ningún
// rótulo ni explicación puede mencionar personas, equipos ni rendimiento — hay un test que
// lo verifica. Lo que se dice es de qué se puede fiar el gráfico que acompaña.
import type { ResultadoICR } from "./icr";

export type NivelConfianza = "alta" | "media" | "baja" | "sin-datos";

export interface Confianza {
  nivel: NivelConfianza;
  rotulo: string;
  explicacion: string;
}

// Umbrales de PROPUESTA-ICR.md 3.4. La propuesta separa 50–69 de <50, pero para el badge
// ambos tramos llevan la misma conducta ("no decidir con esto"), así que se unifican en "baja".
// Sin `export`: se usan sólo acá. Exportarlas de más hace que `knip` las liste como código
// muerto, y un informe con ruido es un informe que se deja de leer.
const UMBRAL_ALTA = 85;
const UMBRAL_MEDIA = 70;

const SIN_DATOS: Confianza = {
  nivel: "sin-datos",
  rotulo: "Sin datos suficientes",
  explicacion: "La muestra no alcanza para calificar este dato. El número no se publica en vez de maquillarse.",
};

export function confianzaDe(icr: ResultadoICR): Confianza {
  // Defensivo a propósito: el badge se monta al lado de paneles que pueden renderizar antes
  // de que el ICR exista. Sin ICR no se arriesga un nivel.
  if (!icr || !icr.suficiente || icr.puntaje === null || icr.puntaje === undefined) return SIN_DATOS;

  if (icr.puntaje >= UMBRAL_ALTA) {
    return {
      nivel: "alta",
      rotulo: "Dato confiable",
      explicacion: "El registro de este conjunto es apto para analizar el proceso sin reservas.",
    };
  }
  if (icr.puntaje >= UMBRAL_MEDIA) {
    return {
      nivel: "media",
      rotulo: "Dato usable con criterio",
      explicacion: "Sirve como referencia, pero conviene mirar qué factor tira abajo el registro antes de concluir nada.",
    };
  }
  return {
    nivel: "baja",
    rotulo: "Dato poco representativo",
    explicacion: "El registro de este conjunto no lo representa bien: no conviene decidir con estos números.",
  };
}
