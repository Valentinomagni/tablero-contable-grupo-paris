import { z } from "zod";

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
});

// valida cada fila y avisa por consola de las que no cumplen; SIEMPRE devuelve los datos crudos
// para no cambiar el comportamiento (Sentry/observabilidad futura puede engancharse acá).
export function validateRows<T>(rows: T[], schema: z.ZodType, contexto: string): T[] {
  let malas = 0;
  for (const r of rows) if (!schema.safeParse(r).success) malas++;
  if (malas > 0) console.warn(`[schema] ${malas}/${rows.length} filas de "${contexto}" no cumplen el esquema esperado (posible drift de DB).`);
  return rows;
}
