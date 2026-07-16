import { useEffect, useState } from "react";
import { PREF, getPref, setPref } from "../lib/prefs";

type Theme = "auto" | "light" | "dark";
const THEMES: Theme[] = ["auto", "light", "dark"];
export const THEME_LBL: Record<Theme, string> = { auto: "Auto", light: "Claro", dark: "Oscuro" };

type Density = "comoda" | "compact";
export const DENSITY_LBL: Record<Density, string> = { comoda: "Cómoda", compact: "Compacta" };

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (getPref(PREF.theme) as Theme) ?? "auto");
  const [density, setDensity] = useState<Density>(() => (getPref(PREF.density) === "compact" ? "compact" : "comoda"));
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    setPref(PREF.theme, theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle("compact", density === "compact");
    setPref(PREF.density, density);
  }, [density]);
  const cycle = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  const cycleDensity = () => setDensity((d) => (d === "compact" ? "comoda" : "compact"));
  return { theme, cycle, density, cycleDensity };
}
