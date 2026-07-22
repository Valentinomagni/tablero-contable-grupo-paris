import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Notification } from "../lib/types";

// Notificaciones del usuario (RLS owner-only), más recientes primero.
// DEFENSIVO: si la tabla `notifications` aún no existe (migración 21 sin aplicar),
// la query falla; devolvemos [] para que la campana quede sin badge y la app no
// crashee ni ensucie la consola.
// Realtime (spec 28, Task 7): reemplaza el polling de 60s por un canal suscripto a los
// INSERT propios (columna `owner`, ver migracion-21-notificaciones.sql), replicando el
// patrón de `useCards` en useData.ts (canal + invalidateQueries + removeChannel).
export function useNotifications() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    supabase.auth.getUser().then(({ data: { user } }) => { if (activo) setUid(user?.id ?? null); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("notif-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `owner=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, uid]);

  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase.from("notifications")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (error) return [];
      return (data as Notification[]) ?? [];
    },
    // Red de seguridad: si realtime no está habilitado para `notifications` en el dashboard
    // de Supabase (Database > Replication, paso manual pendiente), la campana no debe quedar
    // congelada para siempre — refresco de respaldo cada 5 min en vez de los 60s anteriores.
    refetchInterval: 5 * 60_000,
  });
}

export function noLeidas(notifs: Notification[]): number {
  return notifs.filter((n) => !n.leida).length;
}
