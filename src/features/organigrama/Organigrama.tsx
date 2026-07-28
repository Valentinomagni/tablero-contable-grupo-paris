import { useState } from "react";
import { Network, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Card, CardArchive, Profile } from "../../lib/types";
import { arbolConAncestros, porMarca, type NodoOrg } from "../../lib/jerarquia";
import { Avatar } from "../../lib/ui";
import { useOrganizacion } from "../../hooks/useData";
import { useArchiveEquipo } from "../../hooks/useArchive";
import { MarcaIcon } from "../../components/MarcaIcon";
import { enLinea, textoUltimaConexion } from "../../lib/presencia";
import { curvaPersona, tendencia, type PuntoCurva } from "../../lib/evolucion";
import { estabilidad } from "../../lib/estabilidad";

const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };
const ROLE_LBL: Record<Profile["role"], string> = { jefe: "Jefe", encargado: "Encargado", empleado: "Empleado" };

// Sparkline monocromo: barras chicas por mes, sin librería nueva. Es un acompañamiento
// para detectar quién necesita apoyo, no una nota — por eso escala de grises, sin semáforo.
function Sparkline({ curva }: { curva: PuntoCurva[] }) {
  const w = 8, gap = 2, h = 20;
  return (
    <svg width={curva.length * (w + gap)} height={h} className="shrink-0" aria-hidden>
      {curva.map((p, i) => {
        const barH = Math.max(2, Math.round((p.cumplimiento / 100) * h));
        return (
          <rect key={p.mes} x={i * (w + gap)} y={h - barH} width={w} height={barH} rx={1}
            className="fill-ink2" opacity={0.35 + (i / Math.max(1, curva.length - 1)) * 0.65} />
        );
      })}
    </svg>
  );
}

const TENDENCIA_ICON = { sube: TrendingUp, baja: TrendingDown, estable: Minus };
// El sujeto de la etiqueta es el DATO (la curva), nunca la persona: "Viene bajando"
// describe la serie; "Necesita apoyo" era un juicio sobre quien está al lado del avatar.
const TENDENCIA_LBL = { sube: "Viene subiendo", baja: "Viene bajando", estable: "Estable" };

// Curva de evolución (spec 28, Fase C, Task 6): acompaña, no califica. Por eso las tres
// tendencias van en el MISMO gris (text-ink2), sin color de alerta: pintar la baja en
// `warn` la convertía en un señalamiento sobre la persona, visible junto a su nombre y su
// avatar. La interpretación (qué hacer con una curva que baja) queda en el tooltip.
function Evolucion({ ownerId, archives }: { ownerId: string; archives: CardArchive[] }) {
  const curva = curvaPersona(archives, ownerId, 6);
  if (curva.length < 2) return null;
  const t = tendencia(curva);
  const Icon = TENDENCIA_ICON[t];
  // Estabilidad sobre la MISMA serie que la curva: la tendencia dice hacia dónde va, esto
  // dice qué tan parejo es el camino. 95-94-96 y 100-30-98 tienen tendencia parecida y
  // significan cosas muy distintas. Con menos de 3 meses la lib devuelve "sin-datos" y no
  // se muestra nada — no hace falta manejar ese caso acá.
  const est = estabilidad(curva.map((p) => p.cumplimiento));
  return (
    <div className="flex items-center gap-2 shrink-0" title="Cumplimiento de los últimos meses. Es un dato para acompañar y ver si hace falta apoyo o redistribuir carga, no una calificación de la persona.">
      <Sparkline curva={curva} />
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1 text-[11px] text-ink2">
          <Icon size={13} />
          {TENDENCIA_LBL[t]}
        </span>
        {est.nivel !== "sin-datos" && (
          <span className="text-[10.5px] text-ink2">{est.texto}</span>
        )}
      </span>
    </div>
  );
}

function Nodo({ nodo, cards, nivel, archives }: { nodo: NodoOrg; cards: Card[]; nivel: number; archives: CardArchive[] }) {
  const { profile: p, hijos } = nodo;
  const abiertas = cards.filter((c) => c.owner === p.id && c.status !== "term" && c.card_type !== "operativa").length;
  const ahora = new Date().toISOString();
  const online = enLinea(p.last_seen, ahora);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-3.5 py-2.5" style={cardSh}>
        <Avatar name={p.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <b className="text-[14px] tracking-[-0.01em] truncate">{p.name}</b>
            <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-ink2 bg-surface2 border border-line rounded-md px-1.5 py-px shrink-0">{ROLE_LBL[p.role]}</span>
            {p.marca && (
              <span className="flex items-center gap-1 text-[10.5px] text-ink2 bg-chip rounded px-1.5 py-0.5 shrink-0">
                <MarcaIcon marca={p.marca} size={11} />
                {p.marca}
              </span>
            )}
            {p.sucursal && <span className="text-[10.5px] text-ink2 bg-chip rounded px-1.5 py-0.5">{p.sucursal}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {p.puesto && <div className="text-[12px] text-ink2 truncate">{p.puesto}</div>}
            <span className="flex items-center gap-1 text-[11px] text-ink2 shrink-0">
              {online && <span className="w-2 h-2 rounded-full bg-done" />}
              {textoUltimaConexion(p.last_seen, ahora)}
            </span>
          </div>
        </div>
        {archives.length > 0 && <Evolucion ownerId={p.id} archives={archives} />}
        <span className="shrink-0 text-[12px] text-ink2 tnum bg-surface2 border border-line rounded-full px-2.5 py-1" title="Tareas abiertas">
          <b className="text-ink">{abiertas}</b> abiertas
        </span>
      </div>
      {hijos.length > 0 && (
        <div className="mt-2 ml-5 pl-4 border-l border-line flex flex-col gap-2">
          {hijos.map((h) => <Nodo key={h.profile.id} nodo={h} cards={cards} nivel={nivel + 1} archives={archives} />)}
        </div>
      )}
    </div>
  );
}

export function Organigrama({ team, cards }: { team: Profile[]; cards: Card[] }) {
  const org = useOrganizacion();
  // OJO — `team` NO viene acotado por rol: App.tsx pasa personasVisibles(fullTeam), o sea
  // el equipo completo. Lo único que hoy evita que un empleado vea la curva de sus pares es
  // que el Organigrama no está en su navegación, más la RLS de cards_archive, que limita la
  // data cruda que llega. Si alguna vez se abre esta vista a más roles, hay que filtrar el
  // `team` acá explícitamente — no hay ninguna protección implícita en este componente.
  const archives = useArchiveEquipo().data ?? [];
  const [filtroMarca, setFiltroMarca] = useState<string | null>(null);

  const grupos = porMarca(team);
  // Orden fijo de marcas (General primero) para el selector; las demás detrás, alfabéticamente.
  const marcas = Object.keys(grupos).sort((a, b) => {
    const ia = org.marcas.indexOf(a), ib = org.marcas.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  const sinMarca = team.filter((p) => !p.marca);

  if (team.length === 0) {
    return (
      <div className="px-6 py-4 w-full max-w-[820px]">
        <div className="bg-surface border border-line rounded-2xl p-8 text-center" style={cardSh}>
          <Network size={22} className="mx-auto text-ink2 mb-2" />
          <p className="text-ink font-semibold m-0">No hay personas para mostrar.</p>
        </div>
      </div>
    );
  }

  // UN SOLO árbol jerárquico (spec 28 Fase D): antes se partía por marca y se armaba un
  // árbol por cada grupo, lo que cortaba la cadena de mando apenas el manager quedaba en
  // otra marca (ver comentario en jerarquia.ts / arbolConAncestros). Ahora la marca es una
  // ETIQUETA por nodo (chip en Nodo), nunca una partición: el filtro de abajo sólo decide
  // qué hojas mostrar, arrastrando siempre la cadena completa de superiores.
  const arbol = arbolConAncestros(team, filtroMarca);

  return (
    <div className="px-6 py-4 w-full max-w-[820px]">
      {marcas.length === 0 && sinMarca.length === team.length && (
        <div className="bg-surface2 border border-line rounded-xl px-4 py-3 mb-5 text-[13px] text-ink2">
          Sin marca asignada todavía. Cuando cargues marca y responsable de cada persona, el organigrama se arma por marca y jerarquía automáticamente.
        </div>
      )}
      {marcas.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <label htmlFor="organigrama-filtro-marca" className="text-[12px] font-semibold text-ink2">Marca</label>
          <select
            id="organigrama-filtro-marca"
            value={filtroMarca ?? ""}
            onChange={(e) => setFiltroMarca(e.target.value || null)}
            className="text-[13px] bg-surface border border-line rounded-lg px-2.5 py-1.5"
          >
            <option value="">Todas las marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m} · {grupos[m].length}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {arbol.map((n) => <Nodo key={n.profile.id} nodo={n} cards={cards} nivel={0} archives={archives} />)}
      </div>
    </div>
  );
}

export default Organigrama;
