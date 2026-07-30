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

function salirConAyuda(motivo) {
  console.error(`
${motivo}

Falta el archivo de credenciales. Creá "${join(RAIZ, ".env.consultas.local")}" con:

  SUPABASE_EMAIL=cuenta.de.administracion@ejemplo.com
  SUPABASE_PASSWORD=la-contrasena

Es la misma cuenta con la que entrás a la app a ver las consultas. El archivo está
ignorado por git y no sale de esta computadora.
`);
  process.exit(1);
}

/** Lee un .env simple (CLAVE=valor por línea). Sin dependencias. */
function leerEnv(ruta) {
  let crudo;
  try { crudo = readFileSync(ruta, "utf8"); }
  catch { salirConAyuda("No encontré las credenciales."); }
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
  const { access_token } = await r.json();
  if (!access_token) throw new Error("El login no devolvió una sesión válida.");
  return access_token;
}

async function traer(tabla, columnas, token) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=${columnas}`;
  const r = await fetch(url, {
    headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`No pude leer "${tabla}" (${r.status}): ${await r.text()}`);
  return r.json();
}

async function main() {
  const env = leerEnv(join(RAIZ, ".env.consultas.local"));
  if (!env.SUPABASE_EMAIL || !env.SUPABASE_PASSWORD) {
    salirConAyuda("El archivo de credenciales está incompleto.");
  }

  const token = await iniciarSesion(env.SUPABASE_EMAIL, env.SUPABASE_PASSWORD);
  const [consultas, perfiles] = await Promise.all([
    traer("consultas", "id,autor,tipo,texto,estado,respuesta,created_at,respondida_at", token),
    traer("profiles", "id,name", token),
  ]);

  if (consultas.length === 0) {
    console.log(
      "La consulta funcionó pero no vino ninguna fila.\n" +
      "Puede ser que todavía nadie haya mandado nada, o que esta cuenta no tenga permiso\n" +
      "para verlas (hace falta la migración 33 y que la cuenta sea admin del sistema).",
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
