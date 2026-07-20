// Chip de estado de migraciones en Admin (spec 27, T2). schema_migrations la crea la migración 28.
export const MIGRACIONES_ESPERADAS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

export function estadoMigraciones(aplicadas: number[] | null): { ok: boolean; faltan: number[]; desconocido: boolean } {
  if (aplicadas === null) return { ok: false, faltan: [], desconocido: true };
  const set = new Set(aplicadas);
  const faltan = MIGRACIONES_ESPERADAS.filter((n) => !set.has(n)).sort((a, b) => a - b);
  return { ok: faltan.length === 0, faltan, desconocido: false };
}
