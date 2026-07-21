import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { CierrePeriodo } from "../lib/types";

// Cierre mensual por persona (migración 29, tabla `cierre_periodos`).
// DEFENSIVO pero sin mentir: si la tabla no existe (migración 29 no aplicada) o hay
// cualquier otro error de red/permiso, la query queda en error — no se lo traga.
// La UI discrimina el mensaje según `error.code` (ver Cierre.tsx): tabla inexistente
// vs. cualquier otro error real, que antes se mostraba igual ("no disponible todavía")
// y podía ocultar una falla de red genuina.
export function usePeriodos() {
  return useQuery({
    queryKey: ["periodos"],
    queryFn: async (): Promise<CierrePeriodo[]> => {
      const { data, error } = await supabase.from("cierre_periodos")
        .select("*").order("mes", { ascending: false });
      if (error) throw error;
      return (data as CierrePeriodo[]) ?? [];
    },
  });
}

// Código de error de Postgres/PostgREST cuando la tabla `cierre_periodos` no existe
// (migración 29 no aplicada todavía).
export function esTablaInexistente(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

// Cerrar / reabrir SU propio mes. Cada fila es independiente: cerrar julio no toca junio.
// `cerrado_at` lo pone el trigger de la base con now() (no se puede backdatear).
// upsert + ignoreDuplicates: un doble click (o una segunda pestaña) no debe mostrarle
// al usuario el error crudo de Postgres por violar unique(owner, mes); simplemente no
// pasa nada la segunda vez.
export function useCerrarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ownerId, mes, nota }: { ownerId: string; mes: string; nota?: string }) => {
      const { error } = await supabase.from("cierre_periodos")
        .upsert({ owner: ownerId, mes, nota: nota ?? null }, { onConflict: "owner,mes", ignoreDuplicates: true });
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
