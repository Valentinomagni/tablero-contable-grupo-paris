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
import { panelesDirector, type EntradaDirector, type Semaforo } from "../../lib/director";

const COLOR: Record<Semaforo, string> = {
  ok: "var(--done)",
  atencion: "var(--warn)",
  riesgo: "var(--danger)",
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
  const concentracion = concentracionPorCategoria(archives, team).length;

  const mes = now.toISOString().slice(0, 7);
  const pctPlanificado = previsibilidad(norm, mes).pctPlanificado;

  const entrada: EntradaDirector = { vencidas, bloqueadas, venceEnDias, concentracion, pctPlanificado };
  const paneles = panelesDirector(entrada);

  return (
    <div className="px-6 py-4 w-full max-w-[960px]">
      <p className="text-[13px] text-ink2 mb-4 mt-0">
        El estado del área en una pantalla. Cada panel resume una señal que ya se calcula en el
        sistema; el punto indica si conviene entrar a mirarla.
      </p>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {paneles.map((p) => (
          <div key={p.area} className="bg-surface border border-line rounded-2xl px-5 py-4"
            style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLOR[p.semaforo] }} />
              <span className="text-[11px] text-ink2 uppercase tracking-[0.08em] font-semibold">{p.area}</span>
            </div>
            <b className="block text-[18px] leading-tight tracking-[-0.01em] mb-1.5">{p.titular}</b>
            <span className="block text-[12.5px] text-ink2">{p.detalle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
