import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Minus, FileSpreadsheet } from "lucide-react";
import type { Card, Profile, ActivityLog } from "../../lib/types";
import { analizarMes } from "../../lib/analisis";
import { indiceRetrabajo } from "../../lib/retrabajo";
import { tendenciaDiferencias } from "../../lib/arqueo";
import { concentracion } from "../../lib/busfactor";
import { analiticaOperativas } from "../../lib/analitica-operativas";
import { armarLibroAnalisis, descargarExcel } from "../../lib/excel";
import { Gauge } from "../../components/charts";
import { useOccurrences } from "../../hooks/useOccurrences";
import { useArchiveEquipo } from "../../hooks/useArchive";
import { useArqueoOccsAll } from "../../hooks/useArqueo";
import { toast } from "sonner";

const cardSh = { boxShadow: "var(--ring),var(--shadow)" };
const card = "bg-surface rounded-2xl p-[18px]";
const fmtMonto = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// Semáforo SOLO numérico (marca monocroma): el color queda en el número, no en el fondo.
const colorPct = (pct: number) => (pct >= 80 ? "var(--done)" : pct >= 50 ? "var(--warn)" : "var(--danger)");

// Análisis ejecutivo de cierre del mes en curso (spec items 8 y 9). Recibe las cards YA
// segmentadas y la dotación del segmento desde el Reporte; trae por su cuenta las ocurrencias
// del mes y los archivos históricos del equipo. Imprimible (sin no-print).
export function AnalisisMensual({ cards, team, activity = [], segmento = null }: { cards: Card[]; team: Profile[]; activity?: ActivityLog[]; segmento?: string | null }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const occs = useOccurrences(year, month).data ?? [];
  const archives = useArchiveEquipo().data ?? [];
  const a = analizarMes(cards, team, occs, archives, year, month);
  const retrabajo = indiceRetrabajo(cards, team);
  const occsArqueoTodas = useArqueoOccsAll(cards);
  const tendencia = tendenciaDiferencias(occsArqueoTodas, team);
  const busFactor = concentracion(archives, team);
  const desdeISO = `${year}-${String(month).padStart(2, "0")}-01`;
  const hastaISO = new Date(year, month, 0).toISOString().slice(0, 10);
  const operativas = analiticaOperativas(cards, activity, team, desdeISO, hastaISO);
  const mesLbl = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const [exportando, setExportando] = useState(false);

  const exportarExcel = async () => {
    try {
      setExportando(true);
      const libro = armarLibroAnalisis(a, { mesLabel: mesLbl, segmento });
      const nombreArchivo = `analisis-${year}-${String(month).padStart(2, "0")}.xlsx`;
      await descargarExcel(libro, nombreArchivo);
    } catch (error) {
      toast.error("No se pudo exportar el Excel.");
    } finally {
      setExportando(false);
    }
  };

  const byId = new Map(team.map((p) => [p.id, p]));
  const nombrar = (id: string) => byId.get(id)?.name ?? id;

  const delta = a.deltaMesAnterior;
  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta === null || delta === 0 ? "var(--ink2)" : delta > 0 ? "var(--done)" : "var(--danger)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight m-0">Análisis del mes</h2>
          <p className="text-ink2 text-sm m-0 capitalize">{mesLbl}</p>
        </div>
        <button onClick={exportarExcel} disabled={exportando} className="no-print flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px] disabled:opacity-50" style={cardSh}>
          <FileSpreadsheet size={16} /> Exportar Excel
        </button>
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

      {/* Retrabajo: reaperturas de tareas ya terminadas. Encuadre no punitivo (spec 28 Fase B). */}
      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-1">Retrabajo</h3>
        <p className="text-ink2 text-[12.5px] mb-3.5">
          Mide cuántas tareas terminadas se reabrieron, no quién las reabrió. Una tarea que se reabre
          suele avisar que el criterio de "terminado" no quedó claro o que faltó una revisión.
          Sirve para revisar el procedimiento y la capacitación.
        </p>
        <div className="flex items-center gap-2 mb-3.5">
          {retrabajo.general.pct === null ? (
            <span className="text-ink2 text-sm">Sin tareas terminadas este mes.</span>
          ) : (
            <>
              <b className="text-2xl font-bold tracking-tight tnum" style={{ color: colorPct(100 - retrabajo.general.pct) }}>
                {retrabajo.general.pct}%
              </b>
              <span className="text-ink2 text-[12.5px]">
                de reaperturas sobre terminadas (<span className="tnum">{retrabajo.general.reaperturas}</span> de <span className="tnum">{retrabajo.general.terminadas}</span>)
              </span>
            </>
          )}
        </div>
        {retrabajo.porPersona.length ? (
          <table className="w-full text-sm mb-3.5">
            <thead>
              <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                <th className="font-semibold py-1">Persona</th>
                <th className="font-semibold py-1 text-right tnum">Terminadas</th>
                <th className="font-semibold py-1 text-right tnum">Reaperturas</th>
                <th className="font-semibold py-1 text-right tnum">%</th>
              </tr>
            </thead>
            <tbody>
              {retrabajo.porPersona.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 truncate">{p.nombre}</td>
                  <td className="py-2 text-right tnum">{p.terminadas}</td>
                  <td className="py-2 text-right tnum">{p.reaperturas}</td>
                  <td className="py-2 text-right tnum">{p.pct === null ? "—" : `${p.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-ink2 text-sm mb-3.5">Sin personas en este segmento.</p>}
        {retrabajo.masReabiertas.length > 0 && (
          <div>
            <span className="text-[11.5px] text-ink2 uppercase tracking-wide">Tareas más reabiertas</span>
            <ul className="text-sm mt-1.5 flex flex-col gap-1">
              {retrabajo.masReabiertas.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">{m.title}</span>
                  <span className="tnum text-ink2 shrink-0">{m.veces} veces</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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

      {/* Tendencia de diferencias de arqueo (Task 6, spec28 fase B). Encuadre en positivo:
          una diferencia recurrente casi siempre avisa de un procedimiento mal diseñado o de
          una necesidad de capacitación. Por eso el desglose por persona muestra en cuántos
          meses hubo diferencias (señal de proceso) y NO el monto: el monto total ya está en
          la serie mensual, y al lado de un nombre convierte la tabla en un ranking. */}
      {tendencia.serie.length > 0 && (
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-1">Diferencias de caja en el tiempo</h3>
          <p className="text-ink2 text-[12.5px] mb-3.5">
            Muestra cómo evolucionan las diferencias de arqueo mes a mes y en cuántos meses se
            repiten. Una diferencia que reaparece casi siempre indica un problema de proceso.
            Sirve para revisar el procedimiento y la capacitación.
          </p>

          <div className="flex items-end gap-2 h-[110px] mb-1 px-1">
            {(() => {
              const max = Math.max(1, ...tendencia.serie.map((s) => s.cantidad));
              return tendencia.serie.map((s) => (
                <div key={s.mes} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full" title={`${s.mes}: ${s.cantidad} diferencia(s), ${fmtMonto(s.total)}`}>
                  <div className="w-full rounded-t-[4px] bg-ink2" style={{ height: `${(s.cantidad / max) * 90}px`, minHeight: s.cantidad > 0 ? 3 : 0, opacity: s.cantidad > 0 ? 1 : 0.15 }} />
                  <span className="text-[10.5px] text-ink2 tnum">{s.mes.slice(5)}</span>
                </div>
              ));
            })()}
          </div>

          {tendencia.reincidentes.length > 0 && (
            <div className="mt-3.5">
              <span className="text-[11.5px] text-ink2 uppercase tracking-wide">Diferencias en más de un mes</span>
              <table className="w-full text-sm mt-1.5">
                <thead>
                  <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                    <th className="font-semibold py-1">Persona</th>
                    <th className="font-semibold py-1 text-right tnum">Meses con diferencias</th>
                  </tr>
                </thead>
                <tbody>
                  {tendencia.reincidentes.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="py-2 truncate">{r.nombre}</td>
                      <td className="py-2 text-right tnum">{r.meses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Concentración de conocimiento (bus factor): riesgo de continuidad del negocio, no
          una evaluación de nadie. Si nadie concentra una categoría al 80%+, no hay nada que
          mostrar y el bloque directamente no aparece. */}
      {busFactor.length > 0 && (
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-1">Concentración de conocimiento</h3>
          <p className="text-ink2 text-[12.5px] mb-3.5">
            Categorías donde una sola persona concentra la mayor parte del trabajo histórico. No es
            una crítica: suele pasar justamente con la persona más confiable del equipo. Pero si se
            toma vacaciones, se enferma o se va, conviene tener a alguien más formado como backup.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                <th className="font-semibold py-1">Categoría</th>
                <th className="font-semibold py-1">Quién la concentra</th>
                <th className="font-semibold py-1 text-right tnum">%</th>
                <th className="font-semibold py-1 text-right tnum">Personas</th>
              </tr>
            </thead>
            <tbody>
              {busFactor.map((b) => (
                <tr key={b.categoria} className="border-t border-line">
                  <td className="py-2 truncate">{b.categoria}</td>
                  <td className="py-2 truncate">{b.principal}</td>
                  <td className="py-2 text-right tnum font-semibold" style={{ color: "var(--warn)" }}>{b.pct}%</td>
                  <td className="py-2 text-right tnum">{b.personas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analítica de tareas operativas (Task 9, spec 28 Fase D). Encuadre: sirve para
          detectar tareas que consumen tiempo excesivo y oportunidades de mejora del
          PROCESO — no para comparar personas. Por eso el cruce empleado x tipo se muestra
          agrupado por tipo de tarea (el eje que importa acá), sin ordenarlo como ranking
          de personas. "Tipo de tarea" = título de la card operativa (una categoría
          agrupa varias tareas distintas y ocultaría justo la que consume tiempo de más). */}
      {(operativas.porEmpleado.length > 0 || operativas.porTipo.length > 0) && (
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-1">Tareas operativas</h3>
          <p className="text-ink2 text-[12.5px] mb-3.5">
            Cantidad ejecutada por tarea. El objetivo es ver si algún tipo de tarea concentra
            demasiada carga para mejorar el proceso, no evaluar a quién la ejecuta.
            <br />
            No se muestra tiempo por tarea: hoy no hay cronómetro por tarea operativa (propuesto,
            pendiente de aprobación) y estimarlo a partir de "en proceso" → "hecho" mide cuánto
            estuvo abierta la card, no el trabajo efectivo — puede incluir días de inactividad.
          </p>

          <span className="text-[11.5px] text-ink2 uppercase tracking-wide">Por empleado</span>
          {operativas.porEmpleado.length ? (
            <table className="w-full text-sm mt-1.5 mb-3.5">
              <thead>
                <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                  <th className="font-semibold py-1">Persona</th>
                  <th className="font-semibold py-1 text-right tnum">Cantidad ejecutada</th>
                </tr>
              </thead>
              <tbody>
                {operativas.porEmpleado.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 truncate">{p.nombre}</td>
                    <td className="py-2 text-right tnum">{p.cantidadEjecutada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-ink2 text-sm mb-3.5">Sin actividad operativa en el período.</p>}

          <span className="text-[11.5px] text-ink2 uppercase tracking-wide">Por tipo de tarea</span>
          {operativas.porTipo.length ? (
            <table className="w-full text-sm mt-1.5 mb-3.5">
              <thead>
                <tr className="text-ink2 text-[11.5px] uppercase tracking-wide text-left">
                  <th className="font-semibold py-1">Tarea</th>
                  <th className="font-semibold py-1 text-right tnum">Frecuencia</th>
                  <th className="font-semibold py-1 text-right tnum">% del total</th>
                </tr>
              </thead>
              <tbody>
                {operativas.porTipo.map((t) => (
                  <tr key={t.titulo} className="border-t border-line">
                    <td className="py-2 truncate">{t.titulo}</td>
                    <td className="py-2 text-right tnum">{t.frecuencia}</td>
                    <td className="py-2 text-right tnum">{t.pctDelTotal}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-ink2 text-sm mb-3.5">Sin tipos de tarea registrados en el período.</p>}

          {operativas.cargaCruzada.length > 0 && (
            <>
              <span className="text-[11.5px] text-ink2 uppercase tracking-wide">Carga operativa por tarea (no es un ranking de personas)</span>
              <div className="mt-1.5 flex flex-col gap-3">
                {operativas.porTipo.map((t) => {
                  const filas = operativas.cargaCruzada.filter((c) => c.titulo === t.titulo);
                  if (!filas.length) return null;
                  return (
                    <div key={t.titulo}>
                      <span className="text-[12.5px] font-semibold">{t.titulo}</span>
                      <ul className="text-sm mt-1 flex flex-col gap-1">
                        {filas.map((f) => (
                          <li key={f.empleadoId} className="flex justify-between gap-2 text-ink2">
                            <span className="truncate">{f.empleadoNombre}</span>
                            <span className="tnum shrink-0">{f.cantidad}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
