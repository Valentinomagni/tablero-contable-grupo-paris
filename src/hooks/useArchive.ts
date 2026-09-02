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

/**
 * Estado de la lectura del archivo de UN mes. Los cuatro casos son distintos y tienen que poder
 * distinguirse: ahí está todo el arreglo.
 */
export type EstadoArchivoMes = "cargando" | "hay" | "sin-archivo" | "error";

/**
 * El archivo de UNA persona en UN mes, distinguiendo un error de un mes sin archivar.
 *
 * ============================================================================
 *  POR QUÉ UN HOOK NUEVO Y NO REUSAR `useArchive`
 * ============================================================================
 *
 * `useArchive` y `useArchiveEquipo` —los dos de arriba— **devuelven `[]` ante cualquier error**.
 * Es defensivo y para Historial está bien: un empty state de más no rompe nada.
 *
 * Pero apoyar en eso la lectura de los meses pasados del tablero reconstruiría EXACTAMENTE el bug
 * del 02/09, sólo que con otra fuente. Ese día el equipo abrió agosto, vio 51 pendientes y 0
 * terminadas, y tres personas concluyeron que se había perdido el mes. No se había perdido: la
 * pantalla dibujó una falla como si fuera un dato, y el dato se veía prolijo y creíble.
 *
 * **"No sé" tiene que verse distinto de "no había nada".** Una lista vacía no permite
 * distinguirlo, así que este hook devuelve el estado y no sólo las filas.
 *
 * Y filtra por mes EN EL SERVIDOR: `useArchive` trae todos los meses de la persona, que crece sin
 * techo. Para dibujar un mes alcanza con ese mes.
 */
export function useArchiveMes(ownerId: string, mes: string) {
  const q = useQuery({
    queryKey: ["archive", ownerId, mes],
    enabled: !!ownerId && /^\d{4}-\d{2}$/.test(mes ?? ""),
    queryFn: async (): Promise<CardArchive[]> => {
      const { data, error } = await supabase.from("cards_archive")
        .select("*").eq("owner", ownerId).eq("mes", mes);
      // SE LANZA, no se devuelve []. Que react-query sepa que falló es lo único que permite
      // decirle a la persona "no se pudo cargar" en vez de "no había nada".
      if (error) throw error;
      return (data as CardArchive[]) ?? [];
    },
  });

  const filas = q.data ?? [];
  const estado: EstadoArchivoMes = q.isError ? "error"
    : q.isPending ? "cargando"
    : filas.length > 0 ? "hay"
    : "sin-archivo";

  return { filas, estado, reintentar: q.refetch };
}
