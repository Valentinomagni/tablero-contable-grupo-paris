import type { Announcement } from "./types";

// Tablón como canal de comunicación (spec 24 item 1): vigencia, prioridad y archivo.
// Campos de la migración 23; en bases sin migrar vienen undefined → defaults seguros.

const PESO: Record<string, number> = { urgente: 0, importante: 1, normal: 2 };

export function vigente(a: Announcement, hoyISO: string): boolean {
  if (a.archivado) return false;
  if (a.vigente_hasta && a.vigente_hasta < hoyISO) return false;
  return true;
}

export function expirado(a: Announcement, hoyISO: string): boolean {
  return !a.archivado && !!a.vigente_hasta && a.vigente_hasta < hoyISO;
}

// Orden del tablón: urgente > importante > normal; dentro de cada prioridad, más nuevo primero.
export function ordenarAvisos(annos: Announcement[]): Announcement[] {
  return [...annos].sort((a, b) => {
    const pa = PESO[a.prioridad ?? "normal"] ?? 2;
    const pb = PESO[b.prioridad ?? "normal"] ?? 2;
    if (pa !== pb) return pa - pb;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

// Lo que va a la sección "Archivados": archivados a mano + expirados por vigencia.
export function archivados(annos: Announcement[], hoyISO: string): Announcement[] {
  return annos.filter((a) => a.archivado || expirado(a, hoyISO));
}

export function activos(annos: Announcement[], hoyISO: string): Announcement[] {
  return ordenarAvisos(annos.filter((a) => vigente(a, hoyISO)));
}
