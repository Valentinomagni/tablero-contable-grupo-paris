import type { Card, Profile, Status } from "./types";
import { agruparCards, type ModoAgrupar } from "./agrupar";

// Vista POR COLUMNA (spec 28-correcciones, item 7).
//
// QUÉ CORRIGE: los "carriles" de la Fase A agrupaban el tablero ENTERO — un solo modo
// para las tres columnas a la vez. Lo pedido era otra cosa: que CADA columna
// (Pendiente / En proceso / Terminado) tenga su propio menú de orden y de agrupación,
// independientes entre sí. Podés tener Pendiente agrupada por categoría y ordenada por
// vencimiento, y Terminado sin agrupar y ordenado por fecha de finalización.
//
// Todo acá es PURO y es preferencia de VISTA: nunca modifica el status ni ningún dato
// de la card. Los carriles globales siguen existiendo aparte (agrupar.ts) para quien los
// prefiera; esto es la vista por defecto, columna por columna.

/** Criterios de orden ofrecidos en el menú de cada columna. */
export type OrdenColumna =
  | "manual"        // como viene (orden de creación) — el de siempre
  | "vencimiento"   // más próximo a vencer primero; sin fecha al final
  | "prioridad"     // alta → media → baja
  | "titulo"        // alfabético (español)
  | "esfuerzo";     // más pesada primero

export const ORDENES_COLUMNA: readonly OrdenColumna[] = [
  "manual", "vencimiento", "prioridad", "titulo", "esfuerzo",
] as const;

export const ETIQUETA_ORDEN: Record<OrdenColumna, string> = {
  manual: "Sin ordenar",
  vencimiento: "Por vencimiento",
  prioridad: "Por prioridad",
  titulo: "Por título",
  esfuerzo: "Por esfuerzo",
};

export const ETIQUETA_AGRUPAR: Record<ModoAgrupar, string> = {
  ninguno: "Sin agrupar",
  categoria: "Por categoría",
  prioridad: "Por prioridad",
  marca: "Por marca",
};

/** Preferencia de vista de UNA columna. */
export interface VistaColumna { orden: OrdenColumna; agrupar: ModoAgrupar; }

/** Vista por defecto: exactamente el comportamiento de siempre (sin orden ni grupos). */
export const VISTA_DEFECTO: VistaColumna = { orden: "manual", agrupar: "ninguno" };

/** Preferencias de las tres columnas. */
export type VistasPorColumna = Record<Status, VistaColumna>;

export const VISTAS_DEFECTO: VistasPorColumna = {
  pend: { ...VISTA_DEFECTO },
  proc: { ...VISTA_DEFECTO },
  term: { ...VISTA_DEFECTO },
};

const PESO_PRIORIDAD: Record<Card["priority"], number> = { alta: 0, media: 1, baja: 2 };

/**
 * Ordena una columna. NO muta el array recibido. `manual` devuelve el mismo orden de
 * entrada (identidad), que es el comportamiento histórico del tablero.
 *
 * Empates: se desempata SIEMPRE por título, para que el orden sea estable y no baile
 * entre renders cuando dos cards tienen la misma fecha/prioridad/esfuerzo.
 */
export function ordenarColumna(cards: Card[], orden: OrdenColumna): Card[] {
  if (!Array.isArray(cards)) return [];
  if (orden === "manual") return cards;
  const porTitulo = (a: Card, b: Card) => (a.title ?? "").localeCompare(b.title ?? "", "es");
  const copia = [...cards];

  if (orden === "titulo") return copia.sort(porTitulo);

  if (orden === "prioridad") {
    return copia.sort((a, b) =>
      (PESO_PRIORIDAD[a.priority] ?? 9) - (PESO_PRIORIDAD[b.priority] ?? 9) || porTitulo(a, b));
  }

  if (orden === "esfuerzo") {
    return copia.sort((a, b) => (b.effort ?? 0) - (a.effort ?? 0) || porTitulo(a, b));
  }

  // vencimiento: las que tienen fecha primero (más próxima arriba); sin fecha al final.
  return copia.sort((a, b) => {
    const fa = a.due_date, fb = b.due_date;
    if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : porTitulo(a, b);
    if (fa) return -1;
    if (fb) return 1;
    return porTitulo(a, b);
  });
}

/**
 * Contenido final de una columna: primero agrupa (si corresponde) y DENTRO de cada grupo
 * ordena. Con `agrupar: "ninguno"` devuelve un único bloque con `grupo: ""` — que la UI
 * dibuja sin cabecera, o sea idéntico al tablero de siempre.
 *
 * El orden se aplica DENTRO del grupo, no sobre el total: si agrupás por categoría y
 * ordenás por vencimiento, cada categoría queda ordenada por vencimiento (que es lo que
 * uno espera), en vez de romperse el agrupamiento.
 */
export function vistaDeColumna(
  cards: Card[],
  vista: VistaColumna,
  ctx: { profiles: Profile[] },
): { grupo: string; cards: Card[] }[] {
  const v = vista ?? VISTA_DEFECTO;
  return agruparCards(cards ?? [], v.agrupar ?? "ninguno", { profiles: ctx?.profiles ?? [] })
    .map((g) => ({ grupo: g.grupo, cards: ordenarColumna(g.cards, v.orden ?? "manual") }));
}

/** ¿Esta columna tiene alguna preferencia activa? (para marcar el botón del menú). */
export function vistaActiva(vista: VistaColumna): boolean {
  const v = vista ?? VISTA_DEFECTO;
  return (v.orden ?? "manual") !== "manual" || (v.agrupar ?? "ninguno") !== "ninguno";
}

/**
 * Lee las vistas guardadas en localStorage. Defensiva a más no poder: cualquier basura
 * (JSON inválido, claves de más, valores que ya no existen) cae a la vista por defecto,
 * porque una preferencia corrupta NUNCA debe dejar sin tablero a nadie.
 */
export function parseVistas(raw: string | null): VistasPorColumna {
  const out: VistasPorColumna = {
    pend: { ...VISTA_DEFECTO }, proc: { ...VISTA_DEFECTO }, term: { ...VISTA_DEFECTO },
  };
  if (!raw) return out;
  let dato: unknown;
  try { dato = JSON.parse(raw); } catch { return out; }
  if (!dato || typeof dato !== "object") return out;
  const agrupables: ModoAgrupar[] = ["ninguno", "categoria", "prioridad", "marca"];
  for (const k of ["pend", "proc", "term"] as Status[]) {
    const v = (dato as Record<string, unknown>)[k];
    if (!v || typeof v !== "object") continue;
    const { orden, agrupar } = v as { orden?: unknown; agrupar?: unknown };
    if (typeof orden === "string" && (ORDENES_COLUMNA as readonly string[]).includes(orden)) {
      out[k].orden = orden as OrdenColumna;
    }
    if (typeof agrupar === "string" && (agrupables as string[]).includes(agrupar)) {
      out[k].agrupar = agrupar as ModoAgrupar;
    }
  }
  return out;
}
