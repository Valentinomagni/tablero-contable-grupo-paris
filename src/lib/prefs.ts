// Única puerta a localStorage para preferencias de UI, con claves namespaced (5S/Seiton).
const NS = "tablero:";
export const PREF = {
  theme: NS + "theme",
  density: NS + "density",
  sidebar: NS + "sidebar",
  version: NS + "version-vista",
  tablon: NS + "tablon-visto",
  agrupar: NS + "agrupar",
  agruparModo: NS + "agrupar-modo",
  // namespaced por modo y owner: los colapsados de "categoria" no deben mezclarse
  // con los de "prioridad" (una categoría "Alta" colisionaría con la prioridad "Alta"),
  // ni entre personas (cada owner ve sus propios colapsados).
  carrilesColapsados: (modo: string, ownerId: string) => NS + "carriles-colapsados:" + modo + ":" + ownerId,
  // Orden y agrupación POR COLUMNA (spec 28-correcciones, item 7). Namespaced por owner:
  // cómo ordeno MI tablero no tiene por qué aplicarse al de otra persona que yo mire.
  vistasColumna: (ownerId: string) => NS + "vistas-columna:" + ownerId,
  // Tareas por las que la persona ya dijo "ahora no" (P1, confirmación de estancada).
  // Namespaced por owner: el snooze es una decisión personal sobre MIS tareas, y sólo
  // vive en este navegador — no es un dato que deba viajar ni que nadie más deba ver.
  estancadasPospuestas: (ownerId: string) => NS + "estancadas-pospuestas:" + ownerId,
  // Semana cuyo resumen personal ya se cerró a mano (P4, "Tu semana"). Guarda el lunes de
  // esa semana, así la semana siguiente vuelve a mostrarse sola sin tener que limpiar nada.
  semanaVista: (ownerId: string) => NS + "semana-vista:" + ownerId,
  // Columnas plegadas del tablero (D1). Namespaced por owner: plegar es una decisión sobre
  // cómo miro MI tablero, y el de otra persona se abre entero la primera vez que se mira.
  columnasPlegadas: (ownerId: string) => NS + "columnas-plegadas:" + ownerId,
} as const;

export function getPref(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function setPref(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* storage lleno/privado */ }
}

// Columnas que la persona dejó plegadas en su tablero (D1).
// Tolerante con lo que haya guardado: si el valor está roto o no es una lista de textos, se
// lee como "nada plegado". Una preferencia de vista jamás puede dejar a alguien sin tablero.
export function leerColumnasPlegadas(ownerId: string): string[] {
  try {
    const v: unknown = JSON.parse(getPref(PREF.columnasPlegadas(ownerId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

// Pliega la columna si estaba abierta, y al revés. Devuelve la lista nueva ya guardada.
// El cálculo sale de lo que hay en disco, no del estado que tenga la pantalla: lo que se ve
// y lo que sobrevive a recargar tienen que ser lo mismo. Una columna que se despliega sola
// en cada carga es peor que no tener la función — enseña que no anda y se deja de usar.
export function alternarColumnaPlegada(ownerId: string, columna: string): string[] {
  const previas = leerColumnasPlegadas(ownerId);
  const nuevas = previas.includes(columna) ? previas.filter((x) => x !== columna) : [...previas, columna];
  setPref(PREF.columnasPlegadas(ownerId), JSON.stringify(nuevas));
  return nuevas;
}

// Migra las claves viejas una sola vez (sin pisar valores nuevos existentes).
export function migrarPrefs(): void {
  const mapa: Record<string, string> = {
    "pref-theme": PREF.theme,
    "pref-density": PREF.density,
    "pref-sidebar": PREF.sidebar,
    "version-vista": PREF.version,
    "tablon-visto": PREF.tablon,
  };
  for (const [vieja, nueva] of Object.entries(mapa)) {
    const v = getPref(vieja);
    if (v !== null && getPref(nueva) === null) setPref(nueva, v);
  }
  // migración del toggle "Agrupar" (booleano) al nuevo modo de agrupación:
  // respeta la elección previa del usuario, mapeándola al modo "categoria".
  if (getPref(PREF.agrupar) === "1" && getPref(PREF.agruparModo) === null) {
    setPref(PREF.agruparModo, "categoria");
  }
}
