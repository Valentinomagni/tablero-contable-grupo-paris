// Única puerta a localStorage para preferencias de UI, con claves namespaced (5S/Seiton).
const NS = "tablero:";
export const PREF = {
  theme: NS + "theme",
  density: NS + "density",
  sidebar: NS + "sidebar",
  version: NS + "version-vista",
  tablon: NS + "tablon-visto",
  agrupar: NS + "agrupar",
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
}
