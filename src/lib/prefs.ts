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
} as const;

export function getPref(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function setPref(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* storage lleno/privado */ }
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
