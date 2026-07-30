// Modo Director: las cinco señales del área en una sola pantalla.
//
// Esta vista NO calcula criterios propios: arma la EntradaDirector reutilizando las libs que
// ya existen y delega el "cuándo es rojo" en panelesDirector() (src/lib/director.ts), que está
// testeado. Los números tienen que coincidir con las pantallas de origen, por eso los criterios
// de `vencidas` y `bloqueadas` son copia literal de Reporte.tsx.
//
// COLOR: el punto del semáforo es el ÚNICO color de la pantalla. Acá el color comunica estado.
// ENCUADRE: los titulares hablan de tareas y del proceso, nunca de personas.
import type { Card, Profile, Announcement } from "../../lib/types";
import { dueInfo } from "../../lib/metrics";
import { diasHasta, proximosVencimientos } from "../../lib/vencimientos";
import { previsibilidad } from "../../lib/previsibilidad";
import { concentracion as concentracionPorCategoria } from "../../lib/busfactor";
import { useArchiveEquipo } from "../../hooks/useArchive";
import { useSnapshots } from "../../hooks/useData";
import { panelesDirector, type EntradaDirector, type Semaforo } from "../../lib/director";
import { icr } from "../../lib/icr";
import { exposicion } from "../../lib/exposicion";
import { saludOperativa } from "../../lib/salud-operativa";
import { flujoMensual } from "../../lib/flujo-mensual";
import { recomendaciones, type Prioridad } from "../../lib/recomendaciones";
import { Panel } from "../../components/Panel";

const COLOR: Record<Semaforo, string> = {
  ok: "var(--done)",
  atencion: "var(--warn)",
  riesgo: "var(--danger)",
};

// El punto de prioridad de una recomendación: rojo/ámbar son estado, gris es "sin urgencia".
const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: "var(--danger)",
  media: "var(--warn)",
  baja: "var(--ink2)",
};


export function Director({ cards, team, annos }: { cards: Card[]; team: Profile[]; annos: Announcement[] }) {
  const now = new Date();
  // Histórico del equipo para el bus factor. El hook ya es DEFENSIVO: sin la migración 22, o
  // ante cualquier error, devuelve [] — y entonces `concentracion()` no encuentra evidencia y
  // el panel queda en verde por ausencia de datos, no por un dato inventado.
  const { data: archives = [] } = useArchiveEquipo();
  const norm = cards.filter((c) => c.card_type !== "operativa");
  const abiertas = norm.filter((c) => c.status !== "term");

  // Mismo criterio que Reporte.tsx, para que los números coincidan entre pantallas.
  const vencidas = abiertas.filter((c) => { const i = dueInfo(c); return i && i.days < 0; }).length;
  const bloqueadas = abiertas.filter((c) => (c.deps ?? []).some((id) => {
    const d = cards.find((x) => x.id === id); return d && d.status !== "term";
  })).length;

  const prox = proximosVencimientos(annos ?? [], now, 30)[0];
  const venceEnDias = prox?.due_date ? diasHasta(prox.due_date, now) : null;

  // Bus factor: categorías donde una sola persona concentra el trabajo histórico.
  // `concentracion()` YA filtra por su cuenta (mínimo 4 cards de evidencia y ≥80% en una
  // persona), así que todo lo que devuelve ya es un riesgo: acá se cuenta y nada más. Volver a
  // filtrar sería duplicar el criterio en dos lugares y arriesgar que se desincronicen.
  // Se calculan UNA sola vez y se reusan. Antes se llamaba dos veces a cada una con los
  // mismos argumentos (una para el panel, otra para el motor de recomendaciones): las dos
  // recorren listas completas, así que era trabajo repetido además de ruido para leer.
  const mes = now.toISOString().slice(0, 7);
  const concentraciones = concentracionPorCategoria(archives, team);
  const prevision = previsibilidad(norm, mes);

  const concentracion = concentraciones.length;
  const pctPlanificado = prevision.pctPlanificado;

  const entrada: EntradaDirector = { vencidas, bloqueadas, venceEnDias, concentracion, pctPlanificado };
  const paneles = panelesDirector(entrada);

  // ---- Confianza del dato, exposición y recomendaciones ----
  const hoyISO = now.toISOString();
  const snaps = useSnapshots(true).data ?? [];
  const calidad = icr(norm, hoyISO);
  const exposiciones = exposicion(norm, hoyISO);
  const salud = saludOperativa(norm, hoyISO);
  // El motor recibe TODAS las señales juntas, incluida la calidad del dato: si el registro no
  // es representativo, se calla y sólo sugiere corregirlo (ver src/lib/recomendaciones.ts).
  const sugerencias = recomendaciones({
    icr: calidad,
    exposiciones,
    salud,
    concentraciones,
    previsibilidad: prevision,
    flujo: flujoMensual(snaps, mes),
    nombrePorId: Object.fromEntries(team.map((u) => [u.id, u.name])),
  });

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <p className="text-sm text-ink2 mb-4 mt-0">
        El estado del área en una pantalla. Cada panel resume una señal que ya se calcula en el
        sistema; el punto indica si conviene entrar a mirarla.
      </p>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {paneles.map((p) => (
          <Panel key={p.area} className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLOR[p.semaforo] }} />
              <span className="text-2xs text-ink2 uppercase tracking-[0.08em] font-semibold">{p.area}</span>
            </div>
            <b className="block text-xl leading-tight tracking-[-0.01em] mb-1.5">{p.titular}</b>
            <span className="block text-xs text-ink2">{p.detalle}</span>
          </Panel>
        ))}
      </div>

      {/* ---- Recomendaciones: lo primero accionable, por eso va arriba de todo lo demás ---- */}
      <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mt-7 mb-2.5">Qué conviene hacer</h2>
      <Panel className="px-5 py-4">
        {sugerencias.length === 0 ? (
          <span className="text-sm text-ink2">Sin recomendaciones: no se detectaron situaciones que requieran acción.</span>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
            {sugerencias.map((s) => (
              <li key={s.id} className="flex gap-2.5 items-start">
                <span aria-hidden className="w-2 h-2 rounded-full shrink-0 mt-[6px]"
                  style={{ background: COLOR_PRIORIDAD[s.prioridad] }} />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug">{s.texto}</span>
                  <span className="block text-xs text-ink2 mt-0.5">{s.motivo}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 mt-7 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        {/* ---- Si nadie hace nada ---- */}
        <div>
          <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Si nadie hace nada</h2>
          <Panel className="px-5 py-4">
            <div className="flex flex-col gap-3">
              {exposiciones.map((e) => (
                <div key={e.horizonte} className="flex items-baseline gap-3">
                  <span className="text-xs text-ink2 w-[86px] shrink-0">{e.titulo}</span>
                  <b className="text-lg tnum tracking-[-0.01em] w-[34px] shrink-0">{e.total}</b>
                  <span className="text-xs text-ink2 min-w-0 truncate">
                    {e.porCategoria.length === 0
                      ? "sin vencimientos"
                      : e.porCategoria.slice(0, 3).map((c) => `${c.categoria} (${c.n})`).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink2 mt-3 mb-0">Tareas abiertas que vencen dentro de cada plazo, incluidas las ya vencidas.</p>
          </Panel>
        </div>

        {/* ---- Confianza del dato (ICR) ---- */}
        <div>
          <h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Confianza del dato</h2>
          <Panel className="px-5 py-4">
            {calidad.suficiente ? (
              <>
                <b className="block text-3xl tnum tracking-[-0.02em] leading-none">{calidad.puntaje}<span className="text-base text-ink2 font-normal">/100</span></b>
                <span className="block text-xs text-ink2 mt-1">Sobre {calidad.muestra} tareas cerradas en 30 días.</span>
              </>
            ) : (
              <>
                <b className="block text-lg tracking-[-0.01em]">Muestra insuficiente</b>
                <span className="block text-xs text-ink2 mt-1">Sólo {calidad.muestra} tareas cerradas en 30 días: hacen falta más para poder medir.</span>
              </>
            )}
            {/* La regla de lectura va SIEMPRE visible, no escondida en un tooltip: es lo que
                evita que este número se lea como una nota de desempeño. */}
            <p className="text-xs text-ink2 mt-3 mb-0 pt-3 border-t border-line">{calidad.lectura}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
