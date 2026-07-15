import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Card, Profile, Objective, ActivityLog } from "../lib/types";
import type { DepInfo, RevDep } from "../lib/deps";
import { CardSchema, validateRows } from "../lib/schemas";

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

export function useTeam(isJefe: boolean) {
  return useQuery({
    queryKey: ["team", isJefe],
    queryFn: async (): Promise<Profile[]> => {
      const { data } = await supabase.from("profiles").select("*").order("role").order("name");
      return (data as Profile[]) ?? [];
    },
    enabled: isJefe,
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
