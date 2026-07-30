// Contraseña temporal para el blanqueo que hace el jefe.
//
// NO es una clave definitiva ni pretende serlo: es un pase de un solo uso que la persona
// cambia apenas entra. Por eso lo que importa acá no es la entropía máxima sino que se pueda
// DICTAR sin errores — se la van a pasar por teléfono o por chat, y un 0 confundido con una O
// es otra llamada y otros diez minutos de alguien que no puede trabajar.

/** Alfabeto sin caracteres ambiguos: se fueron 0, O, o, l, I y 1. */
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const NUMEROS = "23456789";

/** Supabase exige 8 como mínimo; 10 da margen sin volverla incómoda de dictar. */
export const LARGO_CLAVE = 10;
const MINIMO = 8;

/**
 * Una clave temporal. `azar` se inyecta para poder testearla — sin eso, un test sobre algo
 * aleatorio o es frágil o no prueba nada.
 */
export function generarClaveTemporal(azar: () => number = Math.random): string {
  const alfabeto = LETRAS + NUMEROS;
  let out = "";
  for (let i = 0; i < LARGO_CLAVE - 1; i++) {
    out += alfabeto[Math.floor(azar() * alfabeto.length)];
  }
  // El último SIEMPRE es número: hay políticas de contraseña que exigen al menos uno, y que
  // el blanqueo falle por eso sería absurdo justo cuando alguien está esperando para entrar.
  return out + NUMEROS[Math.floor(azar() * NUMEROS.length)];
}

/** `null` si la clave sirve; si no, el motivo en lenguaje de usuario. */
export function claveAceptable(clave: string): string | null {
  const c = typeof clave === "string" ? clave.trim() : "";
  if (!c) return "Escribí una contraseña.";
  if (c.length < MINIMO) return `La contraseña necesita al menos ${MINIMO} caracteres.`;
  return null;
}
