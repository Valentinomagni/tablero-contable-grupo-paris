import { Hourglass } from "lucide-react";
import type { Card } from "../../lib/types";
import { Panel } from "../../components/Panel";
import { esperasPorArea } from "../../lib/bloqueo-area";
import { useDiasNoLaborables } from "../../hooks/useData";

// Qué está esperando a otra área, para el resumen del jefe.
//
// EL PROBLEMA QUE RESUELVE, y es el motivo de toda la Fase C: hoy, cuando el trabajo se traba
// porque falta algo de Ventas o de Recursos Humanos, esa demora aparece como demora del equipo
// contable. El jefe ve tareas quietas y no tiene ninguna forma de saber que la pelota está
// afuera. Este panel separa las dos cosas.
//
// LO QUE HABILITA, que es lo que de verdad importa: ir a hablar con la otra área con un dato en
// la mano —"hay cuatro cosas frenadas ahí, la más vieja hace once días"— en vez de con una
// impresión. Una impresión se discute; un número con fecha, no.
//
// ENCUADRE: agrupa por ÁREA, nunca por persona. Describe dónde está trabado el proceso, no quién
// tiene tareas trabadas — eso último sería un ranking encubierto, y el equipo lo leería así.

export function EsperasExternas({ cards, hoyISO, onOpenCard }: {
  cards: Card[];
  /** Hoy en formato ISO. Entra por parámetro para que el cálculo sea testeable. */
  hoyISO: string;
  onOpenCard: (c: Card) => void;
}) {
  const noLaborables = useDiasNoLaborables();
  const esperas = esperasPorArea(cards, hoyISO, noLaborables);

  // SILENCIO CUANDO NO HAY NADA. Un panel que dice "no hay esperas" ocupa el mismo lugar que uno
  // con información y entrena a saltearlo. Si nada está trabado, esto no existe.
  if (esperas.length === 0) return null;

  const total = esperas.reduce((s, e) => s + e.cantidad, 0);

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-3">
        <Hourglass size={16} className="text-ink2 shrink-0" />
        <h3 className="text-sm font-semibold m-0">Esperando a otras áreas</h3>
        <span className="ml-auto bg-chip rounded-full px-2 py-0.5 text-xs tnum text-ink2">{total}</span>
      </div>

      <div className="grid gap-2">
        {esperas.map((e) => {
          // Las tareas de esta área, para poder abrirlas desde acá. Sin esto el panel informa y
          // no deja hacer nada, que es la mitad de un panel.
          const suyas = cards.filter(
            (c) => c.status !== "term" && c.bloqueo_area === e.area && !!c.bloqueo_desde,
          );
          return (
            <div key={e.area} className="border border-line rounded-lg p-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <b className="text-sm">{e.area}</b>
                <span className="text-ink2 text-xs">
                  {e.cantidad === 1 ? "1 tarea" : `${e.cantidad} tareas`}
                  {/* La más vieja va SIEMPRE, aunque sea de hoy: es el número que decide si vale
                      la pena levantar el teléfono. */}
                  {e.masVieja > 0 && ` · la más vieja hace ${e.masVieja === 1 ? "1 día" : `${e.masVieja} días`}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {suyas.map((c) => (
                  <button key={c.id} onClick={() => onOpenCard(c)}
                    className="text-xs text-ink2 hover:text-accent underline underline-offset-2 transition text-left">
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Por qué está acá y no en la lista de tareas trabadas: son demoras que NO son del equipo.
          Mezclarlas con las propias es lo que hacía que se contaran como lentitud contable. */}
      <p className="text-ink2 text-2xs mt-2.5 m-0">
        Los días son hábiles: no cuentan fines de semana ni feriados.
      </p>
    </Panel>
  );
}
