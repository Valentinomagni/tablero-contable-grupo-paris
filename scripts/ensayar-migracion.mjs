#!/usr/bin/env node
// Ensayar una migración contra la base REAL, dentro de una transacción que se revierte.
//
// ============================================================================
//  POR QUÉ EXISTE
// ============================================================================
//
// Durante dos meses las migraciones fueron del editor de texto a la base de producción sin nada
// en el medio. Así entraron:
//
//   - la 53, que abortaba el reinicio mensual ENTERO al chocar con la 51 (el trigger frenaba el
//     volcado, y una excepción en plpgsql aborta la transacción completa);
//   - la 40, que justificó su alcance con un comportamiento del front que no existía;
//   - y la del hallazgo 1 del 05/08, donde volver a apretar "Reiniciar mes" DESTRUÍA el archivo
//     del mes y dejaba 0% de cumplimiento para siempre, sin forma de recuperarlo.
//
// Las tres se encontraron leyendo. Ninguna se encontró probando, porque no había dónde probar.
//
// ============================================================================
//  POR QUÉ UNA TRANSACCIÓN Y NO UN SEGUNDO PROYECTO
// ============================================================================
//
// El plan gratuito de Supabase permite dos proyectos y el otro lo ocupa GESTORIA.
//
// Pero Postgres aplica los cambios de esquema TRANSACCIONALMENTE: crear una tabla, redefinir una
// función y correr las comprobaciones puede terminar en `rollback` sin dejar nada.
//
// Y resulta mejor que un proyecto aparte: se prueba contra el esquema real y los DATOS reales.
// Un banco de pruebas vacío no tiene las 157 tareas de agosto ni las policies con filas adentro,
// que es justo donde aparecen los problemas.
//
// ============================================================================
//  LO QUE ESTE ENSAYO NO PRUEBA, escrito para que nadie lo descubra tarde
// ============================================================================
//
//   - Nada que dependa del paso del tiempo: los crons, la acumulación entre meses.
//   - `CREATE INDEX CONCURRENTLY`, que Postgres prohíbe dentro de una transacción. Se detecta
//     abajo y el ensayo se niega, en vez de fallar con un error crudo que parecería culpa de la
//     migración.
//   - Toma bloqueos mientras corre. Conviene ensayar cuando no hay nadie trabajando.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Saca los comentarios de un SQL: `--` hasta fin de línea, y `/* … *\/` aunque abarque varias.
 *
 * POR QUÉ HACE FALTA. Varias migraciones de este proyecto EXPLICAN en comentarios por qué no
 * usan `concurrently`. Un detector que mirara el texto crudo se negaría a ensayar migraciones
 * perfectamente ensayables — y un guardián que da falsos positivos se termina desactivando,
 * que es peor que no tenerlo.
 */
export function sinComentarios(sql) {
  if (typeof sql !== "string") return "";
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/**
 * ¿Se puede ensayar esta migración dentro de una transacción?
 *
 * Devuelve `{ ok: true }`, o `{ ok: false, motivo }` con el motivo en castellano — porque ese
 * texto lo lee una persona, no un registro.
 */
export function esEnsayable(sql) {
  const limpio = sinComentarios(sql);

  // Un archivo sin nada ejecutable no es "ensayable con éxito": es que no hay nada que probar, y
  // decir que sí sería un visto bueno sobre el vacío.
  if (limpio.trim().length === 0) {
    return { ok: false, motivo: "El archivo no tiene ninguna instrucción: no hay nada que ensayar." };
  }

  // `\s+` y no un espacio: el SQL de este proyecto parte instrucciones en varias líneas.
  // SON DOS FAMILIAS DE INSTRUCCIONES CON LA MISMA RESTRICCIÓN, y la segunda apareció corriendo
  // este detector contra las 46 migraciones reales. Dio 46 ensayables y 0 rechazos, cuando un
  // `grep` anterior había marcado la 30 — el grep tenía razón sobre el texto y estaba equivocado
  // sobre el hecho, porque ahí la palabra está dentro de un comentario.
  //
  // Pero revisando ESE archivo apareció que `refresh materialized view` admite una variante
  // concurrente que tampoco puede ir en una transacción, y el detector no la miraba.
  const usaConcurrently = /\b(create|drop)\s+index\s+concurrently\b/i.test(limpio)
    || /\brefresh\s+materialized\s+view\s+concurrently\b/i.test(limpio);

  if (usaConcurrently) {
    return {
      ok: false,
      motivo:
        "Usa CONCURRENTLY, que Postgres no permite dentro de una transacción. Esta migración no " +
        "se puede ensayar: hay que revisarla a mano y aplicarla con cuidado.",
    };
  }

  return { ok: true };
}

/**
 * El texto que se manda a la base: la migración entre `begin` y `rollback`.
 *
 * EL `rollback` VA SIEMPRE, haya fallado o no. Si la migración falla a la mitad, la transacción
 * queda abortada y el `rollback` igual la cierra. Si alguien lo sacara "porque ya falló", los
 * cambios de una corrida EXITOSA quedarían aplicados sin que nadie lo pidiera — y el ensayo
 * pasaría a ser una aplicación silenciosa.
 */
export function armarEnsayo(sql) {
  return `begin;\n\n${sql}\n\nrollback;\n`;
}

// ── De acá para abajo, sólo cuando se lo corre como programa ──────────────────

/** `true` si este archivo se está ejecutando directamente (y no importado por un test). */
const esPrograma = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());

if (esPrograma) {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error("Falta el archivo. Uso: npm run ensayo <archivo.sql>");
    process.exit(1);
  }

  let sql;
  try {
    sql = readFileSync(archivo, "utf8");
  } catch {
    console.error(`No se pudo leer ${archivo}.`);
    process.exit(1);
  }

  const veredicto = esEnsayable(sql);
  if (!veredicto.ok) {
    console.error(`NO SE PUEDE ENSAYAR: ${veredicto.motivo}`);
    process.exit(1);
  }

  console.log(`Ensayando ${archivo} contra la base, dentro de una transacción que se revierte.`);
  console.log("Si hay gente trabajando, esto puede tomar bloqueos unos segundos.\n");

  // `--linked` usa el proyecto enlazado con `supabase link`. Si no está enlazado, el CLI lo dice
  // y salimos con ese mensaje: NO se busca la vuelta ni se piden credenciales.
  const r = spawnSync(
    "npx",
    ["--yes", "supabase@latest", "db", "execute", "--linked", "--file", "-"],
    { input: armarEnsayo(sql), encoding: "utf8", shell: true },
  );

  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);

  // La última línea es lo único que alguien va a leer con apuro. Tiene que ser inequívoca: un
  // ensayo que no deja claro si tocó la base es peor que no tenerlo.
  if (r.status === 0) {
    console.log("\nREVERTIDO — la migración aplicó limpio y la base quedó como estaba.");
    process.exit(0);
  }
  console.error("\nFALLÓ — la migración no aplica. La base quedó como estaba.");
  process.exit(1);
}
