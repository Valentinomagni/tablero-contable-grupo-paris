#!/usr/bin/env node
// ============================================================
// Bandeja de consultas — SOLO LECTURA.
//
// Baja las consultas, sugerencias y errores que reportó el equipo y las escribe en
// `consultas-bandeja.md` para poder leerlas y analizarlas fuera de la app.
//
// Uso:
//   1) Crear `.env.consultas.local` en la raíz del repo con:
//        SUPABASE_EMAIL=cuenta.de.administracion@...
//        SUPABASE_PASSWORD=...
//   2) node scripts/consultas.mjs
//
// Ese archivo está ignorado por git y NO debe salir de esta máquina.
//
// Sin dependencias nuevas: `fetch` nativo de Node 18+, igual que scripts/rls-smoke.mjs.
// No hace POST, PATCH ni DELETE sobre datos reales: solo el login y dos GET.
// Marcar una consulta como leída o responderla se sigue haciendo desde la app.
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Node 24 lee TypeScript directamente (borra los tipos y ejecuta), así que el informe se
// importa de la MISMA lib que cubren los tests. Sin compilar nada y sin copiar la lógica
// acá: una sola versión, la testeada.
import { informeConsultas } from "../src/lib/consultas-informe.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "consultas-bandeja.md");

// Los mismos valores públicos que usa la app (src/lib/supabase.ts). No son secretos:
// la clave publicable está pensada para vivir en el navegador, y RLS es lo que protege.
const SUPABASE_URL = "https://yyyrlopgwmuvfbzwxiwp.supabase.co";
const ANON_KEY = "sb_publishable_cL-5aTeSpy2dNBQHzqO9Sg_D_fncvGN";

/**
 * Error de configuración, con la ayuda adentro. LANZA en vez de llamar a `process.exit()`:
 * en Node 24 sobre Windows, cortar el proceso de golpe hace abortar a libuv con un
 * "Assertion failed" que se imprime DEBAJO del mensaje de ayuda y cambia el código de
 * salida a 127. Con un throw hay un solo camino de salida, el de abajo, y sale ordenado.
 */
function errorDeConfig(motivo) {
  return new Error(`${motivo}

Falta el archivo de credenciales. Creá "${join(RAIZ, ".env.consultas.local")}" con:

  SUPABASE_EMAIL=cuenta.de.administracion@ejemplo.com
  SUPABASE_PASSWORD=la-contrasena

Es la misma cuenta con la que entrás a la app a ver las consultas. El archivo está
ignorado por git y no sale de esta computadora.`);
}

/** Lee un .env simple (CLAVE=valor por línea). Sin dependencias. */
function leerEnv(ruta) {
  let crudo;
  try { crudo = readFileSync(ruta, "utf8"); }
  // Distingue "no existe" de "existe pero no puedo leerlo": mandar a crear un archivo que
  // ya está ahí es la clase de mensaje que hace perder media hora.
  catch (e) {
    throw errorDeConfig(e.code === "ENOENT"
      ? "No encontré las credenciales."
      : `No pude leer el archivo de credenciales (${e.code}).`);
  }
  const env = {};
  for (const linea of crudo.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function iniciarSesion(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`No pude iniciar sesión (${r.status}). Revisá el email y la contraseña.\n${detalle}`);
  }
  const { access_token, user } = await r.json();
  if (!access_token) throw new Error("El login no devolvió una sesión válida.");
  // El id se usa para poder avisar si la cuenta sólo está viendo sus propias consultas.
  return { token: access_token, userId: user?.id ?? null };
}

async function traer(tabla, columnas, token) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=${columnas}`;
  const r = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${token}`,
      // `count=exact` hace que Supabase devuelva el total real en Content-Range. Sin eso no
      // hay forma de distinguir "hay 1000" de "te devolví 1000 de 4000": el informe saldría
      // truncado y con pinta de completo, que es la peor combinación posible.
      prefer: "count=exact",
    },
  });
  if (!r.ok) throw new Error(`No pude leer "${tabla}" (${r.status}): ${await r.text()}`);
  const filas = await r.json();
  const total = Number((r.headers.get("content-range") ?? "").split("/")[1]);
  if (Number.isFinite(total) && total > filas.length) {
    console.log(
      `Aviso: "${tabla}" tiene ${total} filas y el servidor devolvió ${filas.length}.\n` +
      "El informe está incompleto porque Supabase limita la cantidad de filas por consulta.",
    );
  }
  return filas;
}

async function main() {
  const env = leerEnv(join(RAIZ, ".env.consultas.local"));
  if (!env.SUPABASE_EMAIL || !env.SUPABASE_PASSWORD) {
    throw errorDeConfig("El archivo de credenciales está incompleto.");
  }

  const { token, userId } = await iniciarSesion(env.SUPABASE_EMAIL, env.SUPABASE_PASSWORD);
  const [consultas, perfiles] = await Promise.all([
    traer("consultas", "id,autor,tipo,texto,estado,respuesta,created_at,respondida_at", token),
    traer("profiles", "id,name", token),
  ]);

  // La regla de RLS es `autor = auth.uid() or es_admin_sistema()`. Una cuenta que no sea
  // admin NO recibe un error: recibe sus propias consultas y un 200, así que el informe
  // sale parcial con pinta de completo. Por eso el aviso no puede depender sólo de que
  // venga vacío: también hay que mirar si todo lo que vino es de uno mismo.
  const soloPropias = consultas.length > 0 && userId && consultas.every((c) => c.autor === userId);
  if (consultas.length === 0 || soloPropias) {
    console.log(
      (consultas.length === 0
        ? "La consulta funcionó pero no vino ninguna fila.\n"
        : "Ojo: todas las consultas que vinieron son tuyas.\n") +
      "Puede ser que el resto del equipo todavía no haya mandado nada, o que esta cuenta no\n" +
      "tenga permiso para ver las de los demás: hace falta la migración 33 aplicada y que la\n" +
      "cuenta esté marcada como administradora del sistema.",
    );
  }

  writeFileSync(SALIDA, informeConsultas(consultas, perfiles, new Date().toISOString()), "utf8");

  const nuevas = consultas.filter((c) => c.estado === "nueva").length;
  console.log(`Listo: ${consultas.length} consultas (${nuevas} nuevas) en consultas-bandeja.md`);
}

// `exitCode` y NO `process.exit()`: cortar el proceso de golpe con una conexión HTTP todavía
// abierta hace abortar a libuv en Windows, y entonces el error real queda tapado por un
// "Assertion failed" y el código de salida pasa a ser 127. Así Node cierra ordenado y el
// código de salida es 1, que es lo que cualquier script que lo llame va a mirar.
main().catch((e) => { console.error("\n" + e.message); process.exitCode = 1; });
