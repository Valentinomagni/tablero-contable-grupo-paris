import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Card, TaskOccurrence } from "../lib/types";
import { statsArqueo, type StatsArqueo } from "../lib/arqueo";

export interface ArqueoRow { card: Card; stats: StatsArqueo; }

// Cards de control = las que requieren resultado (arqueo de caja). DEFENSIVO: si la
// migración 23 no está aplicada, requiere_resultado es undefined en todas → [].
export function cardsDeControl(cards: Card[]): Card[] {
  return (cards ?? []).filter((c) => c.requiere_resultado === true);
}

// Puro y testeable: dado el universo de ocurrencias, arma { card, stats } por card de control,
// filtrando client-side por card_id. Cada card usa sólo SUS ocurrencias.
export function computeArqueoStats(cards: Card[], occs: TaskOccurrence[], mesPrefix: string): ArqueoRow[] {
  const control = cardsDeControl(cards);
  const all = occs ?? [];
  return control.map((card) => ({
    card,
    stats: statsArqueo(all.filter((o) => o.card_id === card.id), mesPrefix),
  }));
}

// Cumplimiento de arqueo del mes para las cards de control. Una sola query con .in() sobre
// los ids de control; si no hay ninguna, la query queda deshabilitada y devuelve [].
// DEFENSIVO: ante cualquier error (tabla/columna inexistente) → [].
export function useArqueoStats(cards: Card[], mesPrefix: string): ArqueoRow[] {
  const ids = cardsDeControl(cards).map((c) => c.id);
  const { data: occs = [] } = useQuery({
    queryKey: ["arqueo", mesPrefix, ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<TaskOccurrence[]> => {
      // Filtrado por MES en el servidor, no en el cliente. Antes se traían TODAS las
      // ocurrencias históricas de todas las cards de control y se filtraba después con
      // `mesPrefix`. Supabase corta en 1000 filas por defecto y no avisa: con diez cajas
      // diarias y dos años de historia son ~7000 filas, así que llegaban 1000 en orden
      // indefinido y el cumplimiento del mes se calculaba sobre un subconjunto arbitrario.
      // Un porcentaje de arqueo que baja porque la consulta se truncó es la peor forma de
      // mentir en un proyecto cuya regla es que las métricas no juzgan personas.
      const { data, error } = await supabase.from("task_occurrences").select("*")
        .in("card_id", ids)
        .gte("fecha", `${mesPrefix}-01`)
        .lte("fecha", `${mesPrefix}-31`);
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
  return computeArqueoStats(cards, occs, mesPrefix);
}

/** Meses de historia que se traen para la tendencia. Ver el comentario de abajo. */
const MESES_TENDENCIA = 24;

// Ocurrencias de las cards de control para la tendencia histórica de diferencias
// (Task 6, spec28 fase B). DEFENSIVO: ante cualquier error → [].
export function useArqueoOccsAll(cards: Card[]): TaskOccurrence[] {
  const ids = cardsDeControl(cards).map((c) => c.id);
  const { data: occs = [] } = useQuery({
    queryKey: ["arqueo", "all", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<TaskOccurrence[]> => {
      // Ventana EXPLÍCITA de 24 meses en vez de "todo". Sin límite, Supabase cortaba en 1000
      // filas sin avisar y en orden indefinido: la tendencia se dibujaba con un subconjunto
      // arbitrario y parecía completa. Un recorte declarado y ordenado es honesto; uno
      // silencioso es un gráfico que miente.
      const desde = new Date();
      desde.setMonth(desde.getMonth() - MESES_TENDENCIA);
      const { data, error } = await supabase.from("task_occurrences").select("*")
        .in("card_id", ids)
        .gte("fecha", desde.toISOString().slice(0, 10))
        .order("fecha", { ascending: false })
        .limit(5000);
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
  return occs;
}
