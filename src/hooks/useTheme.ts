import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const THEMES: Theme[] = ["auto", "light", "dark"];
export const THEME_LBL: Record<Theme, string> = { auto: "Auto", light: "Claro", dark: "Oscuro" };

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("pref-theme") as Theme) ?? "auto");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("pref-theme", theme);
  }, [theme]);
  const cycle = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  return { theme, cycle };
}
