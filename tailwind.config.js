/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", surface2: "var(--surface2)",
        ink: "var(--ink)", ink2: "var(--ink2)", line: "var(--line)",
        accent: "var(--accent)", "accent-soft": "var(--accent-soft)",
        done: "var(--done)", danger: "var(--danger)", warn: "var(--warn)",
        naranja: "var(--naranja)", s1: "var(--s1)", s2: "var(--s2)",
        chip: "var(--chip)", "warn-soft": "var(--warn-soft)", "danger-soft": "var(--danger-soft)",
        "side-bg": "var(--side-bg)", "side-bg2": "var(--side-bg2)",
        "side-ink": "var(--side-ink)", "side-ink2": "var(--side-ink2)",
        // tokens semánticos shadcn (mapeados a Paris en index.css)
        background: "var(--background)", foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "#fff" },
        border: "var(--border)", input: "var(--input)", ring: "var(--ring)",
      },
      borderRadius: { md: "8px", lg: "12px", xl: "16px" },
      fontFamily: { sans: ['"Inter"', "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: { card: "var(--shadow)", lg: "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
