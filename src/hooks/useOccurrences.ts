import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { TaskOccurrence } from "../lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

// Ocurrencias (task_occurrences) del mes visible. DEFENSIVA: si la tabla aún no existe
// (migración 16 sin aplicar) o hay cualquier error, devuelve [] para que el Calendario y
// la vista de cumplimiento carguen vacío sin romper la app.
export function useOccurrences(year: number, month1a12: number) {
  return useQuery({
    queryKey: ["occurrences", year, month1a12],
    queryFn: async (): Promise<TaskOccurrence[]> => {
      const desde = `${year}-${pad(month1a12)}-01`;
      const hasta = `${year}-${pad(month1a12)}-${pad(new Date(year, month1a12, 0).getDate())}`;
      const { data, error } = await supabase.from("task_occurrences")
        .select("*").gte("fecha", desde).lte("fecha", hasta).order("fecha");
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
}

// Ocurrencias de una card puntual en un mes (para la grilla de cumplimiento diario).
export function useCardOccurrences(cardId: string, year: number, month1a12: number) {
  return useQuery({
    queryKey: ["occurrences", "card", cardId, year, month1a12],
    queryFn: async (): Promise<TaskOccurrence[]> => {
      const desde = `${year}-${pad(month1a12)}-01`;
      const hasta = `${year}-${pad(month1a12)}-${pad(new Date(year, month1a12, 0).getDate())}`;
      const { data, error } = await supabase.from("task_occurrences")
        .select("*").eq("card_id", cardId).gte("fecha", desde).lte("fecha", hasta).order("fecha");
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
}

// TODAS las ocurrencias de una card (sin filtro de mes) — para la evolución de cumplimiento
// del arqueo. DEFENSIVA: ante cualquier error (migración no aplicada) devuelve [].
export function useCardOccurrencesAll(cardId: string, enabled = true) {
  return useQuery({
    queryKey: ["occurrences", "card-all", cardId],
    enabled,
    queryFn: async (): Promise<TaskOccurrence[]> => {
      const { data, error } = await supabase.from("task_occurrences")
        .select("*").eq("card_id", cardId).order("fecha");
      if (error) return [];
      return (data as TaskOccurrence[]) ?? [];
    },
  });
}
