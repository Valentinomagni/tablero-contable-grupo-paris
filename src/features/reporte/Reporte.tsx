import { Download } from "lucide-react";
import { useState } from "react";
import type { Card, Profile, ActivityLog } from "../../lib/types";
import { dueInfo, saludScore, toARTDate } from "../../lib/metrics";
import { puntualidad } from "../../lib/puntualidad";
import { Donut, Gauge, Legend, type Seg } from "../../components/charts";
import { Avatar } from "../../lib/ui";
import { useSnapshots, useOrganizacion } from "../../hooks/useData";
import { utilizacionEquipo } from "../../lib/ociosidad";
import { useArqueoStats } from "../../hooks/useArqueo";
import { filtrarPorSegmento } from "../../lib/segmento";
import { AnalisisMensual } from "./AnalisisMensual";
import { Comparador } from "./Comparador";
import { toast } from "sonner";
import { documentoImpresion, type DatosReporte } from "../../lib/impresion";
import { abrirImpresion } from "../../lib/impresion-dom";

// Semáforo del cumplimiento de arqueo (SOLO sobre el número, marca monocroma).
const colorArqueo = (pct: number) => (pct >= 98 ? "var(--done)" : pct >= 95 ? "var(--warn)" : "var(--danger)");
const mesActualPrefix = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// Paleta categórica del donut de personas: escala de GRISES (marca monocroma).
// El segmento mayor lleva el acento; el resto, grises distinguibles entre sí.
const CAT = ["#3f3f46", "#a1a1aa", "#71717a", "#d4d4d8", "#52525b", "#8b8b93"];

export function Reporte({ cards: cardsIn, team, activity }: { cards: Card[]; team: Profile[]; activity: ActivityLog[] }) {
  const org = useOrganizacion();
  // segmentación por marca/sucursal (spec 26 item 1): filtra ANTES de calcular métricas
  const [marcaFiltro, setMarcaFiltro] = useState<string | null>(null);
  const [sucursalFiltro, setSucursalFiltro] = useState<string | null>(null);
  const cards = filtrarPorSegmento(cardsIn, team, { marca: marcaFiltro, sucursal: sucursalFiltro });
  const segLbl = marcaFiltro ? ` — ${marcaFiltro}${sucursalFiltro ? ` · ${sucursalFiltro}` : ""}` : "";
  // Dotación consistente con el segmento activo: usa el campo propio del perfil (sin filtro = equipo completo; perfil sin marca/sucursal no matchea un filtro activo).
  const teamSeg = team.filter((u) => (!marcaFiltro || u.marca === marcaFiltro) && (!sucursalFiltro || u.sucursal === sucursalFiltro));
  const now = Date.now(), day = 86400000, mes = now - 30 * day;
  const norm = cards.filter((c) => c.card_type !== "operativa");
  const abiertas = norm.filter((c) => c.status !== "term");
  const term30 = norm.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= mes);
  const vencidas = abiertas.filter((c) => { const i = dueInfo(c); return i && i.days < 0; });
  const bloqueadas = abiertas.filter((c) => (c.deps ?? []).some((id) => { const d = cards.find((x) => x.id === id); return d && d.status !== "term"; }) && c.status !== "term");
  const actMes = activity.filter((a) => new Date(a.at).getTime() >= mes).reduce((s, a) => s + a.qty, 0);

  const hoyISO = toARTDate(new Date(now).toISOString());
  const punt = puntualidad(norm, hoyISO);
  const total = abiertas.length + term30.length;
  const pctAvance = total ? Math.round((term30.length / total) * 100) : 0;
  const salud = saludScore(abiertas, term30);
  const saludTxt = salud >= 75 ? "Saludable" : salud >= 50 ? "Atención" : "Crítico";
  // Métrica única → gris; el color de estado queda SOLO en el texto del veredicto cuando es negativo.
  const saludTxtColor = salud >= 75 ? undefined : salud >= 50 ? "var(--warn)" : "var(--danger)";

  const estSegs: Seg[] = [
    { label: "Pendiente", val: norm.filter((c) => c.status === "pend").length, color: "var(--ink2)" },
    { label: "En proceso", val: norm.filter((c) => c.status === "proc").length, color: "var(--s1)" },
    { label: "Terminado", val: norm.filter((c) => c.status === "term").length, color: "var(--done)" },
  ];
  const personaSegs: Seg[] = teamSeg.map((u) => ({ label: u.name, val: abiertas.filter((c) => c.owner === u.id).length, color: "" }))
    .filter((s) => s.val > 0).sort((a, b) => b.val - a.val)
    .map((s, i) => ({ ...s, color: CAT[i % CAT.length] }));

  const rank = teamSeg.map((u) => ({
    u, ef: term30.filter((c) => c.owner === u.id).reduce((s, c) => s + (c.effort ?? 1), 0),
    n: term30.filter((c) => c.owner === u.id).length,
    act: activity.filter((a) => a.owner === u.id && new Date(a.at).getTime() >= mes).reduce((s, a) => s + a.qty, 0),
  })).sort((a, b) => b.ef - a.ef);
  const maxEf = Math.max(1, ...rank.map((r) => r.ef));

  // Utilización del tiempo (planificación de carga): últimos 30 días hasta hoy, días hábiles.
  const snaps = useSnapshots(true).data ?? [];
  const hastaISO = new Date(now).toISOString().slice(0, 10);
  const desdeISO = new Date(now - 30 * day).toISOString().slice(0, 10);
  const util = utilizacionEquipo(teamSeg.filter((u) => u.role !== "jefe"), cards, activity, snaps, desdeISO, hastaISO);

  // Controles de caja (arqueo) — cumplimiento del mes actual por card de control (P1).
  const arqueo = useArqueoStats(cards, mesActualPrefix());

  const card = "bg-surface rounded-2xl p-[18px]";
  const cardSh = { boxShadow: "var(--ring),var(--shadow)" };

  // Vista de impresión DEDICADA (spec 28-correcciones, item 1). Ver src/lib/impresion.ts:
  // se arma un documento propio y se imprime ESE, en vez de intentar imprimir la app
  // escondiendo el armazón con `@media print` — que es lo que dejaba las hojas en blanco.
  const fechaLarga = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const datosImpresion: DatosReporte = {
    titulo: "Reporte ejecutivo — Equipo Contable",
    subtitulo: `Grupo Paris${segLbl} · últimos 30 días`,
    generado: fechaLarga,
    kpis: [
      { rotulo: "Salud del equipo", valor: `${salud}%`, detalle: saludTxt },
      { rotulo: "Avance del período", valor: `${pctAvance}%`, detalle: `${term30.length}/${total} tareas` },
      {
        // `muestraChica` se respeta igual que en pantalla (Reporte.tsx, bloque Puntualidad):
        // con 1 o 2 casos el porcentaje no significa nada y NO se publica. En el PDF importa
        // todavía más: es el artefacto que circula fuera de contexto y sobrevive, así que es
        // el peor lugar para imprimir un "0%" que el propio sistema decidió no mostrar.
        rotulo: "Puntualidad",
        valor: punt.pct === null ? "sin datos" : punt.muestraChica ? "pocos datos" : `${punt.pct}%`,
        detalle: punt.pct === null ? undefined
          : punt.muestraChica ? `n=${punt.n}, insuficiente para medir`
          : `${punt.enFecha} de ${punt.n} con vencimiento`,
      },
      { rotulo: "Vencidas", valor: String(vencidas.length) },
      { rotulo: "Bloqueadas", valor: String(bloqueadas.length) },
      { rotulo: "Abiertas", valor: String(abiertas.length) },
      { rotulo: "Cerradas (30 días)", valor: String(term30.length) },
      { rotulo: "Actividad operativa", valor: String(actMes) },
    ],
    secciones: [
      {
        titulo: "Tareas por estado",
        encabezados: ["Estado", "Cantidad"],
        filas: estSegs.map((s) => ({ celdas: [s.label, String(s.val)] })),
      },
      {
        // Mismo filtro que en pantalla (`rank.filter(r => r.ef > 0 || r.act > 0)`): sin él
        // el PDF listaba a TODO el equipo con 0/0/0 —incluidas licencias e ingresos
        // recientes— y las dos vistas del mismo ranking no coincidían. Si nadie tuvo
        // actividad, la sección queda sin filas y sale el texto "Sin datos en este período".
        titulo: "Ranking de productividad (esfuerzo cerrado, 30 días)",
        encabezados: ["Persona", "Esfuerzo", "Tareas", "Actividad"],
        filas: rank.filter((r) => r.ef > 0 || r.act > 0)
          .map((r) => ({ celdas: [r.u.name, String(r.ef), String(r.n), String(r.act)] })),
      },
      {
        titulo: "Carga abierta por persona",
        encabezados: ["Persona", "Abiertas"],
        filas: personaSegs.map((s) => ({ celdas: [s.label, String(s.val)] })),
      },
    ],
  };
  const imprimir = () => {
    if (!abrirImpresion(documentoImpresion(datosImpresion))) {
      toast.error("El navegador bloqueó la ventana. Permití las ventanas emergentes de este sitio y probá de nuevo.");
    }
  };

  return (
    <div className="px-6 py-4 w-full max-w-[940px] flex flex-col gap-4" id="reporte-print">
      {/* El CSS de impresión que había acá se eliminó a propósito: intentaba imprimir esta
          misma pantalla escondiendo el armazón de la app, y ese enfoque dejaba las hojas en
          blanco. Ahora "Imprimir / PDF" genera un documento propio (src/lib/impresion.ts) y
          lo imprime en una ventana nueva, sin nada del layout de la app que deshacer. */}
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight m-0">Reporte ejecutivo — Equipo Contable</h1>
          <p className="text-ink2 text-sm m-0">Generado {fechaLarga} · últimos 30 días</p>
        </div>
        <div className="no-print flex items-center gap-2 flex-wrap">
          {org.marcas.length > 0 && (
            <select value={marcaFiltro ?? ""} onChange={(e) => { setMarcaFiltro(e.target.value || null); setSucursalFiltro(null); }}
              className="border border-line bg-surface2 text-ink2 rounded-lg px-3 py-2 text-[13px] outline-none">
              <option value="">Todas las marcas</option>
              {org.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {org.sucursales.length > 0 && (
            <select value={sucursalFiltro ?? ""} onChange={(e) => setSucursalFiltro(e.target.value || null)}
              className="border border-line bg-surface2 text-ink2 rounded-lg px-3 py-2 text-[13px] outline-none">
              <option value="">Todas las sucursales</option>
              {org.sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <button onClick={imprimir} className="flex items-center gap-2 border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]" style={cardSh}>
            <Download size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {([["Salud del equipo", <Gauge key="g" pct={salud} color="var(--s1)" />, <b key="b" style={{ color: saludTxtColor }}>{saludTxt}</b>],
          ["Avance del período", <Gauge key="g" pct={pctAvance} color="var(--s1)" />, <b key="b">{term30.length}/{total} tareas</b>]] as const)
          .map(([l, g, b], i) => (
            <div key={i} className="bg-surface rounded-2xl p-4 flex flex-col items-center gap-1.5" style={cardSh}>
              <span className="text-[11.5px] uppercase tracking-wide text-ink2">{l}</span>{g}<span className="text-[15px] font-semibold">{b}</span>
            </div>
          ))}
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center gap-1.5" style={cardSh}>
          <span className="text-[11.5px] uppercase tracking-wide text-ink2">Puntualidad</span>
          {punt.pct === null ? (
            <>
              <Gauge pct={0} color="var(--s1)" />
              <span className="text-[15px] font-semibold">sin datos</span>
            </>
          ) : punt.muestraChica ? (
            <span className="text-ink2 text-[13px] text-center">Pocos datos (n={punt.n}) para medir</span>
          ) : (
            <>
              <Gauge pct={punt.pct} color="var(--s1)" />
              <span className="text-[15px] font-semibold">{punt.pct}%</span>
              <span className="text-ink2 text-[11.5px] text-center">{punt.enFecha} de {punt.n} con vencimiento · {punt.sinFecha} sin fecha</span>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
        {([["Vencidas", vencidas.length, vencidas.length ? "border-l-danger" : "border-l-done"],
          ["Bloqueadas", bloqueadas.length, bloqueadas.length ? "border-l-warn" : "border-l-done"],
          ["Abiertas", abiertas.length, "border-l-line"], ["Cerradas (30d)", term30.length, "border-l-line"],
          ["Actividad op.", actMes, "border-l-line"], ["Personas", teamSeg.filter((u) => u.role !== "jefe").length, "border-l-line"]] as const)
          .map(([l, v, b], i) => (
            <div key={i} className={`bg-surface rounded-[14px] px-4 py-3.5 border-l-[3px] ${b}`} style={cardSh}>
              <b className="block text-2xl font-bold tracking-tight tnum">{v}</b>
              <span className="text-[11.5px] text-ink2 uppercase tracking-wide">{l}</span>
            </div>
          ))}
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Tareas por estado</h3>
          <div className="flex items-center gap-[18px] flex-wrap"><Donut segs={estSegs} centerTop={`${norm.length}`} centerBot="tareas" /><Legend segs={estSegs} /></div>
        </div>
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Carga abierta por persona</h3>
          <div className="flex items-center gap-[18px] flex-wrap"><Donut segs={personaSegs} centerTop={`${abiertas.length}`} centerBot="abiertas" />
            {personaSegs.length ? <Legend segs={personaSegs.slice(0, 6)} /> : <span className="text-ink2 text-sm">Sin carga abierta.</span>}</div>
        </div>
      </div>

      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Ranking de productividad (esfuerzo cerrado, 30 días)</h3>
        {rank.filter((r) => r.ef > 0 || r.act > 0).map((r, i) => (
          <div key={r.u.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
            <span className="w-5 text-center font-bold text-ink2 tnum">{i + 1}</span><Avatar name={r.u.name} size={26} />
            <span className="w-[170px] shrink-0 truncate">{r.u.name} <span className="text-ink2 capitalize">{r.u.role}</span></span>
            <div className="flex-1 h-[9px] bg-surface2 rounded-full overflow-hidden min-w-[60px]"><div className="h-full rounded-full" style={{ width: `${Math.round((r.ef / maxEf) * 100)}%`, background: "linear-gradient(90deg,var(--s1),var(--accent))" }} /></div>
            <span className="shrink-0 tnum font-semibold text-[13px]">{r.ef} pts <span className="text-ink2 font-normal">· {r.n} tareas{r.act ? ` · ${r.act} op.` : ""}</span></span>
          </div>
        ))}
        {rank.every((r) => r.ef === 0 && r.act === 0) && <p className="text-ink2 text-sm">Sin actividad en el período.</p>}
      </div>

      <div className={card} style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Utilización del tiempo (30 días)</h3>
        {util.length ? util.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
            <Avatar name={p.name} size={26} />
            <span className="w-[170px] shrink-0 truncate">{p.name}</span>
            <div className="flex-1 h-[9px] bg-surface2 rounded-full overflow-hidden min-w-[60px]"><div className="h-full rounded-full" style={{ width: `${Math.round(p.indice * 100)}%`, background: "var(--s1)" }} /></div>
            <span className="shrink-0 tnum font-semibold text-[13px] w-[44px] text-right">{Math.round(p.indice * 100)}%</span>
            <span className="shrink-0 text-ink2 text-[12px] w-[150px] text-right">{p.diasSinActividad} días sin actividad registrada</span>
          </div>
        )) : <p className="text-ink2 text-sm">Sin datos de utilización.</p>}
        <p className="text-[11px] text-ink2 mt-3">Indicador de planificación de carga — no mide presencia ni productividad individual</p>
      </div>

      {arqueo.length > 0 && (
        <div className={card} style={cardSh}>
          <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Controles de caja (arqueo)</h3>
          {arqueo.map(({ card: c, stats }) => {
            const owner = team.find((u) => u.id === c.owner);
            return (
              <div key={c.id} className="flex items-center gap-3 py-2 text-sm border-t border-line first:border-0">
                {owner && <Avatar name={owner.name} size={26} />}
                <span className="flex-1 min-w-0 truncate">{c.title} <span className="text-ink2">· {owner?.name ?? "Sin responsable"}</span></span>
                <span className="shrink-0 tnum font-semibold text-[15px] w-[64px] text-right" style={{ color: colorArqueo(stats.pctOk) }}>{stats.pctOk}%</span>
                <span className="shrink-0 text-ink2 text-[12px] w-[140px] text-right">{stats.ok}/{stats.total} sin diferencias</span>
              </div>
            );
          })}
        </div>
      )}

      <AnalisisMensual cards={cards} team={teamSeg} activity={activity} segmento={marcaFiltro ? `${marcaFiltro}${sucursalFiltro ? ` · ${sucursalFiltro}` : ""}` : null} />

      <Comparador team={team} />
    </div>
  );
}

export default Reporte;
