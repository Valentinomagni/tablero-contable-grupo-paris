import type { ReactNode } from "react";
import { cn } from "../lib/ui";

// Tarjeta estándar del tablero.
//
// POR QUÉ EXISTE (5S, Seiton — un lugar para cada cosa): el mismo par de estilos
// (`bg-surface rounded-2xl p-[18px]` + la sombra) estaba copiado a mano en 23 archivos de
// `src/features/`, y ya con DOS variantes distintas de sombra dando vueltas (`--ring` y
// `--ring-sh`). Eso es exactamente cómo empieza la deriva visual: nadie decide cambiar el
// diseño, simplemente se van separando las copias.
//
// Con esto, cambiar el aspecto de las tarjetas es tocar un archivo en vez de 23.
//
// La migración de los archivos existentes se hace POR TANDAS, verificando a ojo cada una —
// no de una sola vez, porque son 23 pantallas y un error de estilo masivo es difícil de ver
// en un diff.
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("bg-surface border border-line rounded-2xl p-[18px]", className)}
      style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}
    >
      {children}
    </div>
  );
}
