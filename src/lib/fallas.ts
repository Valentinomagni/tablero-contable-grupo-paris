// Clasificación de fallas: convierte un error crudo en algo que se le pueda MOSTRAR a una
// persona, junto con la acción que de verdad la desatasca.
//
// POR QUÉ EXISTE. La app se parte en módulos que se bajan a demanda y hay un service worker
// cacheando el shell. Cuando se publica una versión nueva, el navegador que tiene el shell
// viejo pide un módulo cuyo hash ya no existe y falla. El ErrorBoundary mostraba
// "Reintentar" para eso, y reintentar NO PUEDE funcionar nunca: el archivo no está. La
// persona aprieta tres veces, ve el mismo error y concluye que el sistema está roto, cuando
// sólo hacía falta recargar. Ofrecer la acción equivocada como principal es peor que no
// ofrecer ninguna.
//
// PURA: `online` entra por parámetro; no lee `navigator` adentro.

export type TipoDeFalla = "version-vieja" | "sin-conexion" | "sin-permiso" | "falta-migracion" | "desconocida";
export type AccionSugerida = "actualizar" | "reintentar" | "ninguna";

export interface Falla {
  tipo: TipoDeFalla;
  titulo: string;
  /** En lenguaje de usuario. Sin la palabra "módulo", "chunk" ni "hash". */
  explicacion: string;
  accion: AccionSugerida;
}

/** Tope del detalle técnico: tiene que poder pegarse en una consulta, no ser un volcado. */
const MAX_DETALLE = 1000;

function mensajeDe(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error_description === "string") return o.error_description;
  }
  return "";
}

function codigoDe(e: unknown): string {
  if (e && typeof e === "object") {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
    if (typeof c === "number") return String(c);
  }
  return "";
}

function nombreDe(e: unknown): string {
  if (e && typeof e === "object") {
    const n = (e as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

/** ¿Es el fallo de un módulo que se baja a demanda? Cada motor lo redacta distinto. */
function esFalloDeModulo(msg: string, nombre: string): boolean {
  if (nombre === "ChunkLoadError") return true;
  return /failed to fetch dynamically imported module/i.test(msg)
    || /importing a module script failed/i.test(msg)   // Safari
    || /error loading dynamically imported module/i.test(msg)
    || /loading chunk \S+ failed/i.test(msg);
}

/** ¿Huele a red caída? */
function esFalloDeRed(msg: string): boolean {
  return /failed to fetch/i.test(msg)
    || /load failed/i.test(msg)                        // Safari
    || /networkerror/i.test(msg)
    || /network request failed/i.test(msg);
}

/**
 * Clasifica la falla. El ORDEN de las ramas es lo importante de esta función:
 * sin conexión, un módulo también falla al bajar, y ahí actualizar es lo PEOR que se puede
 * hacer — una recarga sin red deja la pantalla en blanco. Por eso lo offline se resuelve
 * antes que la versión vieja.
 */
export function clasificarFalla(e: unknown, online: boolean): Falla {
  const msg = mensajeDe(e);
  const codigo = codigoDe(e);
  const nombre = nombreDe(e);
  const deCarga = esFalloDeModulo(msg, nombre) || esFalloDeRed(msg);

  if (deCarga && !online) {
    return {
      tipo: "sin-conexion",
      titulo: "Sin conexión",
      explicacion: "No hay internet en este momento. Tus cambios guardados están a salvo; en cuanto vuelva la conexión podés seguir.",
      accion: "reintentar",
    };
  }

  if (esFalloDeModulo(msg, nombre)) {
    return {
      tipo: "version-vieja",
      titulo: "Hay una versión nueva",
      explicacion: "Se publicó una actualización mientras tenías la app abierta. Actualizá para cargar la última versión; no vas a perder nada.",
      accion: "actualizar",
    };
  }

  if (esFalloDeRed(msg)) {
    return {
      tipo: "sin-conexion",
      titulo: "No se pudo conectar",
      explicacion: "No se pudo llegar al servidor. Revisá tu conexión y probá de nuevo.",
      accion: "reintentar",
    };
  }

  if (codigo === "42501" || /row-level security|permission denied/i.test(msg)) {
    return {
      tipo: "sin-permiso",
      titulo: "No tenés permiso para esto",
      explicacion: "Tu cuenta no puede hacer esta acción. Si creés que debería poder, avisá por Consultas desde tu perfil.",
      accion: "ninguna",
    };
  }

  if (codigo === "42P01" || codigo === "42703" || codigo === "PGRST204"
      || /does not exist/i.test(msg)) {
    return {
      tipo: "falta-migracion",
      titulo: "Falta una actualización de la base",
      explicacion: "Esta parte necesita una actualización de la base de datos que todavía no se aplicó. El resto de la app funciona normal.",
      accion: "ninguna",
    };
  }

  return {
    tipo: "desconocida",
    titulo: "Algo se rompió en esta pantalla",
    explicacion: "El resto del equipo puede seguir trabajando sin problema. Probá de nuevo, y si sigue pasando copiá el detalle y mandalo por Consultas.",
    accion: "reintentar",
  };
}

/** Texto corto y copiable para pegar en una consulta. Nunca vacío. */
export function detalleTecnico(e: unknown): string {
  const partes: string[] = [];
  const nombre = nombreDe(e);
  const codigo = codigoDe(e);
  if (nombre) partes.push(nombre);
  if (codigo) partes.push(`[${codigo}]`);
  partes.push(mensajeDe(e) || "sin mensaje");
  return partes.join(" ").slice(0, MAX_DETALLE);
}
