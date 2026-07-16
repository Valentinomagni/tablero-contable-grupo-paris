import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { CardArchive } from "../lib/types";

// Archivo mensual de una persona (cards_archive). DEFENSIVA: si la migración 22
// no está aplicada (tabla inexistente) o hay cualquier error, devuelve [] y la
// vista Historial muestra su empty state sin romper la app. RLS ya limita quién ve qué.
export function useArchive(ownerId: string) {
  return useQuery({
    queryKey: ["archive", ownerId],
    queryFn: async (): Promise<CardArchive[]> => {
      const { data, error } = await supabase.from("cards_archive")
        .select("*").eq("owner", ownerId).order("mes", { ascending: false });
      if (error) return [];
      return (data as CardArchive[]) ?? [];
    },
    enabled: !!ownerId,
  });
}
