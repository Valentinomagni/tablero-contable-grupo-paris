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
// PENDIENTE DE DESPLIEGUE — 14/08/2026. El bloqueo de la cuenta de administración (punto 3.b,
// más abajo) NO tiene ningún efecto hasta que esta función se vuelva a desplegar: lo que corre
// en producción es la copia que vive en Supabase, no este archivo. Hasta entonces el agujero
// sigue abierto, que es la peor combinación posible —arreglado en el código y roto en
// producción—, porque quien lea el repositorio va a creer que está resuelto.
// Redespliegue: Supabase Dashboard → Edge Functions → blanquear-clave → Edit → reemplazar TODO
// con este archivo → Deploy. Borrá estas seis líneas recién cuando esté desplegada.
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
    //    técnico de Auth en vez de decir que esa persona no está. `admin_sistema` se trae en
    //    ESTE select, de la base y con la service key, por la misma razón que el rol de arriba:
    //    la decisión del punto siguiente no puede depender de nada que mande el cliente.
    const { data: destino } = await admin.from("profiles").select("id, name, admin_sistema").eq("id", userId).single();
    if (!destino) return fail(404, "No encontré a esa persona en el equipo.");

    // 3.b) La cuenta de administración del sistema NO se blanquea desde acá, ni siendo jefe.
    //      POR QUÉ. `admin_sistema` es un usuario fantasma aparte (migración 33) y es lo único
    //      que gatea la bandeja de Consultas: ahí el equipo reporta problemas contando con que
    //      el jefe no los lee. La migración 39 cerró el camino directo —ya nadie se puede dar
    //      esa marca desde la aplicación—, pero blanquearle la clave a esa cuenta y entrar como
    //      ella llega exactamente al mismo lugar por la puerta de al lado. Una promesa de
    //      confidencialidad que se puede esquivar es peor que no haberla hecho: el día que
    //      alguien descubra que se podía, el canal se muere y con él la única fuente honesta
    //      de qué hay que mejorar.
    //      La clave de esa cuenta se cambia donde se la creó: panel de Supabase →
    //      Authentication → Users. Ese panel ya exige la sesión del dueño de la base, que es
    //      justo el control que acá no existe.
    if (destino.admin_sistema) {
      return fail(403, "La contraseña de la cuenta de administración del sistema se cambia desde el panel de Supabase, no desde acá.");
    }

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
