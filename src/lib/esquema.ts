// Compatibilidad con una base SIN migrar (spec 28, review Fase A — ALTA 1).
//
// PROBLEMA: la migración 29 agrega columnas nuevas (cards.proc_at / tiempo_max_horas /
// dato_control, profiles.oculto / last_seen). Mientras no se haya corrido, PostgREST
// rechaza CUALQUIER insert/update que las mencione con PGRST204 / 42703 ("column ...
// does not exist") y la mutación entera falla. Eso rompía operaciones básicas que no
// tienen nada que ver con las funciones nuevas: mover una tarjeta (drag & drop), crear
// una tarea y guardar un perfil.
//
// SOLUCIÓN: un único helper compartido. Antes de mandar el payload se le sacan los
// campos que la base todavía no conoce. El resto de la operación funciona igual.
//
// CRITERIO ANTE LA DUDA: si no se puede saber qué migraciones hay aplicadas
// (`useMigraciones()` devuelve null porque la tabla `schema_migrations` no existe),
// se asume el esquema VIEJO y se omiten los campos. Es la opción segura: es preferible
// que una función nueva no guarde un dato a que se rompa el tablero entero.

/** Migración que introduce las columnas nuevas. */
export const MIGRACION_ESQUEMA_NUEVO = 29;

/** Columnas de `cards` que sólo existen con la migración 29 aplicada. */
export const CAMPOS_NUEVOS_CARDS = ["proc_at", "tiempo_max_horas", "dato_control"] as const;

/**
 * Columnas de `cards` que la app realmente usa, para pedirlas EXPLÍCITAMENTE en vez de
 * `select("*")`.
 *
 * MOTIVO: la migración 30 agrega `tsv` (tsvector generado) para el buscador full-text.
 * Con `*`, ese tsvector viaja entero en CADA fetch de cards — y hay un refetch por cada
 * evento realtime. Es un campo que la app nunca lee: sólo lo usa la base para indexar.
 *
 * Es exactamente el shape de `Card` (src/lib/types.ts): si se agrega un campo allá, va acá
 * también, o llega `undefined` en runtime sin que TypeScript lo note.
 */
export const COLUMNAS_CARDS = [
  "id", "owner", "title", "status", "description", "checklist", "comments", "history",
  "done_at", "due_date", "recurring", "priority", "effort", "card_type", "deps",
  "created_at", "recur_rule", "protected", "categoria", "reset_policy",
  "requiere_resultado", "sucursal", "marca", "proc_at", "tiempo_max_horas", "dato_control",
].join(",");

/** Columnas de `profiles` que sólo existen con la migración 29 aplicada. */
export const CAMPOS_NUEVOS_PROFILES = ["oculto", "last_seen"] as const;

/**
 * ¿La base tiene el esquema nuevo? `aplicadas` es lo que devuelve `useMigraciones()`:
 * la lista de ids aplicados, o null/undefined si no se pudo determinar (tabla
 * `schema_migrations` inexistente, query todavía cargando, error de red).
 * Ante la duda → false (esquema viejo).
 */
export function tieneEsquemaNuevo(aplicadas: number[] | null | undefined): boolean {
  return Array.isArray(aplicadas) && aplicadas.includes(MIGRACION_ESQUEMA_NUEVO);
}

/** Saca del objeto las claves indicadas. No muta el original. */
function sinCampos<T extends object>(payload: T, campos: readonly string[]): T {
  const out = { ...payload } as Record<string, unknown>;
  for (const k of campos) delete out[k];
  return out as T;
}

/**
 * Devuelve el payload listo para mandar a PostgREST: intacto si el esquema nuevo está
 * aplicado, y sin los campos nuevos si no lo está (o si no se sabe).
 */
export function payloadCompatible<T extends object>(
  payload: T,
  aplicadas: number[] | null | undefined,
  campos: readonly string[],
): T {
  if (!payload || typeof payload !== "object") return payload;
  return tieneEsquemaNuevo(aplicadas) ? payload : sinCampos(payload, campos);
}

/** Azúcar para `cards` (proc_at / tiempo_max_horas / dato_control). */
export function payloadCards<T extends object>(payload: T, aplicadas: number[] | null | undefined): T {
  return payloadCompatible(payload, aplicadas, CAMPOS_NUEVOS_CARDS);
}

/** Azúcar para `profiles` (oculto / last_seen). */
export function payloadProfiles<T extends object>(payload: T, aplicadas: number[] | null | undefined): T {
  return payloadCompatible(payload, aplicadas, CAMPOS_NUEVOS_PROFILES);
}
