import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import App from "./App.tsx";
import { migrarPrefs } from "./lib/prefs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { toast } from "sonner";
import { instalarRedGlobal } from "./lib/red-global";

// Migra las preferencias viejas de localStorage a las claves namespaced (una sola vez).
migrarPrefs();

// Red global para las fallas que no pasan por React (ver lib/red-global.ts). Se instala una
// sola vez, antes de montar: una promesa que se rompe durante el arranque también tiene que
// avisar. No se desinstala nunca porque vive todo lo que vive la pestaña.
instalarRedGlobal((mensaje, accion) => {
  toast.error(mensaje, accion ? { action: { label: accion.texto, onClick: accion.hacer } } : undefined);
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// PWA: solo en producción, network-first (nunca sirve versiones viejas con red)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        {/* Devtools de React Query: solo en dev, tree-shake total en build de prod */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
