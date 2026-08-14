import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import type { Card } from "../../lib/types";
import { teclaActiva } from "../../lib/ui";
import { useCardOccurrences } from "../../hooks/useOccurrences";
import { useDiasNoLaborables } from "../../hooks/useData";
import { habilesDelMes } from "../../lib/dias-habiles";
import { avanceDelMes } from "../../lib/arqueo-mensual";
import { CumplimientoDiario } from "./CumplimientoDiario";

// UNA tarjeta para el arqueo del mes, con los días adentro.
//
// EL REPORTE DE PATRICIA: "hoy se genera una tarea por cada día hábil y la lista es
// interminable". Abría su tablero y veía veinte tarjetas iguales donde necesitaba ver una sola
// cosa: cómo viene el mes.
//
// LA MITAD YA EXISTÍA, Y POR ESO ESTO ES CHICO. Cada día se venía guardando bien en
// `task_occurrences` (una fila por tarea y fecha desde la migración 23, con checklist propio
// desde la 34), y la grilla que los muestra —`CumplimientoDiario`— también estaba escrita, pero
// sólo se veía entrando a la tarea. Lo único que faltaba era mostrarlos JUNTOS en el tablero.
// Acá no se cambia nada de cómo se guardan: esto es una vista.

/** Parte 'YYYY-MM' en números. Si no tiene esa forma, NaN: abajo eso cae en "sin días hábiles". */
function partesMes(mes: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  return { year: m ? Number(m[1]) : NaN, month: m ? Number(m[2]) : NaN };
}

export function ArqueoMensual({ c, mes, cerrado = false, onOpen }: {
  c: Card;
  /** Mes que está mirando el tablero, 'YYYY-MM'. */
  mes: string;
  /** Mes cerrado (Fase 3): se puede consultar, no editar. */
  cerrado?: boolean;
  onOpen: (c: Card) => void;
}) {
  // Los días arrancan plegados a propósito: la tarjeta existe para que el mes se lea de un
  // vistazo. Si la grilla viniera abierta, el tablero volvería a ser una pared de días —que es
  // exactamente el problema que se está resolviendo.
  const [verDias, setVerDias] = useState(false);
  const { year, month } = partesMes(mes);
  const { data: ocurrencias = [] } = useCardOccurrences(c.id, year, month);
  // Los feriados los carga el jefe (migración 48). Sin ellos el denominador contaría días en los
  // que la oficina estaba cerrada, y el avance daría siempre por debajo de lo real.
  const noLaborables = useDiasNoLaborables();
  const habiles = habilesDelMes(mes, noLaborables);
  const { hechos, total, pct } = avanceDelMes(ocurrencias, habiles);

  return (
    // Mismo aspecto que el resto de las tarjetas del tablero (ver `CardItem`): esta es una
    // tarea más, no un panel aparte. La diferencia es lo que muestra, no dónde vive.
    <div className="bg-surface rounded-xl px-3.5 py-3 mb-2.5 border border-line/70 transition
      hover:border-accent/40 hover:shadow-[var(--shadow-lg)]"
      style={{ boxShadow: "var(--shadow)" }}>
      {/* La cabecera es lo "abrible", y va SEPARADA de la grilla: si la grilla estuviera adentro
          de este role="button", tocar un día abriría la tarea sin querer. */}
      <div role="button" tabIndex={0} onClick={() => onOpen(c)} onKeyDown={teclaActiva(() => onOpen(c))}
        className="text-left w-full cursor-pointer">
        <div className="font-semibold text-sm tracking-tight leading-snug">{c.title}</div>
        <div className="flex gap-2 flex-wrap mt-1.5 text-xs text-ink2 items-center">
          <span className="inline-flex items-center gap-1 bg-chip rounded-md px-1.5 py-0.5 whitespace-nowrap">
            {/* EL CHIP DESCRIBE LA FORMA, NO EL CONTENIDO, y no es un detalle de redacción.
                Esta tarjeta la usa cualquier tarea de todos los días —`recur_rule.tipo ===
                "diaria"`—, no sólo el arqueo. Decía "Arqueo del mes", así que una "Carga de
                remitos" diaria aparecía rotulada como un arqueo. Un rótulo que le pone a una
                tarea el nombre de otra es justo lo que hace que se deje de creer el resto de
                la pantalla. El nombre real ya está arriba, en el título. */}
            <CalendarDays size={11} /> Todos los días
          </span>
          {total > 0
            ? <span className="whitespace-nowrap"><b className="text-ink tnum">{hechos} de {total}</b> días hábiles</span>
            : <span className="whitespace-nowrap">sin días hábiles en este mes</span>}
        </div>
      </div>
      {/* La barra describe cómo viene el PROCESO del mes, no a quien lo hace: no cambia de color
          ni "aprueba" un porcentaje. Un mes a mitad de camino el día 10 está perfecto. */}
      {total > 0 && (
        <div className="w-full h-1.5 rounded-full bg-surface2 border border-line overflow-hidden mt-2"
          role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${c.title}: ${hechos} de ${total} días hábiles`}>
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      )}
      <button onClick={() => setVerDias((v) => !v)} aria-expanded={verDias}
        className="mt-2 inline-flex items-center gap-1 text-xs text-ink2 hover:text-accent transition">
        {verDias ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {verDias ? "Ocultar los días" : "Ver los días"}
      </button>
      {verDias && (
        <div className="mt-2">
          {/* La grilla que ya existía, tal cual: misma tabla, mismo camino de escritura, mismo
              diálogo de resultado para las tareas de control. Mostrarla acá no cambia el dato. */}
          <CumplimientoDiario cardId={c.id} owner={c.owner} year={year} month={month}
            requiere={!!c.requiere_resultado} soloLectura={cerrado} />
        </div>
      )}
    </div>
  );
}
