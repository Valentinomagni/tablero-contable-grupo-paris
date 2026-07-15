// Edge Function "eliminar-usuario" — pegar en:
// Supabase Dashboard → Edge Functions → Deploy new function → nombre: eliminar-usuario
// Verifica que quien llama sea jefe; reasigna las cards/objectives del usuario al
// perfil centinela "Sin asignar" (migración 17) y recién ahí borra el auth user y el profile.
// (las env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ya existen en el runtime).
// ⚠ Este archivo es solo referencia: NO subirlo a Netlify.
import { createClient } from "npm:@supabase/supabase-js@2";

const SIN_ASIGNAR_ID = "00000000-0000-0000-0000-000000000000";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const fail = (s: number, m: string) =>
    new Response(JSON.stringify({ error: m }), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return fail(401, "Sesión inválida.");
    const { data: perfil } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (perfil?.role !== "jefe") return fail(403, "Solo los jefes pueden eliminar usuarios.");

    const { userId } = await req.json();
    if (!userId) return fail(400, "Falta userId.");
    if (userId === user.id) return fail(400, "No podés eliminarte a vos mismo.");
    if (userId === SIN_ASIGNAR_ID) return fail(400, "No se puede eliminar el perfil Sin asignar.");

    // Reasignar tareas al centinela para no perderlas.
    const { data: reasign, error: eCards } = await admin.from("cards")
      .update({ owner: SIN_ASIGNAR_ID }).eq("owner", userId).select("id");
    if (eCards) return fail(400, "No se pudieron reasignar las tareas: " + eCards.message);
    const { error: eObj } = await admin.from("objectives")
      .update({ owner: SIN_ASIGNAR_ID }).eq("owner", userId);
    if (eObj) return fail(400, "No se pudieron reasignar los objetivos: " + eObj.message);

    const { error: eDel } = await admin.auth.admin.deleteUser(userId);
    if (eDel) return fail(400, eDel.message);
    await admin.from("profiles").delete().eq("id", userId);

    return new Response(JSON.stringify({ ok: true, reasignadas: reasign?.length ?? 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return fail(500, String(e));
  }
});
