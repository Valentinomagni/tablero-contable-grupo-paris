import { cn } from "../lib/ui";

// Hueco que late mientras se carga algo.
//
// POR QUÉ, y no es cosmético: un "Cargando…" en texto le dice a la persona que espere sin
// darle idea de qué va a aparecer, y la pantalla salta cuando el contenido llega. Un
// esqueleto con la forma de lo que viene reserva el espacio (no hay salto) y hace que la
// espera se sienta más corta de lo que es. Es la señal más barata que existe de software
// terminado.
//
// Accesibilidad: `aria-hidden` porque las barras grises no son contenido, y `aria-busy` en
// el contenedor para que un lector de pantalla anuncie que se está cargando en vez de leer
// el vacío.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true">
      <div aria-hidden="true" className={cn("latir rounded-md bg-surface2", className ?? "h-4 w-full")} />
    </div>
  );
}

/**
 * Esqueleto genérico de una vista completa, para el `Suspense` que espera un módulo.
 * Insinúa la forma que comparten casi todas las pantallas: un título, una fila de
 * indicadores y una tarjeta grande.
 */
export function SkeletonVista() {
  return (
    <div className="px-4 sm:px-6 pt-5 pb-10 max-w-[1100px] w-full mx-auto flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
