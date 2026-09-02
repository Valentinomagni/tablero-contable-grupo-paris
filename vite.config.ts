/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
// Análisis de bundle opt-in: `ANALYZE=1 npm run build` genera dist/stats.html
export default defineConfig({
  plugins: [react(), ...(process.env.ANALYZE ? [visualizer({ filename: "dist/stats.html", gzipSize: true })] : [])],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Respeta el puerto que asigne el entorno (PORT); si no hay, usa el default de Vite.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  build: {
    rollupOptions: {
      output: {
        // rolldown-vite (Vite 8) solo acepta la forma de función para manualChunks;
        // el objeto { chunkName: [paquetes] } de Rollup clásico no tipa (ManualChunksFunction).
        // Ya no hay regla para `motion`: la librería salió del proyecto y dejar el nombre
        // acá generaría un chunk vacío o volvería a atraerla sin que nadie lo note.
        manualChunks(id: string) {
          if (id.includes("node_modules/@supabase/supabase-js")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack/react-query")) return "vendor-query";
        },
      },
    },
  },
  // Vitest corre los tests unitarios de `src` y los de `scripts`; los E2E (e2e/*.spec.ts) los
  // corre Playwright.
  //
  // POR QUÉ SE SUMÓ `scripts`: los scripts también son código que puede romperse, y uno de ellos
  // —`ensayar-migracion.mjs`— es lo único que separa una migración de la base de producción. Un
  // guardián sin tests es una intención, no una defensa.
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    environment: "jsdom",
  },
});
