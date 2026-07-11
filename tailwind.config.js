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
        "side-bg": "var(--side-bg)", "side-bg2": "var(--side-bg2)",
        "side-ink": "var(--side-ink)", "side-ink2": "var(--side-ink2)",
      },
      borderRadius: { md: "8px", lg: "12px", xl: "16px" },
      fontFamily: { sans: ['"Inter"', "Segoe UI", "system-ui", "sans-serif"] },
      boxShadow: { card: "var(--shadow)", lg: "var(--shadow-lg)" },
    },
  },
  plugins: [],
};
