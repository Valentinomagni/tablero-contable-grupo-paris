import type { Vacacion } from "./types";

// Vacaciones y cobertura (spec 24 item 5): lógica pura sobre el rango [desde, hasta] inclusivo.
// Fechas en formato ISO "YYYY-MM-DD" — la comparación lexicográfica coincide con la cronológica.

// ¿El rango es válido para guardar? Ambos extremos presentes y desde <= hasta.
export function rangoValido(desde: string, hasta: string): boolean {
  if (!desde || !hasta) return false;
  return desde <= hasta;
}

// ¿La persona `ownerId` está de vacaciones en `fechaISO`? (desde <= fecha <= hasta)
export function estaDeVacaciones(vacs: Vacacion[], ownerId: string, fechaISO: string): boolean {
  return vacs.some((v) => v.owner === ownerId && v.desde <= fechaISO && fechaISO <= v.hasta);
}

// Ausencias vigentes en un día puntual (para el chip del calendario y el detalle del día).
export function ausentesEnFecha(vacs: Vacacion[], fechaISO: string): Vacacion[] {
  return vacs.filter((v) => v.desde <= fechaISO && fechaISO <= v.hasta);
}

// Vacaciones que todavía no terminaron (hasta >= hoy), ordenadas por fecha de inicio.
export function vacacionesActivasYFuturas(vacs: Vacacion[], hoyISO: string): Vacacion[] {
  return vacs.filter((v) => v.hasta >= hoyISO).sort((a, b) => a.desde.localeCompare(b.desde));
}
