import type { Profile } from "../../lib/types";
import { flujoMensual, nivelCarga, TEXTO_PERFIL } from "../../lib/flujo-mensual";
import { useSnapshots } from "../../hooks/useData";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";

// ESCALA DE GRISES a propósito: el mapa de calor comunica INTENSIDAD, no estado. En este
// proyecto el color (verde/ámbar/rojo) está reservado para el semáforo; usarlo acá sugeriría
// que trabajar mucho un día es "malo" y eso sería justamente el encuadre punitivo que se evita.
const TONOS = ["transparent", "var(--chip)", "#a1a1aa", "#71717a", "#3f3f46"] as const;

// Referencia de días: sólo cuatro marcas para no saturar 31 columnas de números.
const MARCAS_DIA = [1, 10, 20, 31];

// Vista del flujo de trabajo dentro del mes (spec "inteligencia de gestión", Task 4).
// ENCUADRE (regla dura): describe CUÁNDO se concentra el trabajo, para repartir la carga.
// No hay ranking ni veredicto por persona; el orden es sólo por volumen total.
export function FlujoMensual({ team, mes }: { team: Profile[]; mes: string }) {
  const snaps = useSnapshots(true).data ?? [];
  const filas = flujoMensual(snaps, mes);

  // El máximo es GLOBAL (el mayor valor diario de TODAS las personas), no por fila: con un
  // máximo por persona, cada barra se normalizaría contra sí misma y dos barras igual de
  // oscuras podrían representar 2 y 40 tareas. Con el máximo global las filas son comparables.
  const max = Math.max(0, ...filas.flatMap((f) => f.dias));

  return (
    <Panel>
      <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-1.5">Flujo de trabajo en el mes</h3>
      <p className="text-ink2 text-sm m-0 mb-3.5">Muestra cuándo se concentra el trabajo de cada persona, para repartir mejor la carga.</p>

      {filas.length === 0 ? (
        <EmptyState title="Todavía no hay actividad diaria registrada en este mes." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Escala de días, una sola vez arriba, alineada a la grilla de 31 celdas. */}
          <div className="flex items-center gap-3">
            <span className="w-[150px] shrink-0" />
            <div className="flex-1 min-w-[180px] grid" style={{ gridTemplateColumns: "repeat(31, 1fr)" }}>
              {Array.from({ length: 31 }, (_, i) => (
                <span key={i} className="text-2xs text-ink2 tnum text-center leading-none">
                  {MARCAS_DIA.includes(i + 1) ? i + 1 : ""}
                </span>
              ))}
            </div>
            <span className="w-[190px] shrink-0" />
          </div>

          {filas.map((f) => (
            <div key={f.owner} className="flex items-center gap-3">
              <span className="w-[150px] shrink-0 truncate text-sm">{team.find((u) => u.id === f.owner)?.name ?? "—"}</span>
              <div className="flex-1 min-w-[180px] grid gap-px" style={{ gridTemplateColumns: "repeat(31, 1fr)" }}>
                {f.dias.map((v, i) => (
                  <div
                    key={i}
                    title={`Día ${i + 1}: ${v} tareas`}
                    className="h-[18px] rounded-[2px] border border-line"
                    style={{ background: TONOS[nivelCarga(v, max)] }}
                  />
                ))}
              </div>
              <span className="w-[190px] shrink-0 text-right text-xs text-ink2">{TEXTO_PERFIL[f.perfil]}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default FlujoMensual;
