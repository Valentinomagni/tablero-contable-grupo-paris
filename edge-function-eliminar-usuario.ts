// Edge Function "eliminar-usuario" — pegar en:
// Supabase Dashboard → Edge Functions → eliminar-usuario → Edit → reemplazar TODO → Deploy
//
// v2.1 (16/07): los OBJETIVOS del empleado ahora se ELIMINAN en vez de reasignarse
// (decisión de la spec 21: los objetivos son personales, no tiene sentido heredarlos).
// Las cards y ocurrencias siguen yendo al centinela "Sin asignar".
// v2 (16/07): el perfil "Sin asignar" ahora lo crea ESTA función la primera vez que hace
// falta (con la service key crea el auth user real). La migración 17 no alcanzaba porque
// profiles.id tiene FK a auth.users y un UUID inventado viola cards_owner_fkey.
//
// Verifica que quien llama sea jefe; reasigna cards (y ocurrencias) del usuario al
// centinela, elimina sus objectives y recién ahí borra el auth user (el profile cae en cascada).
// ⚠ Este archivo es solo referencia local: NO subirlo a Netlify/Cloudflare.
import { createClient } from "npm:@supabase/supabase-js@2";

const SIN_ASIGNAR_EMAIL = "sin-asignar@grupoparis.com";

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

    // 1) Asegurar el centinela "Sin asignar" (auth user REAL — evita violar cards_owner_fkey).
    let { data: centinela } = await admin.from("profiles").select("id").eq("email", SIN_ASIGNAR_EMAIL).maybeSingle();
    if (!centinela) {
      const { data: nuevo, error: eNew } = await admin.auth.admin.createUser({
        email: SIN_ASIGNAR_EMAIL, email_confirm: true, password: crypto.randomUUID() + "Aa1!",
      });
      if (eNew || !nuevo?.user) return fail(400, "No se pudo crear el perfil Sin asignar: " + (eNew?.message ?? "?"));
      const { error: eProf } = await admin.from("profiles").upsert({
        id: nuevo.user.id, name: "Sin asignar", role: "empleado",
        email: SIN_ASIGNAR_EMAIL, puesto: "Reasignar", ficha: "",
      });
      if (eProf) return fail(400, "No se pudo crear el profile Sin asignar: " + eProf.message);
      centinela = { id: nuevo.user.id };
    }
    if (userId === centinela.id) return fail(400, "No se puede eliminar el perfil Sin asignar.");

    // 2) Reasignar tareas al centinela para no perderlas; los objetivos se ELIMINAN
    //    (v2.1: son personales — no se heredan).
    const { data: reasign, error: eCards } = await admin.from("cards")
      .update({ owner: centinela.id }).eq("owner", userId).select("id");
    if (eCards) return fail(400, "No se pudieron reasignar las tareas: " + eCards.message);
    const { error: eObj } = await admin.from("objectives")
      .delete().eq("owner", userId);
    if (eObj) return fail(400, "No se pudieron eliminar los objetivos: " + eObj.message);
    // ocurrencias de tareas recurrentes: mantenerlas vivas junto con sus cards (best-effort)
    await admin.from("task_occurrences").update({ owner: centinela.id }).eq("owner", userId);

    // 3) Borrar el usuario (el profile cae en cascada por FK; si no, lo borramos explícito).
    const { error: eDel } = await admin.auth.admin.deleteUser(userId);
    if (eDel) return fail(400, eDel.message);
    await admin.from("profiles").delete().eq("id", userId);

    return new Response(JSON.stringify({ ok: true, reasignadas: reasign?.length ?? 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return fail(500, String(e));
  }
});
