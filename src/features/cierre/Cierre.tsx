import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarPlus, CheckCircle2, Circle, Clock, AlarmClock, Link2, AlertTriangle, Lock, LockOpen, CalendarRange } from "lucide-react";
import type { Card, Profile, AppSettings, Role } from "../../lib/types";
import { dueInfo, toARTDate } from "../../lib/metrics";
import { quedanRecurrentesSinReiniciar } from "../../lib/reinicio-mensual";
import { isBlocked } from "../../lib/deps";
import { supabase } from "../../lib/supabase";
import { closingCards, cierreStats, ordenarCierre, shiftMonth, MESES } from "../../lib/cierre";
import { estadoCierre, proyeccionCierre } from "../../lib/cierre-unificado";
import { useSnapshots } from "../../hooks/useData";
import { mesCerradoPor, mesesAbiertos, mesesConTrabajoDe, resumenEquipo, mesLegible, formatearMeses } from "../../lib/periodos";
import { faltantesDePlantilla, filasParaInsertar } from "../../lib/plantilla";
import { useArchiveEquipo } from "../../hooks/useArchive";
import { usePeriodos, esTablaInexistente, useCerrarMes, useReabrirMes } from "../../hooks/usePeriodos";
import { Avatar } from "../../lib/ui";
import { mensajeUsuario } from "../../lib/fallas";

const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };

const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

export function Cierre({ cards, team, isJefe, meId, meName, meRole, settings, onOpenCard }: {
  cards: Card[]; team: Profile[]; isJefe: boolean; meId: string; meName: string; meRole: Role;
  settings: AppSettings; onOpenCard: (c: Card) => void;
}) {
  // "Hoy" en hora argentina y NO en la zona del navegador: armar el ISO con
  // getFullYear/getMonth/getDate usa la zona local, así que en una máquina en UTC u otro huso
  // el Cierre abriría en un mes distinto al que muestra Mi día y la proyección mediría contra
  // un día equivocado. En vencimientos fiscales, un día de diferencia es un incumplimiento
  // inventado. Fuente única: `toARTDate`.
  const hoyISO = toARTDate(new Date().toISOString());
  const hoyAnio = Number(hoyISO.slice(0, 4));
  const hoyMes = Number(hoyISO.slice(5, 7));
  const [ym, setYm] = useState({ year: hoyAnio, month: hoyMes });
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const qc = useQueryClient();

  const template = settings.closing_template ?? [];
  const closing = closingCards(cards, ym.year, ym.month);
  const stats = cierreStats(closing);
  const orden = ordenarCierre(closing);
  // El semáforo se declara personal ("Tareas del cierre: 12 de 40" debe ser lo SUYO),
  // así que su checklist se calcula solo sobre las cards propias de `closing` — no
  // sobre todo el equipo visible (eso lo cubre la tabla de `resumenEquipo` más abajo).
  const closingMio = closing.filter((c) => c.owner === meId);
  const statsMios = cierreStats(closingMio);
  const nom = (id: string) => team.find((u) => u.id === id)?.name ?? "?";
  const nav = (delta: number) => { setConfirmando(false); setYm(shiftMonth(ym.year, ym.month, delta)); };

  // Semáforo de cierre unificado (alternativa A): junta checklist + archivo del mes
  // previo + reinicio de recurrentes en una sola lectura. DEFENSIVO: sin datos → pendiente.
  const archives = useArchiveEquipo().data ?? [];
  const prev = shiftMonth(ym.year, ym.month, -1);
  const mesPrevio = `${prev.year}-${String(prev.month).padStart(2, "0")}`;
  const archivadoMesPrevio = archives.some((a) => a.mes === mesPrevio);
  // ESTE SEMÁFORO DABA VERDE JUSTO EN EL CASO DEL INCIDENTE DEL 04/08 (hallazgo 2 de la
  // auditoría del 05/08). Tenía dos defectos en seis líneas: filtraba sólo por `recur_rule`
  // —dejando afuera las que el equipo marca desde el modal, que quedan con `recurring: true` y
  // sin regla— y comparaba el mes en UTC, así que una tarea cerrada el 31/07 a las 21:30 se
  // leía como de agosto.
  //
  // El criterio ahora está una sola vez, en `reinicio-mensual.ts`, escrito para calcar el
  // `where` de la función de la base. Tenerlo dos veces fue exactamente lo que permitió que
  // divergieran sin que nadie se enterara.
  const recurrentesOk = !quedanRecurrentesSinReiniciar(cards, mesPrevio);
  const semaforo = estadoCierre({
    checklist: closingMio.length ? statsMios : null,
    archivadoMesPrevio,
    recurrentesOk,
  });

  // ── Cierre mensual POR PERSONA (spec 28) ────────────────────────────────────
  // Cada quien cierra SU mes cuando terminó. Varios meses pueden estar abiertos a la
  // vez sin conflicto: cerrar julio no toca junio. DEFENSIVO: sin la migración 29,
  // periodos = [] y disponible = false → el botón explica por qué no se habilita.
  const periodosQuery = usePeriodos();
  const periodos = periodosQuery.data ?? [];
  // Sin migración 29 aplicada, la tabla no existe: eso es un estado esperado, distinto
  // de un error de red real. Se discriminan por código de error, no se asume "no
  // disponible" ante cualquier falla (issue: mensaje falso ante error de red).
  const migracionPendiente = periodosQuery.isError && esTablaInexistente(periodosQuery.error);
  const errorReal = periodosQuery.isError && !migracionPendiente;
  const disponible = !periodosQuery.isError;
  const cerrarMes = useCerrarMes();
  const reabrirMes = useReabrirMes();
  const mesNavegado = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  const mesActual = hoyISO.slice(0, 7);
  const esMesEnCurso = ym.year === hoyAnio && ym.month === hoyMes;
  const miCierre = mesCerradoPor(periodos, meId, mesNavegado);
  const misAbiertos = mesesAbiertos(periodos, meId, mesesConTrabajoDe(cards, meId), mesActual);
  const esGestor = isJefe || meRole === "encargado";
  const equipo = resumenEquipo(periodos, team, mesNavegado);

  // El semáforo del spec 27 mezcla datos VIVOS (recurrentes reiniciadas, archivo del mes
  // previo) con datos históricos (el checklist). Los vivos sólo describen el estado de HOY:
  // aplicados a un mes pasado darían un diagnóstico falso. Por eso ahora se puede navegar y
  // cerrar cualquier mes, pero el semáforo se muestra completo únicamente en el mes en curso;
  // en meses pasados se muestra sólo el paso del checklist —que sí es histórico y confiable—
  // más el estado de tu propio cierre, que es el dato que realmente manda.
  const pasosVisibles = esMesEnCurso ? semaforo.pasos : semaforo.pasos.filter((p) => p.key === "checklist");

  // J8 — proyección "al ritmo actual, ¿llega?" (spec 28, task 9). Sólo tiene sentido en
  // el mes en curso (mismo criterio que el semáforo: en meses pasados ya pasó o no pasó).
  // Se mira SU propio avance (closingMio), igual que el semáforo. Silencio cuando va bien
  // o cuando no hay ritmo medible: no alarmar sin datos.
  const snapshots = useSnapshots(esMesEnCurso).data ?? [];
  const ultimoDia = new Date(ym.year, ym.month, 0).getDate();
  const finDeMesISO = `${ym.year}-${String(ym.month).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  const proyeccion = esMesEnCurso ? proyeccionCierre(closingMio, snapshots, hoyISO, finDeMesISO) : null;

  async function toggleCierre() {
    if (!disponible) return;
    try {
      if (miCierre) {
        await reabrirMes.mutateAsync({ ownerId: meId, mes: mesNavegado });
        toast.success(`Reabriste tu ${mesLegible(mesNavegado)} de ${ym.year}.`);
      } else {
        await cerrarMes.mutateAsync({ ownerId: meId, mes: mesNavegado });
        toast.success(`Cerraste tu ${mesLegible(mesNavegado)} de ${ym.year}.`);
      }
    } catch (e) {
      toast.error(mensajeUsuario(e, "actualizar el cierre"));
    } finally {
      setConfirmando(false);
    }
  }

  async function generar() {
    const faltan = faltantesDePlantilla(template, cards, ym.year, ym.month);
    if (!faltan.length) { toast(`El cierre de ${MESES[ym.month - 1]} ya está generado.`); return; }
    setBusy(true);
    const { error } = await supabase.from("cards").insert(filasParaInsertar(faltan, ym.year, ym.month, meName));
    setBusy(false);
    if (error) { toast.error(mensajeUsuario(error, "generar las tareas del cierre")); return; }
    qc.invalidateQueries({ queryKey: ["cards"] });
    toast.success(`${faltan.length} tarea(s) de cierre generadas`);
  }

  const StatChip = ({ label, value, tone }: { label: string; value: number; tone?: "danger" | "done" | "warn" }) => (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 flex-1 min-w-[110px]" style={cardSh}>
      <div className="text-2xs text-ink2 uppercase tracking-[0.07em] font-semibold mb-1">{label}</div>
      <b className="text-3xl leading-none font-bold tnum tracking-[-0.02em]"
        style={{ color: tone === "danger" ? "var(--danger)" : tone === "done" ? "var(--done)" : tone === "warn" ? "var(--warn)" : undefined }}>{value}</b>
    </div>
  );

  const PasoIcon = ({ estado }: { estado: "ok" | "pendiente" | "atencion" }) =>
    estado === "ok" ? <CheckCircle2 size={18} className="text-done shrink-0" />
      : estado === "atencion" ? <AlertTriangle size={18} className="text-warn shrink-0" />
      : <Circle size={18} className="text-ink2 shrink-0" />;

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      {/* Navegación libre de meses: se puede trabajar y cerrar cualquier mes, no sólo el actual. */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => nav(-1)} className="border border-line bg-surface2 rounded-lg p-1.5" title="Mes anterior"><ChevronLeft size={16} /></button>
        <h2 className="text-lg font-bold tracking-[-0.01em] capitalize min-w-[190px] text-center">{MESES[ym.month - 1]} de {ym.year}</h2>
        <button onClick={() => nav(1)} className="border border-line bg-surface2 rounded-lg p-1.5" title="Mes siguiente"><ChevronRight size={16} /></button>
        {isJefe && template.length > 0 && (
          <button onClick={generar} disabled={busy}
            className="flex items-center gap-1.5 ml-auto bg-accent text-[color:var(--accent-ink)] rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50">
            <CalendarPlus size={14} /> {busy ? "Generando…" : `Generar cierre de ${MESES[ym.month - 1]}`}</button>
        )}
      </div>

      {/* Aviso de meses abiertos: informativo, no una alarma. Trabajar en paralelo es válido. */}
      {misAbiertos.length > 1 && (
        <div className="inline-flex items-center gap-2 bg-surface2 border border-line rounded-full px-3.5 py-1.5 mb-4 text-xs text-ink2">
          <CalendarRange size={14} className="shrink-0" />
          <span>Tenés {misAbiertos.length} meses abiertos: {formatearMeses(misAbiertos)}</span>
        </div>
      )}

      {/* Cierre unificado (alternativa A): un solo semáforo responde "¿cerré el mes?".
          Ya NO se restringe al mes en curso: se puede trabajar y cerrar cualquier mes.
          En meses pasados sólo se listan los pasos históricos (ver `pasosVisibles`). */}
      <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-5" style={cardSh}>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-base font-bold tracking-[-0.01em]">Cierre del mes</h3>
          {!esMesEnCurso && (
            <p className="text-xs text-ink2 mt-1 leading-snug">
              En meses pasados solo mostramos el avance de las tareas del cierre: es el único dato histórico confiable.
            </p>
          )}
          <div className="mt-3 flex flex-col gap-3">
            {pasosVisibles.map((p) => (
              <div key={p.key} className="flex items-start gap-2.5">
                <PasoIcon estado={p.estado} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink leading-tight">{p.lbl}</div>
                  <div className="text-xs text-ink2 leading-snug mt-0.5">{p.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {esMesEnCurso && semaforo.cerrado && (
          <div className="bg-accent-soft px-5 py-2.5 flex items-center gap-2 border-t border-line">
            <CheckCircle2 size={16} className="text-done shrink-0" />
            <span className="text-sm font-semibold text-ink">Todo al día en el mes en curso</span>
          </div>
        )}

        {/* Alerta temprana (spec 28, J8): sólo aparece si al ritmo actual NO llega —
            silencio cuando va bien o cuando no hay ritmo medible, para no alarmar sin datos. */}
        {proyeccion && !proyeccion.alcanza && proyeccion.diasNecesarios !== null && (
          <div className="px-5 py-2.5 flex items-center gap-2 border-t border-line">
            <AlarmClock size={16} className="text-warn shrink-0" />
            <span className="text-sm font-semibold text-ink">
              Al ritmo de los últimos días, faltarían {proyeccion.diasNecesarios} día(s) más de los que quedan en el mes.
            </span>
          </div>
        )}

        {/* Mi cierre personal de este mes: es lo único que declara "terminé mi trabajo". */}
        {miCierre ? (
          <div className="bg-accent-soft px-5 py-3 flex flex-wrap items-center gap-3 border-t border-line">
            <Lock size={16} className="text-done shrink-0" />
            <span className="text-sm font-semibold text-ink">Cerraste este mes el {fechaCorta(miCierre.cerrado_at)}</span>
            <button onClick={toggleCierre} disabled={reabrirMes.isPending}
              className="ml-auto flex items-center gap-1.5 border border-line bg-surface rounded-lg px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50">
              <LockOpen size={14} /> {reabrirMes.isPending ? "Reabriendo…" : "Reabrir"}
            </button>
          </div>
        ) : (
          <div className="px-5 py-3 border-t border-line">
            {migracionPendiente ? (
              <button disabled className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-ink2 opacity-70">
                <Lock size={14} /> Se habilita tras la migración 29
              </button>
            ) : errorReal ? (
              <button disabled className="flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-ink2 opacity-70">
                <Lock size={14} /> No se pudieron cargar los cierres. Reintentá en un momento.
              </button>
            ) : confirmando ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-ink">
                  Vas a cerrar tu {mesLegible(mesNavegado)} {ym.year}. Podés reabrirlo si hace falta.
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setConfirmando(false)}
                    className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm font-semibold text-ink2">Cancelar</button>
                  <button onClick={toggleCierre} disabled={cerrarMes.isPending}
                    className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50">
                    <Lock size={14} /> {cerrarMes.isPending ? "Cerrando…" : "Confirmar cierre"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmando(true)}
                className="flex items-center gap-1.5 bg-accent text-[color:var(--accent-ink)] rounded-lg px-3.5 py-1.5 text-sm font-semibold">
                <Lock size={14} /> Cerrar mi mes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vista de jefe / encargado: quién cerró su mes y quién no. Pendientes primero. */}
      {esGestor && team.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-5" style={cardSh}>
          <div className="px-5 pt-4 pb-3 flex items-end justify-between gap-3">
            <h3 className="text-base font-bold tracking-[-0.01em]">Cierres del equipo</h3>
            <span className="text-sm text-ink2">
              <b className="text-ink tnum">{equipo.cerraron.length}</b> de <b className="text-ink tnum">{team.length}</b> cerraron ({equipo.pct}%)
            </span>
          </div>
          <div>
            {[...equipo.pendientes, ...equipo.cerraron].map((p) => {
              const fila = mesCerradoPor(periodos, p.id, mesNavegado);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-line">
                  <Avatar name={p.name} size={24} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">{p.name}</span>
                  {fila ? (
                    <span className="flex items-center gap-1.5 text-xs text-ink2 shrink-0">
                      <CheckCircle2 size={14} className="text-done" /> Cerró el {fechaCorta(fila.cerrado_at)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-ink2 shrink-0">
                      <Circle size={14} /> Sin cerrar
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closing.length === 0 ? (
        <EmptyState title={`No hay cierre generado para ${MESES[ym.month - 1]}.`}
          hint={template.length === 0
            ? "Definí primero la plantilla de cierre en Administración (las tareas que se repiten cada mes: IVA, sueldos, F931, conciliaciones)."
            : isJefe ? "Apretá “Generar cierre” y se crean todas las tareas del mes con responsable, vencimiento y esfuerzo."
            : "Todavía no lo generó un jefe. En cuanto esté, vas a ver acá el avance del cierre."} />
      ) : (
        <>
          {/* progreso (Kaizen: el avance se ve y se mide) */}
          <div className="bg-surface border border-line rounded-2xl p-5 mb-4" style={cardSh}>
            <div className="flex items-end justify-between mb-2">
              <div>
                <span className="text-sm text-ink2">Avance del cierre</span>
                <div className="text-4xl font-bold leading-none tnum tracking-[-0.02em] mt-1">{stats.pct}%</div>
              </div>
              <div className="text-right text-sm text-ink2">
                <div><b className="text-ink tnum">{stats.done}</b> de <b className="text-ink tnum">{stats.total}</b> tareas</div>
                {stats.onTimePct !== null && <div>Adherencia (en fecha): <b style={{ color: stats.onTimePct >= 85 ? "var(--done)" : stats.onTimePct >= 60 ? "var(--warn)" : "var(--danger)" }}>{stats.onTimePct}%</b></div>}
              </div>
            </div>
            <div className="h-2.5 bg-surface2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${stats.pct}%`, background: stats.overdue ? "var(--warn)" : "var(--done)" }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <StatChip label="Terminadas" value={stats.done} tone="done" />
            <StatChip label="En proceso" value={stats.proc} />
            <StatChip label="Pendientes" value={stats.pend} />
            <StatChip label="Vencidas" value={stats.overdue} tone={stats.overdue ? "danger" : undefined} />
          </div>

          <div className="bg-surface border border-line rounded-xl overflow-hidden" style={cardSh}>
            {orden.map((c, idx) => {
              const i = dueInfo(c);
              const late = c.status !== "term" && i && i.days < 0;
              const blocked = c.status !== "term" && isBlocked(c, cards, {});
              const Icon = c.status === "term" ? CheckCircle2 : c.status === "proc" ? Clock : Circle;
              return (
                // Botón real para que la fila se alcance con Tab y abra con Enter.
                // w-full/text-left conservan exactamente el ancho y la alineación del div.
                <button type="button" key={c.id} onClick={() => onOpenCard(c)}
                  className={`text-left w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface2 ${idx ? "border-t border-line" : ""}`}>
                  <Icon size={17} style={{ color: c.status === "term" ? "var(--done)" : "var(--ink2)" }} className="shrink-0" />
                  <span className={`flex-1 min-w-0 truncate ${c.status === "term" ? "line-through text-ink2" : "text-ink"} font-medium`}>{c.title}</span>
                  {blocked && <span className="flex items-center gap-1 text-warn text-2xs font-semibold shrink-0"><Link2 size={12} /> Bloqueada</span>}
                  {late && <span className="flex items-center gap-1 bg-danger-soft text-danger rounded-md px-2 py-0.5 text-2xs font-semibold shrink-0"><AlarmClock size={11} /> Venció {i!.lbl}</span>}
                  {!late && i && c.status !== "term" && <span className="text-ink2 text-xs tnum shrink-0">vence {i.lbl}</span>}
                  <span className="flex items-center gap-1.5 shrink-0 w-[130px] justify-end"><span className="text-ink2 text-xs truncate">{nom(c.owner)}</span><Avatar name={nom(c.owner)} size={22} /></span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
