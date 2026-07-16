import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { popUndo } from "./undo";

// Deshacer desacoplado del shell (Kaizen H7 — Seiri): el listener de Ctrl+Z en
// App solo llama a esta función y muestra el mensaje que devuelve.

// Decisión del mensaje, pura y testeable por separado.
export function mensajeDeshacer(hubo: boolean, error: string | null): string {
  if (!hubo) return "Nada para deshacer.";
  return error ? "No se pudo deshacer: " + error : "Deshecho";
}

// Saca el último cambio de la pila, restaura los campos previos en Supabase e
// invalida la query de cards. Devuelve el mensaje para el toast.
export async function deshacerUltimo(qc: QueryClient): Promise<string> {
  const u = popUndo();
  if (!u) return mensajeDeshacer(false, null);
  const { error } = await supabase.from("cards").update(u.prev).eq("id", u.id);
  qc.invalidateQueries({ queryKey: ["cards"] });
  return mensajeDeshacer(true, error?.message ?? null);
}
