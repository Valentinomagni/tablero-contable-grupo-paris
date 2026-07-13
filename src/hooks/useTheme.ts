import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const THEMES: Theme[] = ["auto", "light", "dark"];
export const THEME_LBL: Record<Theme, string> = { auto: "Auto", light: "Claro", dark: "Oscuro" };

type Density = "comoda" | "compact";
export const DENSITY_LBL: Record<Density, string> = { comoda: "Cómoda", compact: "Compacta" };

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("pref-theme") as Theme) ?? "auto");
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem("pref-density") === "compact" ? "compact" : "comoda"));
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("pref-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle("compact", density === "compact");
    localStorage.setItem("pref-density", density);
  }, [density]);
  const cycle = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  const cycleDensity = () => setDensity((d) => (d === "compact" ? "comoda" : "compact"));
  return { theme, cycle, density, cycleDensity };
}
