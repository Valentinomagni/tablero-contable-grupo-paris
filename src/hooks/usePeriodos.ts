import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { CierrePeriodo } from "../lib/types";

// Cierre mensual por persona (migración 29, tabla `cierre_periodos`).
// DEFENSIVO: si la migración no está aplicada (tabla inexistente) o hay cualquier
// error, la query devuelve [] y la UI muestra el cierre como "no disponible todavía"
// en vez de romper. RLS ya limita quién ve qué (propio, jefe, o encargado del owner).
export function usePeriodos() {
  return useQuery({
    queryKey: ["periodos"],
    queryFn: async (): Promise<CierrePeriodo[]> => {
      const { data, error } = await supabase.from("cierre_periodos")
        .select("*").order("mes", { ascending: false });
      if (error) return [];
      return (data as CierrePeriodo[]) ?? [];
    },
  });
}

// ¿Existe la tabla? La query de arriba devuelve [] tanto si la migración 29 no está
// aplicada como si nadie cerró nada todavía — y esos dos casos se le explican distinto
// al usuario. Este chequeo barato (una fila, sin datos) los separa: error → false.
export function usePeriodosDisponibles() {
  return useQuery({
    queryKey: ["periodos", "disponible"],
    queryFn: async (): Promise<boolean> => {
      const { error } = await supabase.from("cierre_periodos").select("id").limit(1);
      return !error;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Cerrar / reabrir SU propio mes. Cada fila es independiente: cerrar julio no toca junio.
// `cerrado_at` lo pone el trigger de la base con now() (no se puede backdatear).
export function useCerrarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ownerId, mes, nota }: { ownerId: string; mes: string; nota?: string }) => {
      const { error } = await supabase.from("cierre_periodos")
        .insert({ owner: ownerId, mes, nota: nota ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periodos"] }),
  });
}

export function useReabrirMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ownerId, mes }: { ownerId: string; mes: string }) => {
      const { error } = await supabase.from("cierre_periodos")
        .delete().eq("owner", ownerId).eq("mes", mes);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periodos"] }),
  });
}
