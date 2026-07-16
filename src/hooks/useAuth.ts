import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { resuelveIdentificador } from "../lib/auth";

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

  // Compatibilidad hacia atrás durante la transición a login por usuario (spec #16):
  // - Si el identificador tiene "@" -> es EMAIL, autentica directo (comportamiento histórico).
  // - Si no tiene "@" -> es USERNAME, se resuelve el email vía RPC email_por_usuario.
  //   Si la RPC no existe (migración 19 sin aplicar) o no encuentra el usuario -> error claro,
  //   pero nadie queda bloqueado porque el email sigue funcionando por la rama de arriba.
  async function signIn(identificador: string, password: string) {
    const id = identificador.trim();
    if (resuelveIdentificador(id) === "email") {
      const { error } = await supabase.auth.signInWithPassword({ email: id, password });
      return error;
    }
    const { data: email } = await supabase.rpc("email_por_usuario", { u: id });
    if (!email) return { message: "Usuario no encontrado" };
    const { error } = await supabase.auth.signInWithPassword({ email: email as string, password });
    return error;
  }
  async function signOut() {
    await supabase.auth.signOut();
    setMe(null);
  }

  return { me, loading, signIn, signOut };
}
