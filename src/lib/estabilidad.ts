// Estabilidad de una serie mensual: no CUÁNTO se produce, sino cuánto VARÍA.
// `evolucion.ts` ya da la curva; esto responde otra pregunta: 95-94-96 y 100-30-98 tienen
// promedios parecidos y significan cosas muy distintas.
//
// ENCUADRE: mide la regularidad del PROCESO. Un resultado disparejo suele hablar de carga
// mal repartida o de urgencias que entran de golpe —no de la persona—, así que los textos
// describen la serie y nunca califican a nadie.
//
// Se usa el coeficiente de variación (desvío estándar / promedio): es adimensional, así que
// permite comparar series de magnitudes distintas.

export type NivelEstabilidad = "muy-estable" | "estable" | "variable" | "muy-variable" | "sin-datos";

export interface Estabilidad { cv: number; nivel: NivelEstabilidad; texto: string }

const TEXTO: Record<NivelEstabilidad, string> = {
  "muy-estable": "Resultados parejos mes a mes",
  estable: "Resultados bastante parejos",
  variable: "Resultados con altibajos",
  "muy-variable": "Resultados muy dispares entre meses",
  "sin-datos": "Faltan meses para poder compararlo",
};

/** Con menos de 3 meses cualquier conclusión sería ruido. */
const MINIMO_MESES = 3;

export function estabilidad(valores: number[]): Estabilidad {
  const v = Array.isArray(valores) ? valores.filter((n) => typeof n === "number" && isFinite(n)) : [];
  if (v.length < MINIMO_MESES) return { cv: 0, nivel: "sin-datos", texto: TEXTO["sin-datos"] };
  const media = v.reduce((s, n) => s + n, 0) / v.length;
  if (media <= 0) return { cv: 0, nivel: "sin-datos", texto: TEXTO["sin-datos"] };
  const varianza = v.reduce((s, n) => s + (n - media) ** 2, 0) / v.length;
  const cv = Math.sqrt(varianza) / media;
  const nivel: NivelEstabilidad =
    cv < 0.05 ? "muy-estable" : cv < 0.15 ? "estable" : cv < 0.35 ? "variable" : "muy-variable";
  return { cv, nivel, texto: TEXTO[nivel] };
}
