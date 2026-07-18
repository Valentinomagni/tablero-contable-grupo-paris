import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Vacacion } from "../lib/types";

// Vacaciones del equipo (spec 24 item 5). DEFENSIVA: si la tabla aún no existe
// (migración 23 sin aplicar) o hay cualquier error, devuelve [] para que el
// Calendario y el modal carguen vacíos sin romper la app.
export function useVacaciones() {
  return useQuery({
    queryKey: ["vacaciones"],
    queryFn: async (): Promise<Vacacion[]> => {
      const { data, error } = await supabase.from("vacaciones").select("*").order("desde");
      if (error) return [];
      return (data as Vacacion[]) ?? [];
    },
  });
}
