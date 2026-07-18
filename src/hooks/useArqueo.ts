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
      const { data, error } = await supabase.from("task_occurrences").select("*").in("card_id", ids);
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
  return computeArqueoStats(cards, occs, mesPrefix);
}
