// Chip de estado de migraciones en Admin (spec 27, T2). schema_migrations la crea la migración 28.
//
// ESTA LISTA SE QUEDÓ VIEJA UNA VEZ Y NO SE NOTÓ. Terminaba en la 28 mientras se escribían nueve
// migraciones más. El chip mostraba "Base de datos al día" sin haber mirado ninguna de esas nueve
// —incluida la 35, la que cierra la escalada de privilegios—, porque un indicador que sólo sabe
// decir que sí no distingue entre "está todo bien" y "no miré".
//
// Ahora hay un guardián (`migraciones.guard.test.ts`) que compara esta lista contra los archivos
// .sql del repo y falla si alguno queda afuera. Cuando escribas una migración nueva, agregá su
// número acá y ponele el `insert into schema_migrations` al final del .sql; si te olvidás de
// cualquiera de las dos cosas, el test te lo dice.
export const MIGRACIONES_ESPERADAS = [
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 50, 51, 52, 54,
];

export function estadoMigraciones(aplicadas: number[] | null): { ok: boolean; faltan: number[]; desconocido: boolean } {
  if (aplicadas === null) return { ok: false, faltan: [], desconocido: true };
  const set = new Set(aplicadas);
  const faltan = MIGRACIONES_ESPERADAS.filter((n) => !set.has(n)).sort((a, b) => a - b);
  return { ok: faltan.length === 0, faltan, desconocido: false };
}
