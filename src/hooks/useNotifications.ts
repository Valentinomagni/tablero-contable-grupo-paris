import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Notification } from "../lib/types";

// Notificaciones del usuario (RLS owner-only), más recientes primero.
// DEFENSIVO: si la tabla `notifications` aún no existe (migración 21 sin aplicar),
// la query falla; devolvemos [] para que la campana quede sin badge y la app no
// crashee ni ensucie la consola. Refresco liviano cada 60 s (realtime opcional a futuro).
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase.from("notifications")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (error) return [];
      return (data as Notification[]) ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function noLeidas(notifs: Notification[]): number {
  return notifs.filter((n) => !n.leida).length;
}
