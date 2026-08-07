#!/usr/bin/env node
// ¿Qué migraciones están corridas en la base? Consultarlo, en vez de preguntar.
//
// POR QUÉ EXISTE. Cada tanda terminaba igual: "corré la migración N" y, la sesión siguiente,
// "¿la corriste?". Eso es retrabajo puro — muda de espera y de movimiento en el mismo paso. El
// dato existe en la base (`schema_migrations`, que la migración 28 creó justamente para esto) y
// se puede leer. Preguntar cuando se puede consultar es no haber terminado el trabajo.
//
// Uso:
//   export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
//   node scripts/migraciones.mjs
//
// Usa el MISMO archivo de credenciales que `scripts/consultas.mjs` (`.env.consultas.local`), así
// que si ya está configurado, esto anda sin tocar nada. Está ignorado por git.
//
// Sin dependencias: `fetch` nativo, igual que consultas.mjs y rls-smoke.mjs.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA = join(RAIZ, "db", "migraciones");

// Los mismos valores públicos que usa la app. No son secretos: la clave publicable está pensada
// para vivir en el navegador, y RLS es lo que protege.
const SUPABASE_URL = "https://yyyrlopgwmuvfbzwxiwp.supabase.co";
const ANON_KEY = "sb_publishable_cL-5aTeSpy2dNBQHzqO9Sg_D_fncvGN";

/**
 * Error de configuración con la ayuda adentro.
 *
 * LANZA en vez de llamar a `process.exit()`: en Node sobre Windows, cortar el proceso con un
 * socket abierto hace abortar a libuv con un "Assertion failed" que se imprime DEBAJO del
 * mensaje y cambia el código de salida a 127. Mismo motivo que en `consultas.mjs`.
 */
function errorDeConfig(motivo) {
  return new Error(`${motivo}

Creá "${join(RAIZ, ".env.consultas.local")}" con:

  SUPABASE_EMAIL=cuenta.de.administracion@ejemplo.com
  SUPABASE_PASSWORD=la-contrasena

Es la misma cuenta con la que entrás a la app. El archivo está ignorado por git y no sale
de esta computadora. Si ya lo creaste para "node scripts/consultas.mjs", esto usa ese mismo.`);
}

/** Lee un .env simple (CLAVE=valor por línea). Sin dependencias. */
function leerEnv(ruta) {
  let crudo;
  try { crudo = readFileSync(ruta, "utf8"); }
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

/** Los números de migración que existen como archivo. Misma regla que el guardián. */
function enDisco() {
  const nums = new Set();
  for (const nombre of readdirSync(CARPETA)) {
    const m = /^migracion-(\d+)-.*\.sql$/.exec(nombre);
    if (m) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
}

async function main() {
  const env = leerEnv(join(RAIZ, ".env.consultas.local"));
  if (!env.SUPABASE_EMAIL || !env.SUPABASE_PASSWORD) {
    throw errorDeConfig("El archivo existe pero le falta SUPABASE_EMAIL o SUPABASE_PASSWORD.");
  }

  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: env.SUPABASE_EMAIL, password: env.SUPABASE_PASSWORD }),
  });
  if (!login.ok) {
    // El cuerpo del error de auth trae el motivo real (clave mal, usuario inexistente, rate
    // limit). Mostrarlo evita el "no anda" sin más.
    throw new Error(`No pude entrar (${login.status}). ${(await login.text()).slice(0, 200)}`);
  }
  const { access_token } = await login.json();

  const r = await fetch(`${SUPABASE_URL}/rest/v1/schema_migrations?select=id,nombre,applied_at&order=id`, {
    headers: { apikey: ANON_KEY, authorization: `Bearer ${access_token}` },
  });
  if (!r.ok) throw new Error(`No pude leer schema_migrations (${r.status}). ${(await r.text()).slice(0, 200)}`);

  const filas = await r.json();
  const aplicadas = new Set(filas.map((f) => f.id));
  const archivos = enDisco();
  const faltan = archivos.filter((n) => !aplicadas.has(n));
  // Al revés también importa: una migración anotada sin archivo significa que alguien corrió
  // algo que no está en el repositorio, y eso hay que saberlo.
  const sinArchivo = [...aplicadas].filter((n) => !archivos.includes(n) && n >= 13).sort((a, b) => a - b);

  console.log(`\nMigraciones en el repo:  ${archivos.length}  (${archivos[0]} a ${archivos[archivos.length - 1]})`);
  console.log(`Anotadas en la base:     ${aplicadas.size}\n`);

  if (faltan.length === 0) {
    console.log("TODAS CORRIDAS. No hay nada pendiente del lado de la base.");
  } else {
    console.log(`FALTAN ${faltan.length}, en este orden:\n`);
    for (const n of faltan) {
      const archivo = readdirSync(CARPETA).find((f) => f.startsWith(`migracion-${n}-`));
      console.log(`   db/migraciones/${archivo}`);
    }
  }

  if (sinArchivo.length) {
    console.log(`\nOJO: la base tiene anotadas migraciones que no están en el repo: ${sinArchivo.join(", ")}`);
    console.log("Alguien corrió algo que no quedó versionado.");
  }

  const ultima = filas[filas.length - 1];
  if (ultima) console.log(`\nÚltima corrida: ${ultima.id} (${ultima.nombre}) el ${String(ultima.applied_at).slice(0, 16).replace("T", " ")}`);
  console.log("");

  // Código de salida útil para encadenar: 0 = al día, 1 = falta algo.
  process.exitCode = faltan.length === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(`\n${e.message}\n`);
  process.exitCode = 2;
});
