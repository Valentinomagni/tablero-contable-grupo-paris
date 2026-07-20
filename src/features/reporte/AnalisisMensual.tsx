import { TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";
import type { Card, Profile } from "../../lib/types";
import { analizarMes } from "../../lib/analisis";
import { Gauge } from "../../components/charts";
import { useOccurrences } from "../../hooks/useOccurrences";
import { useArchiveEquipo } from "../../hooks/useArchive";

const cardSh = { boxShadow: "var(--ring),var(--shadow)" };
const card = "bg-surface rounded-2xl p-[18px]";
const fmtMonto = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// Semáforo SOLO numérico (marca monocroma): el color queda en el número, no en el fondo.
const colorPct = (pct: number) => (pct >= 80 ? "var(--done)" : pct >= 50 ? "var(--warn)" : "var(--danger)");

// Análisis ejecutivo de cierre del mes en curso (spec items 8 y 9). Recibe las cards YA
// segmentadas y la dotación del segmento desde el Reporte; trae por su cuenta las ocurrencias
// del mes y los archivos históricos del equipo. Imprimible (sin no-print).
export function AnalisisMensual({ cards, team }: { cards: Card[]; team: Profile[] }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const occs = useOccurrences(year, month).data ?? [];
  const archives = useArchiveEquipo().data ?? [];
  const a = analizarMes(cards, team, occs, archives, year, month);
  const mesLbl = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const byId = new Map(team.map((p) => [p.id, p]));
  const nombrar = (id: string) => byId.get(id)?.name ?? id;

  const delta = a.deltaMesAnterior;
  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta === null || delta === 0 ? "var(--ink2)" : delta > 0 ? "var(--done)" : "var(--danger)";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight m-0">Análisis del mes</h2>
        <p className="text-ink2 text-sm m-0 capitalize">{mesLbl}</p>
      </div>

      {/* KPIs: cumplimiento + evolución + rendimiento promedio histórico */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center gap-1.5" style={cardSh}>
          <span className="text-[11.5px] uppercase tracking-wide text-ink2">Cumplimiento del mes</span>
          <Gauge pct={a.cumplimiento} color="var(--s1)" />
        </div>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5" style={cardSh}>
          <span className="text-[11.5px] uppercase tracking-wide text-ink2">Evolución vs. mes anterior</span>
          {delta === null ? (
            <span className="text-ink2 text-sm text-center">Sin historial todavía</span>
          ) : (
            <span className="flex items-center gap-1.5 text-2xl font-bold tracking-tight tnum" style={{ color: deltaColor }}>
              <DeltaIcon size={22} />{delta > 0 ? "+" : ""}{delta} pts
            </span>
          )}
        </div>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5" style={cardSh}>
          <span className="text-[11.5px] uppercase tracking-wide text-ink2">Rendimiento promedio</span>
          {a.promedioHistorico === null ? (
            <span className="text-ink2 text-sm text-center">Sin historial todavía</span>
          ) : (
            <>
              <b className="text-2xl font-bold tracking-tight tnum" style={{ color: colorPct(a.promedioHistorico) }}>{a.promedioHistorico}%</b>
              <span className="text-ink2 text-[11.5px] text-center">
                Este mes {a.cumplimiento}% · histórico {a.promedioHistorico}%
                {" "}({a.cumplimiento - a.promedioHistorico >= 0 ? "+" : ""}{a.cumplimiento - a.promedioHistorico})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tira de contadores del cierre */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
        {([["Vencidas", a.vencidas, a.vencidas ? "border-l-danger" : "border-l-done"],
          ["Difs. de arqueo", a.arqueos.difs, a.arqueos.difs ? "border-l-warn" : "border-l-done"],
          ["Personas", a.porPersona.length, "border-l-line"]] as const)
          .map(([l, v, b], i) => (
            <div key={i} className={`bg-surface rounded-[14px] px-4 py-3.5 border-l-[3px] ${b}`} style={cardSh}>
              <b className="block text-2xl font-bold tracking-tight tnum">{v}</b>
              <span className="text-[11.5px] text-ink2 uppercase tracking-wide">{l}</span>
            </div>
          ))}
      </div>

      {/* Cumplimiento por persona */}
      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Cumplimiento por persona</h3>
        {a.porPersona.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                <th className="font-semibold py-1">Persona</th>
                <th className="font-semibold py-1 text-right tnum">Cerradas</th>
                <th className="font-semibold py-1 text-right tnum">Vencidas</th>
                <th className="font-semibold py-1 text-right tnum">Abiertas</th>
                <th className="font-semibold py-1 text-right tnum">%</th>
              </tr>
            </thead>
            <tbody>
              {a.porPersona.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 truncate">{p.nombre}</td>
                  <td className="py-2 text-right tnum">{p.total - p.abiertas}/{p.total}</td>
                  <td className="py-2 text-right tnum" style={p.vencidas ? { color: "var(--danger)" } : undefined}>{p.vencidas}</td>
                  <td className="py-2 text-right tnum">{p.abiertas}</td>
                  <td className="py-2 text-right tnum font-semibold" style={{ color: colorPct(p.pct) }}>{p.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-ink2 text-sm">Sin personas en este segmento.</p>}
      </div>

      {/* Marca / sucursal */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {([["Cumplimiento por marca", a.porMarca.map((m) => ({ lbl: m.marca, pct: m.pct, total: m.total }))],
          ["Cumplimiento por sucursal", a.porSucursal.map((s) => ({ lbl: s.sucursal, pct: s.pct, total: s.total }))]] as const)
          .map(([titulo, filas], i) => (
            <div key={i} className={card} style={cardSh}>
              <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">{titulo}</h3>
              {filas.length ? (
                <table className="w-full text-sm">
                  <tbody>
                    {filas.map((f, j) => (
                      <tr key={j} className="border-t border-line first:border-0">
                        <td className="py-1.5 truncate">{f.lbl}</td>
                        <td className="py-1.5 text-right text-ink2 tnum">{f.total} tareas</td>
                        <td className="py-1.5 text-right tnum font-semibold w-[52px]" style={{ color: colorPct(f.pct) }}>{f.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-ink2 text-sm">Sin datos.</p>}
            </div>
          ))}
      </div>

      {/* Arqueos + distribución de carga */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Diferencias de arqueo</h3>
          {a.arqueos.difs > 0 ? (
            <div className="flex items-start gap-2.5 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
              <div>
                <b className="tnum">{a.arqueos.difs}</b> {a.arqueos.difs === 1 ? "control con diferencia" : "controles con diferencias"} este mes
                {a.arqueos.montoTotal !== 0 && <div className="text-ink2">Monto acumulado: <span className="tnum">{fmtMonto(a.arqueos.montoTotal)}</span></div>}
              </div>
            </div>
          ) : <p className="text-ink2 text-sm">Sin diferencias de arqueo este mes.</p>}
        </div>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Distribución del trabajo</h3>
          {a.distribucion.sobrecargados.length ? (
            <div className="text-sm flex flex-col gap-1.5">
              {a.distribucion.sobrecargados.map((id) => {
                const p = a.porPersona.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                    <span>Revisar carga de <b>{nombrar(id)}</b> ({p?.abiertas} abiertas, mediana {a.distribucion.medianaAbiertas})</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-ink2 text-sm">Carga balanceada (mediana {a.distribucion.medianaAbiertas} abiertas por persona).</p>}
        </div>
      </div>
    </div>
  );
}
