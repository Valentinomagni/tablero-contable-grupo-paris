// Presencia en línea (spec 28 Fase A, Task 5): funciones puras sobre profiles.last_seen.
// Fechas en zona Argentina (UTC-3, sin horario de verano) — mismo criterio que toARTDate en metrics.ts.

function artParts(iso: string): { fecha: string; h: number; m: number } {
  const d = new Date(iso);
  const art = new Date(d.getTime() - 3 * 3600 * 1000);
  return { fecha: art.toISOString().slice(0, 10), h: art.getUTCHours(), m: art.getUTCMinutes() };
}

function diaAnterior(fecha: string): string {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function enLinea(lastSeenISO: string | null | undefined, ahoraISO: string, umbralMin = 3): boolean {
  if (!lastSeenISO) return false;
  const diffMin = (new Date(ahoraISO).getTime() - new Date(lastSeenISO).getTime()) / 60000;
  return diffMin >= 0 && diffMin <= umbralMin;
}

export function textoUltimaConexion(lastSeenISO: string | null | undefined, ahoraISO: string): string {
  if (!lastSeenISO) return "Sin registro";
  if (enLinea(lastSeenISO, ahoraISO)) return "En línea";

  const diffMin = (new Date(ahoraISO).getTime() - new Date(lastSeenISO).getTime()) / 60000;
  if (diffMin < 60) {
    const n = Math.round(diffMin);
    return `Hace ${n} minuto${n === 1 ? "" : "s"}`;
  }

  const last = artParts(lastSeenISO);
  const ahora = artParts(ahoraISO);
  const hh = String(last.h).padStart(2, "0");
  const mm = String(last.m).padStart(2, "0");

  if (last.fecha === ahora.fecha) {
    const n = Math.round(diffMin / 60);
    return `Hace ${n} hora${n === 1 ? "" : "s"}`;
  }
  if (last.fecha === diaAnterior(ahora.fecha)) {
    return `Ayer ${hh}:${mm}`;
  }
  const [, mes, dia] = last.fecha.split("-");
  return `${dia}/${mes} ${hh}:${mm}`;
}
