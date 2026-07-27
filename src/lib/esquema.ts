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

/**
 * Migración que agrega `cards.etiquetas` (spec 28, fase D, Task 5). Se gatea APARTE de
 * MIGRACION_ESQUEMA_NUEVO (29) porque es una migración distinta y puede no estar
 * corrida aunque la 29 sí lo esté (o viceversa): si `etiquetas` viajara en el mismo
 * gate que proc_at/tiempo_max_horas/dato_control, una base con la 29 aplicada pero
 * sin la 31 mandaría la columna igual y el guardado de CUALQUIER tarea (no solo las
 * que usan etiquetas) fallaría entero con 42703 ("column etiquetas does not exist").
 */
export const MIGRACION_ETIQUETAS = 31;

/**
 * Migración que crea `card_periodos` (propuesta de períodos, Fase 0). Gate de la
 * escritura por período (Fase 2): mientras no esté aplicada, `card_periodos` no existe
 * y toda la lógica de períodos cae al comportamiento de siempre (escribir en `cards`).
 * Se gatea aparte de las demás por el mismo motivo que MIGRACION_ETIQUETAS.
 */
export const MIGRACION_PERIODOS = 32;

/** Columnas de `cards` que sólo existen con la migración 29 aplicada. */
export const CAMPOS_NUEVOS_CARDS = ["proc_at", "tiempo_max_horas", "dato_control"] as const;

/** Columnas de `cards` que sólo existen con la migración 31 aplicada. */
export const CAMPOS_ETIQUETAS_CARDS = ["etiquetas"] as const;

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
  "etiquetas",
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
  return tieneMigracion(aplicadas, MIGRACION_ESQUEMA_NUEVO);
}

/** ¿Está aplicada la migración 31 (`cards.etiquetas`)? Mismo criterio ante la duda: false. */
export function tieneEtiquetas(aplicadas: number[] | null | undefined): boolean {
  return tieneMigracion(aplicadas, MIGRACION_ETIQUETAS);
}

/** ¿Está aplicada la migración 32 (`card_periodos`)? Mismo criterio ante la duda: false. */
export function tienePeriodos(aplicadas: number[] | null | undefined): boolean {
  return tieneMigracion(aplicadas, MIGRACION_PERIODOS);
}

/** Helper genérico: ¿la lista de migraciones aplicadas incluye `id`? */
function tieneMigracion(aplicadas: number[] | null | undefined, id: number): boolean {
  return Array.isArray(aplicadas) && aplicadas.includes(id);
}

/** Saca del objeto las claves indicadas. No muta el original. */
function sinCampos<T extends object>(payload: T, campos: readonly string[]): T {
  const out = { ...payload } as Record<string, unknown>;
  for (const k of campos) delete out[k];
  return out as T;
}

/**
 * Devuelve el payload listo para mandar a PostgREST: intacto si la migración indicada
 * está aplicada, y sin los campos nuevos si no lo está (o si no se sabe).
 *
 * `migracion` default MIGRACION_ESQUEMA_NUEVO (29) por compatibilidad con el uso
 * histórico de este helper; pasarla explícita para gatear contra otra migración
 * (p.ej. MIGRACION_ETIQUETAS).
 */
export function payloadCompatible<T extends object>(
  payload: T,
  aplicadas: number[] | null | undefined,
  campos: readonly string[],
  migracion: number = MIGRACION_ESQUEMA_NUEVO,
): T {
  if (!payload || typeof payload !== "object") return payload;
  return tieneMigracion(aplicadas, migracion) ? payload : sinCampos(payload, campos);
}

/**
 * Azúcar para `cards`: aplica DOS gates independientes — proc_at/tiempo_max_horas/
 * dato_control (migración 29) y etiquetas (migración 31) — porque una base puede
 * tener una sin la otra.
 */
export function payloadCards<T extends object>(payload: T, aplicadas: number[] | null | undefined): T {
  const sinViejos = payloadCompatible(payload, aplicadas, CAMPOS_NUEVOS_CARDS, MIGRACION_ESQUEMA_NUEVO);
  return payloadCompatible(sinViejos, aplicadas, CAMPOS_ETIQUETAS_CARDS, MIGRACION_ETIQUETAS);
}

/** Azúcar para `profiles` (oculto / last_seen). */
export function payloadProfiles<T extends object>(payload: T, aplicadas: number[] | null | undefined): T {
  return payloadCompatible(payload, aplicadas, CAMPOS_NUEVOS_PROFILES);
}
