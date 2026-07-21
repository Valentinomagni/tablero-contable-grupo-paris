import { useEffect } from "react";
import { supabase } from "../lib/supabase";

const INTERVALO_MS = 2 * 60 * 1000;

// Presencia en línea (spec 28 Fase A, Task 5): marca last_seen del usuario actual al montar
// y cada 2 minutos, solo mientras la pestaña está visible. No escribe en segundo plano.
// La base puede no tener la migración 29 todavía: el error se ignora, no rompe la app.
export function usePresencia(meId: string | undefined) {
  useEffect(() => {
    if (!meId) return;

    async function marcar() {
      if (document.visibilityState !== "visible") return;
      try {
        await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", meId);
      } catch {
        // sin migración 29 aplicada, la columna no existe todavía: se ignora.
      }
    }

    marcar();
    const id = setInterval(marcar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [meId]);
}
