import { Network } from "lucide-react";
import type { Card, Profile } from "../../lib/types";
import { construirArbol, porMarca, type NodoOrg } from "../../lib/jerarquia";
import { Avatar } from "../../lib/ui";

const cardSh = { boxShadow: "var(--ring-sh),var(--shadow)" };
const ROLE_LBL: Record<Profile["role"], string> = { jefe: "Jefe", encargado: "Encargado", empleado: "Empleado" };

function Nodo({ nodo, cards, nivel }: { nodo: NodoOrg; cards: Card[]; nivel: number }) {
  const { profile: p, hijos } = nodo;
  const abiertas = cards.filter((c) => c.owner === p.id && c.status !== "term" && c.card_type !== "operativa").length;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-3.5 py-2.5" style={cardSh}>
        <Avatar name={p.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <b className="text-[14px] tracking-[-0.01em] truncate">{p.name}</b>
            <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-ink2 bg-surface2 border border-line rounded-md px-1.5 py-px shrink-0">{ROLE_LBL[p.role]}</span>
          </div>
          {p.puesto && <div className="text-[12px] text-ink2 truncate">{p.puesto}</div>}
        </div>
        <span className="shrink-0 text-[12px] text-ink2 tnum bg-surface2 border border-line rounded-full px-2.5 py-1" title="Tareas abiertas">
          <b className="text-ink">{abiertas}</b> abiertas
        </span>
      </div>
      {hijos.length > 0 && (
        <div className="mt-2 ml-5 pl-4 border-l border-line flex flex-col gap-2">
          {hijos.map((h) => <Nodo key={h.profile.id} nodo={h} cards={cards} nivel={nivel + 1} />)}
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, gente, cards }: { titulo: string; gente: Profile[]; cards: Card[] }) {
  const arbol = construirArbol(gente);
  return (
    <section className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">{titulo}</h2>
        <span className="text-[12px] text-ink2 tnum">{gente.length} {gente.length === 1 ? "persona" : "personas"}</span>
      </div>
      <div className="flex flex-col gap-2">
        {arbol.map((n) => <Nodo key={n.profile.id} nodo={n} cards={cards} nivel={0} />)}
      </div>
    </section>
  );
}

export function Organigrama({ team, cards }: { team: Profile[]; cards: Card[] }) {
  const grupos = porMarca(team);
  // Orden de marcas de la empresa; las demás quedan detrás alfabéticamente.
  const ORDEN = ["Peugeot", "Citroën", "Chevrolet", "Honda"];
  const marcas = Object.keys(grupos).sort((a, b) => {
    const ia = ORDEN.indexOf(a), ib = ORDEN.indexOf(b);
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

  return (
    <div className="px-6 py-4 w-full max-w-[820px]">
      {marcas.length === 0 && sinMarca.length === team.length && (
        <div className="bg-surface2 border border-line rounded-xl px-4 py-3 mb-5 text-[13px] text-ink2">
          Sin marca asignada todavía. Cuando cargues marca y responsable de cada persona, el organigrama se arma por marca y jerarquía automáticamente.
        </div>
      )}
      {marcas.map((m) => <Seccion key={m} titulo={m} gente={grupos[m]} cards={cards} />)}
      {sinMarca.length > 0 && <Seccion titulo="Sin marca" gente={sinMarca} cards={cards} />}
    </div>
  );
}
