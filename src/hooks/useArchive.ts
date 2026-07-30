import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { CardArchive } from "../lib/types";

// Archivo mensual de una persona (cards_archive). DEFENSIVA: si la migración 22
// no está aplicada (tabla inexistente) o hay cualquier error, devuelve [] y la
// vista Historial muestra su empty state sin romper la app. RLS ya limita quién ve qué.
export function useArchive(ownerId: string) {
  return useQuery({
    queryKey: ["archive", ownerId],
    queryFn: async (): Promise<CardArchive[]> => {
      const { data, error } = await supabase.from("cards_archive")
        .select("*").eq("owner", ownerId).order("mes", { ascending: false });
      if (error) return [];
      return (data as CardArchive[]) ?? [];
    },
    enabled: !!ownerId,
  });
}

// TODOS los archives del equipo (sin filtro de owner) — para el análisis histórico del jefe.
// RLS deja al jefe ver todo; el resto sólo ve lo suyo. DEFENSIVA: ante cualquier error (tabla
// inexistente / migración sin aplicar) devuelve [] y el análisis muestra "Sin historial todavía".
export function useArchiveEquipo(enabled = true) {
  return useQuery({
    queryKey: ["archive", "equipo"],
    enabled,
    queryFn: async (): Promise<CardArchive[]> => {
      // `count: "exact"` + `limit` explícito. Sin esto, Supabase cortaba en 1000 filas sin
      // avisar: una fila por card por mes son 7500 con 25 personas y un año, así que el
      // Comparador decía "sin historial" para meses que sí existen en la base. El límite
      // declarado no arregla el techo, pero el aviso hace que se pueda ver en vez de
      // adivinarlo — que es la diferencia entre un dato incompleto y un dato que miente.
      const { data, error, count } = await supabase.from("cards_archive")
        .select("*", { count: "exact" })
        .order("mes", { ascending: false })
        .limit(5000);
      if (error) return [];
      const filas = (data as CardArchive[]) ?? [];
      if (typeof count === "number" && count > filas.length) {
        console.warn(`[archive] el histórico tiene ${count} filas y se trajeron ${filas.length}: los meses más viejos no entran en las comparaciones.`);
      }
      return filas;
    },
  });
}
