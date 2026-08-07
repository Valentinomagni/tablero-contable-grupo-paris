// Edge Function "crear-usuario" — pegar en:
// Supabase Dashboard → Edge Functions → Deploy new function → nombre: crear-usuario
// Verifica que quien llama sea jefe y recién ahí crea el usuario con la service key
// (las env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ya existen en el runtime).
// ⚠ Este archivo es solo referencia: NO subirlo a Netlify.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (perfil?.role !== "jefe") return fail(403, "Solo los jefes pueden crear usuarios.");

    const { email, password, name, role, puesto } = await req.json();
    if (!email || !password || password.length < 8) return fail(400, "Email y contraseña (mínimo 8) son obligatorios.");
    if (!["jefe", "encargado", "empleado"].includes(role)) return fail(400, "Rol inválido.");

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name: name || email.split("@")[0], role },
    });
    if (error) return fail(400, error.message);
    if (puesto) await admin.from("profiles").update({ puesto }).eq("id", data.user.id);
    return new Response(JSON.stringify({ ok: true, id: data.user.id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return fail(500, String(e));
  }
});
