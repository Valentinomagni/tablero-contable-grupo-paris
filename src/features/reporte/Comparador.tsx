import type { Profile } from "../../lib/types";
import { comparativaMensual } from "../../lib/comparador";
import { mesLabel } from "../../lib/archivo";
import { useArchiveEquipo } from "../../hooks/useArchive";

const cardSh = { boxShadow: "var(--ring),var(--shadow)" };
const card = "bg-surface rounded-2xl p-[18px]";

// Escala de grises monocroma: 0% blanco/surface, 100% negro/ink — sin colores de semáforo,
// esto es una foto histórica, no una alerta.
function bgIntensidad(pct: number | undefined): string {
  if (pct === undefined) return "transparent";
  const l = 92 - Math.round((pct / 100) * 72); // 92% (casi blanco) a 20% (casi negro)
  return `hsl(0,0%,${l}%)`;
}
function txtColor(pct: number | undefined): string {
  if (pct === undefined) return "var(--ink2)";
  return pct >= 55 ? "#fff" : "var(--ink)";
}

function Heatmap({ titulo, filas, meses, datos }: {
  titulo: string; filas: string[]; meses: string[]; datos: Record<string, number>[];
}) {
  if (!filas.length) return null;
  return (
    <div>
      <h4 className="text-[13px] font-semibold text-ink2 mb-2">{titulo}</h4>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[12px] w-full">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-ink2 font-medium sticky left-0 bg-surface">{" "}</th>
              {meses.map((m) => (
                <th key={m} className="p-1.5 text-ink2 font-medium text-center whitespace-nowrap">{mesLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila}>
                <td className="p-1.5 font-medium whitespace-nowrap sticky left-0 bg-surface">{fila}</td>
                {meses.map((m, i) => {
                  const pct = datos[i]?.[fila];
                  return (
                    <td key={m} className="p-1.5 text-center tnum rounded" style={{ background: bgIntensidad(pct), color: txtColor(pct) }}>
                      {pct === undefined ? "—" : `${pct}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Comparador de marcas y sucursales en el tiempo (spec 28, Fase C, Task 5): serie histórica
// de cumplimiento por dimensión, mes a mes, para que la gerencia vea tendencias — no un
// número aislado. DEFENSIVO: sin sucursales cargadas (migración 27 sin aplicar), solo se
// muestra la sección de marcas con una nota, nunca una tabla vacía sin explicación.
export function Comparador({ team, meses = 6 }: { team: Profile[]; meses?: number }) {
  const archives = useArchiveEquipo().data ?? [];
  const serie = comparativaMensual(archives, team, meses);

  if (!serie.length) {
    return (
      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2">Comparativa mensual por marca y sucursal</h3>
        <p className="text-ink2 text-sm">Sin historial todavía — se completa a medida que se archivan meses cerrados.</p>
      </div>
    );
  }

  const mesesCol = serie.map((s) => s.mes);
  const marcas = [...new Set(serie.flatMap((s) => Object.keys(s.porMarca)))].sort();
  const sucursales = [...new Set(serie.flatMap((s) => Object.keys(s.porSucursal)))].sort();
  const datosMarca = serie.map((s) => s.porMarca);
  const datosSucursal = serie.map((s) => s.porSucursal);

  return (
    <div className={card} style={cardSh}>
      <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Comparativa mensual por marca y sucursal</h3>
      <div className="flex flex-col gap-4">
        <Heatmap titulo="Por marca" filas={marcas} meses={mesesCol} datos={datosMarca} />
        {sucursales.length > 0
          ? <Heatmap titulo="Por sucursal" filas={sucursales} meses={mesesCol} datos={datosSucursal} />
          : <p className="text-ink2 text-xs">Las sucursales se habilitan tras la migración 27.</p>}
      </div>
    </div>
  );
}

export default Comparador;
