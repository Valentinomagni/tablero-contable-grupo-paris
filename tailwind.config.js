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
      // Escala tipográfica — 7 pasos, con su interlineado y su tracking.
      // POR QUÉ: había 764 usos de tamaño repartidos en 13 valores distintos, 499 de ellos
      // con píxeles a mano. Eso es lo que hace que una app se vea armada de a pedazos.
      // Los tamaños grandes llevan tracking negativo porque Inter, a partir de ~16px, se ve
      // suelta con el tracking por defecto: apretarla es lo que la hace ver editorial.
      // Ojo: estos valores PISAN los de Tailwind (sm pasa de 14 a 13, lg de 18 a 16). Es
      // deliberado, hacia una densidad de dashboard profesional.
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs: ["12px", { lineHeight: "1.45" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.55" }],
        lg: ["16px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        xl: ["19px", { lineHeight: "1.3", letterSpacing: "-0.015em" }],
        "2xl": ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "3xl": ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "4xl": ["32px", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
      },
      transitionTimingFunction: {
        // Una sola curva para toda la app. Salidas rápidas y frenada suave: es lo que se
        // percibe como "responde al toque" en vez de "tiene animaciones".
        salida: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: { rapido: "120ms", medio: "200ms" },
      boxShadow: { card: "var(--shadow)", lg: "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
