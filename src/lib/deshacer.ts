import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { popUndo } from "./undo";
import { mensajeUsuario } from "./fallas";

// Deshacer desacoplado del shell (Kaizen H7 — Seiri): el listener de Ctrl+Z en
// App solo llama a esta función y muestra el mensaje que devuelve.

// Decisión del mensaje, pura y testeable por separado.
//
// EL ERROR NO SE MUESTRA CRUDO (hallazgo 6 de la auditoría del 05/08). Antes esto concatenaba
// el mensaje de Postgres tal cual, así que alguien que apretaba Ctrl+Z podía terminar leyendo
// `new row violates row-level security policy for table "cards"`. Eso no le dice qué hacer, y
// encima nombra tablas y policies de la base en la cara de un empleado.
//
// `mensajeUsuario` clasifica la falla y devuelve la acción que de verdad desatasca; si no la
// puede clasificar, ofrece el canal de Consultas. El detalle técnico sigue existiendo, pero va
// al portapapeles desde la pantalla de error, no acá.
export function mensajeDeshacer(hubo: boolean, error: string | null): string {
  if (!hubo) return "Nada para deshacer.";
  return error ? mensajeUsuario(new Error(error), "deshacer el último cambio") : "Deshecho";
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
