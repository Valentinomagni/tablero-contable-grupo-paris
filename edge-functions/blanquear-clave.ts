// Edge Function "blanquear-clave" — pegar en:
// Supabase Dashboard → Edge Functions → blanquear-clave → Edit → reemplazar TODO → Deploy
//
// POR QUÉ EXISTE. El 30/07/2026 un empleado no pudo volver a entrar y hubo que arreglarlo a
// mano desde el panel de Supabase. Eso hace que un problema de cinco minutos dependa de una
// persona con acceso a la consola de la base: si no está, el empleado no trabaja.
//
// POR QUÉ NO SE HACE DESDE EL NAVEGADOR. Cambiar la contraseña de otra persona necesita la
// `service_role`, y esa clave se saltea RLS entero: con ella se lee y escribe TODA la base.
// Puesta en el navegador queda a la vista de cualquiera que abra las herramientas de
// desarrollo. Por eso vive acá, del lado del servidor, y esta función es el único camino.
//
// POR QUÉ NO SE USA EL MAIL DE RECUPERACIÓN. Depende de que la casilla exista y de que llegue
// el mail. Acá los usuarios se crean con un correo que el jefe escribe a mano y que puede no
// ser una casilla real. Un blanqueo que quizá no llega es peor que no tener blanqueo.
//
// ⚠ Este archivo es solo referencia local: NO subirlo a Netlify/Cloudflare.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Mismo mínimo que pide Supabase Auth. */
const MINIMO_CLAVE = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const fail = (s: number, m: string) =>
    new Response(JSON.stringify({ error: m }), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Quién llama. El JWT viene del navegador y lo valida el servidor de auth: no se
    //    confía en nada que mande el cliente sobre su propia identidad.
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return fail(401, "Sesión inválida. Cerrá sesión y volvé a entrar.");

    // 2) Sólo el jefe. Se lee el rol de la base con la service key, NUNCA del cuerpo del
    //    pedido: si el rol lo mandara el cliente, cualquiera se declararía jefe.
    const { data: perfil } = await admin.from("profiles").select("role, name").eq("id", user.id).single();
    if (perfil?.role !== "jefe") return fail(403, "Solo un jefe puede blanquear contraseñas.");

    const { userId, nuevaClave } = await req.json();
    if (!userId) return fail(400, "Falta indicar de quién es la contraseña.");
    if (typeof nuevaClave !== "string" || nuevaClave.trim().length < MINIMO_CLAVE) {
      return fail(400, `La contraseña necesita al menos ${MINIMO_CLAVE} caracteres.`);
    }

    // 3) Que el destinatario exista de verdad. Sin esto, un id equivocado daría un error
    //    técnico de Auth en vez de decir que esa persona no está.
    const { data: destino } = await admin.from("profiles").select("id, name").eq("id", userId).single();
    if (!destino) return fail(404, "No encontré a esa persona en el equipo.");

    // 4) El cambio en sí.
    const { error } = await admin.auth.admin.updateUserById(userId, { password: nuevaClave.trim() });
    if (error) return fail(400, "No se pudo cambiar la contraseña: " + error.message);

    // 5) Rastro. Un cambio de contraseña ajena SIEMPRE tiene que quedar registrado: es la
    //    diferencia entre una herramienta de soporte y una puerta trasera. Si la tabla de
    //    notificaciones no existiera, el blanqueo NO se deshace por eso — ya está hecho.
    try {
      await admin.from("notifications").insert({
        owner: userId,
        tipo: "sistema",
        titulo: "Tu contraseña fue restablecida",
        detalle: `${perfil.name ?? "La administración"} generó una contraseña nueva para tu cuenta. Cambiala cuando entres.`,
        leida: false,
      });
    } catch { /* el aviso es deseable, no imprescindible */ }

    return new Response(JSON.stringify({ ok: true, nombre: destino.name }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return fail(500, "Error inesperado: " + (e as Error).message);
  }
});
