import { z } from "zod";
import type { Card } from "./types";

// Validación en runtime de la frontera de datos (Supabase). Los tipos de TS solo existen en
// compilación; si la DB devuelve algo inesperado (una migración a medias, un dato corrupto),
// Zod lo detecta acá en vez de reventar más adentro. Es NO destructivo: avisa pero no descarta.

export const CardSchema = z.object({
  id: z.string(),
  owner: z.string(),
  title: z.string(),
  status: z.enum(["pend", "proc", "term"]),
  done_at: z.string().nullable(),
  due_date: z.string().nullable(),
  priority: z.enum(["alta", "media", "baja"]),
  effort: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]),
  card_type: z.enum(["normal", "operativa"]),
  history: z.array(z.object({ who: z.string(), at: z.string(), txt: z.string() })),
  // Campos de la migración 22 — opcionales/nullables para no generar warnings
  // de drift en bases donde la migración todavía no se corrió.
  protected: z.boolean().optional().nullable(),
  categoria: z.string().optional().nullable(),
  reset_policy: z.enum(["mensual", "mantener", "manual"]).optional().nullable(),
  requiere_resultado: z.boolean().optional().nullable(),
  exige_checklist: z.boolean().optional().nullable(),
});

// valida cada fila y avisa por consola de las que no cumplen; SIEMPRE devuelve los datos crudos
// para no cambiar el comportamiento (Sentry/observabilidad futura puede engancharse acá).
export function validateRows<T>(rows: T[], schema: z.ZodType, contexto: string): T[] {
  let malas = 0;
  for (const r of rows) if (!schema.safeParse(r).success) malas++;
  if (malas > 0) console.warn(`[schema] ${malas}/${rows.length} filas de "${contexto}" no cumplen el esquema esperado (posible drift de DB).`);
  return rows;
}

// ============================================================
// SANEADO — el paso siguiente de `validateRows`, no su reemplazo.
//
// `validateRows` es a propósito NO destructivo: detecta drift de la base y avisa, sin tocar
// los datos. Eso sirve para enterarse, pero no evita el choque: si una fila llega con
// `checklist` en `null` en vez de `[]` —una migración a medias, una edición a mano, un valor
// viejo de otra versión—, el `.map()` de un componente explota diez niveles más abajo y se
// cae la PANTALLA ENTERA con un mensaje que no ayuda a nadie.
//
// El saneado ARREGLA lo que se puede arreglar sin inventar nada, y DESCARTA lo inservible.
// Que falte una tarjeta es un problema chico y visible; que se caiga la pantalla es un
// problema grande. Los dos conviven porque cumplen roles distintos: uno informa del drift,
// el otro protege la UI.
//
// Se construye con zod y no a mano justamente para que el conocimiento del esquema viva en
// UN solo archivo. Dos definiciones de la misma forma se desincronizan solas.
// ============================================================

/** Arreglos: cualquier cosa que no sea lista pasa a lista vacía. */
const listaSegura = z.array(z.unknown()).catch([]);
/** Fechas: sólo texto o nulo; un número o un objeto pasan a nulo. */
const fechaSegura = z.string().nullable().catch(null);

const CardSaneada = z.looseObject({
  // Sin id ni owner la tarjeta no se puede abrir, guardar ni atribuir: no hay nada que
  // rescatar, y `min(1)` hace que la fila se descarte en vez de entrar rota.
  id: z.string().min(1),
  owner: z.string().min(1),
  // El título vacío se nombra en vez de dejar una tarjeta anónima que nadie puede referir.
  title: z.string().catch("").transform((t) => (t.trim() ? t : "(sin título)")),
  status: z.enum(["pend", "proc", "term"]).catch("pend"),
  priority: z.enum(["alta", "media", "baja"]).catch("media"),
  card_type: z.enum(["normal", "operativa"]).catch("normal"),
  // `coerce` para que un "3" que viene como texto se interprete en vez de perderse. Un solo
  // NaN acá contamina TODOS los totales del reporte sin dejar rastro de dónde salió.
  effort: z.coerce.number().positive().catch(1),
  checklist: listaSegura,
  comments: listaSegura,
  history: listaSegura,
  deps: z.array(z.string()).catch([]),
  done_at: fechaSegura,
  proc_at: fechaSegura,
  due_date: fechaSegura,
  recurring: z.boolean().catch(false),
});

/**
 * Filas de `cards` listas para que las toque un componente.
 *
 * `looseObject` y no `object`: las columnas que el esquema no nombra (categoria, etiquetas,
 * tiempo_max_horas, y las que agregue la próxima migración) tienen que sobrevivir. Si el
 * saneado las borrara, arreglar un dato roto costaría perder features enteras.
 */
export function saneaCards(filas: unknown): Card[] {
  if (!Array.isArray(filas)) return [];
  const out: Card[] = [];
  for (const f of filas) {
    const r = CardSaneada.safeParse(f);
    if (r.success) out.push(r.data as unknown as Card);
  }
  // Descartar en silencio es lo que convierte "falta una tarjeta" en un misterio de dos horas.
  const descartadas = filas.length - out.length;
  if (descartadas > 0) {
    console.warn(`[schema] se descartaron ${descartadas}/${filas.length} filas de "cards" por venir sin id o sin responsable.`);
  }
  return out;
}
