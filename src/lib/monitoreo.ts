import { clasificarFalla } from "./fallas";

// Monitoreo de errores: enterarse de que algo se rompió sin depender de que alguien lo cuente.
//
// POR QUÉ. `ErrorBoundary.tsx` tenía un "TODO: cuando se enchufe Sentry" desde hace meses.
// Sin esto, el tiempo entre que una pantalla se rompe para alguien y que nos enteramos se
// mide en días — y sólo si esa persona se toma el trabajo de avisar.
//
// LO QUE NO SE MANDA, Y ES LA DECISIÓN IMPORTANTE DE ESTE ARCHIVO.
// El equipo escribe cosas privadas en las tareas: montos, nombres de clientes, notas
// internas, consultas que se hicieron contando con que sólo las ve administración. Nada de
// eso puede salir hacia un servidor de terceros. Se manda LA FORMA del error —código,
// mensaje técnico, pantalla— y nunca el contenido.
//
// Un sistema de monitoreo que filtra datos de la gente es peor que no tener monitoreo.

/** Claves cuyo valor es texto escrito por una persona. Se recortan siempre. */
const CLAVES_LIBRES = ["texto", "titulo", "title", "descripcion", "description", "detalle", "obs", "nota", "respuesta", "comentario", "name", "nombre", "email"];

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
// Dos formas de token, no una. Un token suelto se reconoce por lo largo (20 o más), porque
// más corto que eso se confunde con un nombre de función o un código de error y recortaríamos
// justo lo que sirve para diagnosticar. Pero cuando viene precedido de "Bearer" ya no hace
// falta adivinar: ahí lo que sigue es una credencial aunque sea corta, y se recorta igual.
const RE_TOKEN = /\b(?:bearer\s+[A-Za-z0-9_-]+|[A-Za-z0-9_-]{20,})\b/gi;
const RE_MONTO = /\$\s?[\d.,]+/g;

function limpiarTexto(s: string): string {
  return s.replace(RE_EMAIL, "[email]").replace(RE_TOKEN, "[token]").replace(RE_MONTO, "[monto]");
}

/** Deja sólo lo que sirve para diagnosticar. Nunca falla. */
export function anonimizar(datos: unknown): Record<string, unknown> {
  if (!datos || typeof datos !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    if (CLAVES_LIBRES.includes(k.toLowerCase())) { out[k] = "[recortado]"; continue; }
    out[k] = typeof v === "string" ? limpiarTexto(v) : v;
  }
  return out;
}

/**
 * ¿Vale la pena reportar esta falla?
 *
 * Lo que NO se reporta importa tanto como lo que sí. Un panel lleno de "sin conexión" y
 * "versión vieja" —las dos cosas normales y que ya se resuelven solas— esconde el error real
 * que aparece una vez cada tres días. El ruido no es gratis: cuesta la atención que hace
 * falta para ver lo que sí pasa.
 */
export function debeReportar(e: unknown, online: boolean): boolean {
  const falla = clasificarFalla(e, online);
  return falla.tipo === "desconocida" || falla.tipo === "sin-permiso" || falla.tipo === "falta-migracion";
}

// LO QUE FALTA EN ESTE ARCHIVO, Y POR QUÉ NO ESTÁ TODAVÍA.
//
// Faltan las dos funciones que hablan con el servicio de monitoreo: `iniciarMonitoreo()`, que
// lo arranca en producción cuando hay un DSN configurado, y `reportarFalla(e, contexto)`, que
// es la que llamaría `ErrorBoundary.tsx` donde hoy sigue el "TODO: cuando se enchufe Sentry".
//
// No están porque las dos dependen del paquete `@sentry/react`, que en esta máquina todavía
// no se puede instalar: la instalación se hace desde el CI con el workflow "Dependencias", y
// eso ocurre después de publicar. Si se escribieran ahora, el `import("@sentry/react")`
// dejaría de resolver y rompería la compilación de toda la app — cambiar un producto que
// funciona por uno que no compila, para ganar una función que aún no se puede usar.
//
// Lo que sí está es la parte que importa y que no depende de nadie: la decisión de qué se
// manda y qué no. `anonimizar` y `debeReportar` son la política de privacidad y de ruido del
// monitoreo, están probadas, y no cambian cuando se enchufe el servicio: las dos funciones
// que faltan las van a usar tal como están.
//
// Para completarlo: instalar `@sentry/react` con el workflow "Dependencias", agregar acá las
// dos funciones (están escritas en el Step 3 de la Task 4 del plan
// `docs/superpowers/plans/2026-08-04-salto-de-nivel.md`), llamarlas desde `main.tsx` y
// `ErrorBoundary.tsx`, y cargar `VITE_SENTRY_DSN` en Cloudflare Pages. Sin esa variable el
// monitoreo no reporta nada y tampoco rompe.
