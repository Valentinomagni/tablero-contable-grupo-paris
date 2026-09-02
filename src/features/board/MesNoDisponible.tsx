import { Archive, RotateCw } from "lucide-react";

// Lo que se muestra cuando un mes pasado NO se puede mostrar.
//
// ============================================================================
//  POR QUÉ ESTE COMPONENTE EXISTE, y no es un detalle de presentación
// ============================================================================
//
// El 02/09/2026 el equipo abrió el período de agosto y vio 51 tareas pendientes y 0 terminadas.
// Tres personas —incluido el dueño— concluyeron que se había perdido el mes de trabajo.
//
// No se había perdido: agosto estaba entero en el archivo, 157 tareas y 119 terminadas. Lo que
// pasó fue que **una falla se dibujó como un dato**. Cero terminadas es una respuesta prolija,
// completa y creíble, y por eso le creyeron.
//
// Este componente es la regla que cierra ese agujero: **"no sé" tiene que verse distinto de "no
// había nada"**. Nunca muestra tarjetas, porque mostrarlas sería inventar un mes que nadie
// guardó — que es exactamente lo que hacía la pantalla vieja.

export function MesNoDisponible({ titulo, detalle, onReintentar }: {
  titulo: string;
  detalle: string;
  /** Sólo cuando reintentar puede funcionar de verdad: un fallo de consulta, no un mes sin foto. */
  onReintentar?: () => void;
}) {
  return (
    <div className="px-4 sm:px-6 py-14 max-w-[560px] w-full mx-auto text-center">
      <Archive size={28} className="mx-auto mb-3 text-ink2 opacity-60" />
      <h3 className="text-base font-semibold m-0 mb-1.5">{titulo}</h3>
      <p className="text-ink2 text-sm m-0">{detalle}</p>
      {/* El botón aparece SÓLO si reintentar puede servir. Ofrecer "reintentar" cuando el mes
          simplemente no tiene foto es peor que no ofrecer nada: la persona lo aprieta tres veces,
          ve lo mismo, y concluye que el sistema está roto. Mismo criterio que `fallas.ts`. */}
      {onReintentar && (
        <button onClick={onReintentar}
          className="mt-4 inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">
          <RotateCw size={14} /> Reintentar
        </button>
      )}
    </div>
  );
}
