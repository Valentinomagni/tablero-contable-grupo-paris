import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export function useAuth() {
  const qc = useQueryClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMe(null); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setMe((data as Profile) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
      qc.invalidateQueries(); // los datos con RLS deben re-traerse con la sesión nueva
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error;
  }
  async function signOut() {
    await supabase.auth.signOut();
    setMe(null);
  }

  return { me, loading, signIn, signOut };
}
