import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Card, Profile, Objective, ActivityLog } from "../lib/types";
import type { DepInfo, RevDep } from "../lib/deps";
import { CardSchema, validateRows } from "../lib/schemas";
import type { Organizacion } from "../lib/organizacion";
import { parseOrganizacion, DEFAULT_ORG } from "../lib/organizacion";

// título/estado/responsable de deps que apuntan a tarjetas ajenas (security definer)
export function useDepsInfo(missing: string[]) {
  return useQuery({
    queryKey: ["deps-info", [...missing].sort()],
    queryFn: async (): Promise<DepInfo[]> => {
      const { data } = await supabase.rpc("deps_info", { ids: missing });
      return (data as DepInfo[]) ?? [];
    },
    enabled: missing.length > 0,
  });
}

// tareas ajenas que dependen de las mías (solo tiene sentido para no-jefes)
export function useReverseDeps(cardIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["reverse-deps", [...cardIds].sort()],
    queryFn: async (): Promise<RevDep[]> => {
      const { data } = await supabase.rpc("reverse_deps", { ids: cardIds });
      return (data as RevDep[]) ?? [];
    },
    enabled: enabled && cardIds.length > 0,
  });
}

export function useObjectives() {
  return useQuery({
    queryKey: ["objectives"],
    queryFn: async (): Promise<Objective[]> => {
      const { data } = await supabase.from("objectives").select("*").order("created_at");
      return (data as Objective[]) ?? [];
    },
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at");
      return (data as import("../lib/types").Announcement[]) ?? [];
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: async (): Promise<ActivityLog[]> => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data } = await supabase.from("activity_log").select("*").gte("at", since).order("at", { ascending: false });
      return (data as ActivityLog[]) ?? [];
    },
  });
}

// fotos diarias por persona (cron snapshot-diario) para la evolución de carga
export function useSnapshots(enabled: boolean) {
  return useQuery({
    queryKey: ["snapshots"],
    queryFn: async (): Promise<import("../lib/types").Snapshot[]> => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("daily_snapshots").select("*").gte("day", since).order("day");
      return (data as import("../lib/types").Snapshot[]) ?? [];
    },
    enabled,
  });
}

// settings key='permissions': { edit_closed, board_name, due_warn_days, stuck_days }
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<import("../lib/types").AppSettings> => {
      // maybeSingle (no single): sin sesión aún, RLS devuelve 0 filas — evita el 406 en el primer render.
      const { data } = await supabase.from("settings").select("value").eq("key", "permissions").maybeSingle();
      return (data?.value as import("../lib/types").AppSettings) ?? { edit_closed: false };
    },
  });
}

// settings key='organizacion': { marcas: string[], sucursales: string[] } (spec 26)
export function useOrganizacion(): Organizacion {
  const { data } = useQuery({
    queryKey: ["organizacion"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "organizacion").maybeSingle();
      return parseOrganizacion(data?.value);
    },
  });
  return data ?? DEFAULT_ORG;
}

// settings key='tiempos_max': Record<categoría, horas> — SLA por categoría (spec 28, Task 4).
// Defensivo: sin fila o sin migración aplicada -> {} (sin límites configurados).
export function useTiemposMax(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ["tiempos_max"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase.from("settings").select("value").eq("key", "tiempos_max").maybeSingle();
      const v = data?.value;
      return v && typeof v === "object" ? (v as Record<string, number>) : {};
    },
  });
  return data ?? {};
}

// enabled: jefe y encargado traen los profiles (RLS del Plan 02 limita lo que ve el encargado).
// El empleado no consulta — App le arma team = [me].
// refrescá cada 90s pa' que la presencia no quede congelada
export function useTeam(enabled: boolean) {
  return useQuery({
    queryKey: ["team", enabled],
    queryFn: async (): Promise<Profile[]> => {
      const { data } = await supabase.from("profiles").select("*").order("role").order("name");
      return (data as Profile[]) ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 90_000,
    enabled,
  });
}

// estado de migraciones (spec 27, T2): null si la tabla no existe todavía (p.ej. sin migración 28 aplicada)
export function useMigraciones() {
  return useQuery({
    queryKey: ["migraciones"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number[] | null> => {
      const { data, error } = await supabase.from("schema_migrations").select("id");
      if (error || !data) return null;
      return (data as { id: number }[]).map((r) => r.id);
    },
  });
}

// Consultas (Task 3, spec 28): defensivo — si la tabla no existe todavía (migración 29 sin correr),
// la queryFn tira el error (react-query lo expone via isError) y quien no lo mira usa `data ?? []`.
// RLS ya filtra: autor ve las suyas, jefe ve todas.
export function useConsultas() {
  return useQuery({
    queryKey: ["consultas"],
    queryFn: async (): Promise<import("../lib/types").Consulta[]> => {
      const { data, error } = await supabase.from("consultas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as import("../lib/types").Consulta[]) ?? [];
    },
    retry: false,
  });
}

// Solo para el badge del jefe en Administración: cuenta de estado 'nueva'.
// Sólo el jefe ve el badge de la bandeja: sin `enabled` esta query corría para los ~30
// usuarios del equipo en cada carga, pidiendo filas que RLS les devuelve vacías igual.
export function useConsultasNuevas(isJefe: boolean) {
  return useQuery({
    queryKey: ["consultas-nuevas"],
    enabled: isJefe,
    queryFn: async (): Promise<import("../lib/types").Consulta[]> => {
      const { data, error } = await supabase.from("consultas").select("*").eq("estado", "nueva");
      if (error) return [];
      return (data as import("../lib/types").Consulta[]) ?? [];
    },
  });
}

export function useCards() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("cards-live-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" },
        () => qc.invalidateQueries({ queryKey: ["cards"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["cards"],
    queryFn: async (): Promise<Card[]> => {
      const { data } = await supabase.from("cards").select("*").order("created_at");
      return validateRows((data as Card[]) ?? [], CardSchema, "cards");
    },
  });
}
