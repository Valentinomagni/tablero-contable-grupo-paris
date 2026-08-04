import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { esTablaInexistente } from "./usePeriodos";
import type { Reinicio } from "../lib/reinicio-mensual";

// Registro de reinicios mensuales (migración 37, tabla `reinicios_mensuales`).
//
// DEFENSIVO en un solo punto, y sólo en ese: si la tabla NO EXISTE todavía (la 37 no está
// aplicada) devuelve [] en vez de romper. La app tiene que seguir funcionando igual en un
// entorno donde la migración no corrió — que es justamente el estado desde el que se instala.
//
// Cualquier OTRO error (red, permiso) sí queda en error: tragárselo sería repetir el pecado
// original de esta feature, que es fallar en silencio.
//
// Ojo con la asimetría respecto de `usePeriodos`: allá el error de tabla inexistente llega
// hasta la UI, que discrimina el mensaje. Acá no hay mensaje que discriminar — el aviso es
// pasivo y no tiene pantalla propia—, así que la ausencia de tabla se resuelve acá mismo.
// Se reusa `esTablaInexistente` a propósito: el patrón ya existe, no se inventa otro.
export function useReinicios() {
  return useQuery({
    queryKey: ["reinicios"],
    queryFn: async (): Promise<Reinicio[]> => {
      const { data, error } = await supabase.from("reinicios_mensuales")
        .select("*").order("mes", { ascending: false });
      if (error) {
        if (esTablaInexistente(error)) return [];
        throw error;
      }
      return (data as Reinicio[]) ?? [];
    },
  });
}
