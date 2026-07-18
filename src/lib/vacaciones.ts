import type { Vacacion, Card } from "./types";

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

// Cobertura activa (propuesta P9): una card fue reasignada por cobertura de vacaciones si su
// última entrada de history de cobertura ("Cobertura por vacaciones: de X a Y (…)") no fue
// revertida por una devolución posterior. `titular` = el nombre entre "de " y " a ".
const PREFIJO_COBERTURA = "Cobertura por vacaciones: de ";
export function esCobertura(card: Card): { activa: boolean; titular: string | null } {
  const hist = card.history ?? [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const txt = hist[i].txt ?? "";
    if (txt.startsWith("Devuelta al titular")) return { activa: false, titular: null };
    if (txt.startsWith(PREFIJO_COBERTURA)) {
      const resto = txt.slice(PREFIJO_COBERTURA.length);
      const corte = resto.indexOf(" a ");
      const titular = corte >= 0 ? resto.slice(0, corte).trim() : null;
      return { activa: true, titular: titular || null };
    }
  }
  return { activa: false, titular: null };
}
