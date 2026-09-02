#!/usr/bin/env node
// Aplicar las migraciones pendientes, ensayando cada una primero.
//
// ============================================================================
//  QUÉ CAMBIA ESTO
// ============================================================================
//
// Durante dos meses, aplicar una migración fue: yo escribo el archivo, se lo paso al dueño, él lo
// copia al panel de Supabase, corre, y me cuenta qué pasó. Cincuenta y siete veces.
//
// No era una limitación técnica. GESTORIA, del mismo dueño, ya usa el CLI de Supabase y aplica
// sus migraciones con un comando. El tablero usaba una convención propia
// —`db/migraciones/migracion-NN-nombre.sql`— que SÓLO se puede aplicar copiando y pegando.
//
// ============================================================================
//  EL ENSAYO NO SE PUEDE SALTEAR, Y ESO ES DELIBERADO
// ============================================================================
//
// No hay bandera `--sin-ensayo`. Si existiera, se usaría el día que haya apuro — que es
// exactamente el día en que no hay que usarla.
//
// Y si UNA falla el ensayo, no se aplica NINGUNA. Aplicar la mitad de una tanda deja la base en
// un estado que no está descrito en ningún lado, y ése es el peor lugar donde puede quedar.

import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CARPETA = "supabase/migrations";

/** Corre un comando y devuelve `{ status, salida }`, sin tirar excepciones. */
function correr(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: true, ...opciones });
  return { status: r.status ?? 1, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function main() {
  if (!existsSync(CARPETA)) {
    console.error(`No existe ${CARPETA}. ¿Falta correr "npx supabase init"?`);
    process.exit(1);
  }

  const archivos = readdirSync(CARPETA).filter((f) => f.endsWith(".sql")).sort();
  if (archivos.length === 0) {
    console.log("No hay migraciones nuevas para aplicar.");
    console.log(`(Las 46 históricas viven en db/migraciones/ y ya están aplicadas. Ver docs/MIGRACIONES.md)`);
    process.exit(0);
  }

  // PRIMERO SE COMPRUEBA EL ENLACE, y no se asume. Si no está hecho, el CLI pide una contraseña
  // y se queda esperando para siempre en un shell sin persona del otro lado.
  console.log("Comprobando el enlace con el proyecto…\n");
  const lista = correr("npx", ["--yes", "supabase@latest", "migration", "list", "--linked"]);
  if (lista.status !== 0) {
    console.error(lista.salida);
    console.error(
      "\nNo se pudo hablar con el proyecto. Si nunca se enlazó, hay que correr UNA VEZ:\n" +
      "    npx supabase login\n" +
      "    npx supabase link --project-ref yyyrlopgwmuvfbzwxiwp\n\n" +
      "Los corre el dueño: escriben una credencial. No se inventan ni se buscan alternativas.",
    );
    process.exit(1);
  }
  console.log(lista.salida);

  // ── El ensayo de TODAS, antes de aplicar NINGUNA ────────────────────────────
  console.log(`Ensayando ${archivos.length} migración(es) antes de aplicar.\n`);
  const fallaron = [];
  for (const f of archivos) {
    const ruta = join(CARPETA, f);
    process.stdout.write(`  ${f} … `);
    const e = correr("node", ["scripts/ensayar-migracion.mjs", ruta]);
    if (e.status === 0) {
      console.log("ok");
    } else {
      console.log("FALLÓ");
      fallaron.push([f, e.salida.trim()]);
    }
  }

  if (fallaron.length > 0) {
    console.error(`\nNo se aplicó nada. ${fallaron.length} migración(es) no pasaron el ensayo:\n`);
    for (const [f, salida] of fallaron) console.error(`--- ${f} ---\n${salida}\n`);
    process.exit(1);
  }

  // ── Recién acá se toca la base ──────────────────────────────────────────────
  console.log("\nTodas ensayaron limpio. Aplicando.\n");
  const push = correr("npx", ["--yes", "supabase@latest", "db", "push", "--linked"]);
  console.log(push.salida);

  if (push.status !== 0) {
    console.error("La aplicación falló. Mirá la salida de arriba.");
    process.exit(1);
  }

  console.log("\nAplicadas. Estado final:\n");
  console.log(correr("npx", ["--yes", "supabase@latest", "migration", "list", "--linked"]).salida);
  process.exit(0);
}

main();
