import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Note } from "../lib/types";

// Notas privadas del usuario (RLS owner-only).
// DEFENSIVO: si la tabla `notes` aún no existe (migración 18 sin aplicar),
// la query falla; devolvemos [] para que la vista cargue vacía sin crashear.
export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
      if (error) return [];
      return (data as Note[]) ?? [];
    },
  });
}
