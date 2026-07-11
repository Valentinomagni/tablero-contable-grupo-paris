import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Card, Profile, Objective, ActivityLog } from "../lib/types";

export function useObjectives() {
  return useQuery({
    queryKey: ["objectives"],
    queryFn: async (): Promise<Objective[]> => {
      const { data } = await supabase.from("objectives").select("*").order("created_at");
      return (data as Objective[]) ?? [];
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
      return (data as Card[]) ?? [];
    },
  });
}
