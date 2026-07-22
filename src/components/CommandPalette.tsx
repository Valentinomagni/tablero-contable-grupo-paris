import { useDeferredValue, useEffect, useState } from "react";
import { LayoutDashboard, Pin, Settings, ClipboardList, Search, Users, Network, StickyNote } from "lucide-react";
import { Avatar } from "../lib/ui";
import { COLS, type Card, type Profile, type Announcement } from "../lib/types";
import { useBuscarCards } from "../hooks/useData";
import { combinarResultadosCards, idsDelServidor } from "../lib/buscador";
import { agruparItemsPalette } from "../lib/commandPalette";

// `servidor: true` marca los items que ya vinieron filtrados por el full-text de la base
// (RPC buscar_cards). Esos NO vuelven a pasar por el filtro de substring local: si lo
// hicieran, todo lo que aporta el full-text (stemming, multi-palabra y sobre todo los
// matches en la DESCRIPCIÓN, que no está ni en `t` ni en `sub`) se descartaría antes de
// renderizar y la búsqueda global no serviría para nada.
interface Item { g: string; t: string; sub?: string; icon?: React.ReactNode; av?: Profile; servidor?: boolean; run: () => void; }

export function CommandPalette({ me, team, cards, annos = [], onNavigate, onOpenCard, onClose, onDelegar }: {
  me: Profile; team: Profile[]; cards: Card[]; annos?: Announcement[];
  onNavigate: (v: string) => void; onOpenCard: (c: Card) => void; onClose: () => void; onDelegar?: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const isJefe = me.role === "jefe";

  // El tipeo no debe trabarse esperando al RPC ni al filtrado de la lista completa:
  // se difiere el valor usado para buscar (React 19 useDeferredValue), mientras el input
  // en sí sigue controlado por `q` sin retraso.
  const qDiferido = useDeferredValue(q);
  // Full-text sobre TODAS las cards visibles por RLS (no sólo las ya cargadas en memoria).
  // Fallback obligatorio: si la RPC no existe o falla, useBuscarCards resuelve con []
  // y acá seguimos con el filtro en memoria de siempre — la búsqueda nunca deja de andar.
  const { data: cardsServidor = [] } = useBuscarCards(qDiferido);
  // Se combinan sin duplicar por id; lo que ya estaba en memoria mantiene su orden para
  // que la lista no "salte" cuando llegan los resultados del servidor.
  const cardsCombinadas = combinarResultadosCards(cards, cardsServidor);
  const idsServidor = idsDelServidor(cardsServidor);

  const all: Item[] = [];
  if (isJefe) {
    all.push({ g: "Vistas", t: "Resumen del equipo", icon: <LayoutDashboard size={16} />, run: () => onNavigate("__resumen") });
    all.push({ g: "Vistas", t: "Reporte ejecutivo", icon: <LayoutDashboard size={16} />, run: () => onNavigate("__reporte") });
    all.push({ g: "Vistas", t: "Cierre mensual", icon: <LayoutDashboard size={16} />, run: () => onNavigate("__cierre") });
    all.push({ g: "Vistas", t: "Organigrama", icon: <Network size={16} />, run: () => onNavigate("__organigrama") });
    all.push({ g: "Vistas", t: "Administración", icon: <Settings size={16} />, run: () => onNavigate("__admin") });
  }
  // Delegar disponible para todos los roles (spec #4); el modal resuelve destinatarios según alcance.
  if (onDelegar) all.push({ g: "Acciones", t: "Delegar / compartir tarea…", icon: <Users size={16} />, run: () => onDelegar() });
  all.push({ g: "Vistas", t: "Tablón del equipo", icon: <Pin size={16} />, run: () => onNavigate("__tablon") });
  all.push({ g: "Vistas", t: "Anotaciones", icon: <StickyNote size={16} />, run: () => onNavigate("__notas") });
  all.push({ g: "Vistas", t: "Mi tablero", icon: <ClipboardList size={16} />, run: () => onNavigate(me.id) });
  all.push({ g: "Acciones", t: "Nueva anotación", icon: <StickyNote size={16} />, run: () => onNavigate("__notas") });
  // El alcance de personas lo define el scope con el que llega `team` (visiblesPara/personasVisibles
  // en App.tsx según el rol de `me`), no un gate acá: antes este `if (isJefe)` hacía que encargados
  // y empleados no vieran a NADIE en "Personas" (ni siquiera a otros encargados) al buscar.
  team.forEach((u) => all.push({ g: "Personas", t: u.name, sub: u.role, av: u, run: () => onNavigate(u.id) }));
  cardsCombinadas.forEach((c) => all.push({
    g: "Tareas", t: c.title,
    sub: `${team.find((u) => u.id === c.owner)?.name ?? ""} · ${c.card_type === "operativa" ? "operativa" : COLS.find((x) => x[0] === c.status)?.[1]}`,
    servidor: idsServidor.has(c.id),
    run: () => onOpenCard(c),
  }));
  // Búsqueda global: los avisos del tablón también son encontrables (Seiton)
  annos.filter((a) => !a.archivado).forEach((a) => all.push({
    g: "Tablón", t: a.title, sub: a.kind === "vencimiento" ? "vencimiento" : a.kind === "proceso" ? "proceso" : "aviso",
    icon: <Pin size={16} />, run: () => onNavigate("__tablon"),
  }));

  const needle = q.trim().toLowerCase();
  // `i.servidor` pasa de largo: esas cards ya las filtró el full-text de la base (ver
  // idsDelServidor en lib/buscador.ts). El filtro de substring sólo aplica a lo que se
  // arma acá en el cliente (vistas, acciones, personas, avisos y cards en memoria).
  const filtrados = all.filter((i) => !needle || i.servidor
    || i.t.toLowerCase().includes(needle) || (i.sub ?? "").toLowerCase().includes(needle));
  // Sin texto de búsqueda (recién abierto / navegando la lista) un slice(12) plano sobre
  // `all` deja afuera grupos enteros: como "Personas" se arma con team.forEach() en orden
  // alfabético de rol ("empleado" < "encargado" < "jefe"), los primeros ~10 lugares ya los
  // ocupan las Vistas/Acciones fijas y sólo entran los primeros empleados — los encargados
  // (y cualquiera más abajo en la lista) nunca aparecen aunque estén en `team`. Un cupo fijo
  // por grupo (incluso "5 por grupo") tiene el mismo problema en cuanto el equipo supera
  // ese número de empleados: sigue siendo posible que ningún encargado entre en el preview.
  // Por eso "Personas" NUNCA se capa acá (agruparItemsPalette la deja completa; la lista
  // ya tiene su propio scroll) — sumar gente al equipo no puede esconder a nadie. El resto
  // de los grupos sí mantiene un cupo razonable porque no crecen con el equipo. Al tipear,
  // el filtro de arriba ya angosta por coincidencia y el cupo por grupo deja de importar.
  const items = needle ? filtrados.slice(0, 12) : agruparItemsPalette(filtrados);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && items[sel]) { e.preventDefault(); onClose(); items[sel].run(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items, sel, onClose]);

  let lastG = "";
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center pt-[12vh] px-4 z-[70]">
      <div className="bg-surface border border-line rounded-[14px] w-full max-w-[560px] overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center gap-2 px-4 border-b border-line">
          <Search size={16} className="text-ink2" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Buscar tareas, personas, vistas…" className="w-full py-[15px] bg-transparent text-[15px] outline-none" />
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="text-ink2 text-sm px-3 py-4">Sin resultados</div>}
          {items.map((i, n) => {
            const head = i.g !== lastG ? <div key={"h" + n} className="text-[10.5px] uppercase tracking-wide text-ink2 px-3 pt-2 pb-1">{i.g}</div> : null;
            lastG = i.g;
            return (
              <div key={n}>
                {head}
                <div onClick={() => { onClose(); i.run(); }} onMouseEnter={() => setSel(n)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm ${n === sel ? "bg-accent-soft" : ""}`}>
                  {i.av ? <Avatar name={i.av.name} size={22} /> : <span className="text-ink2">{i.icon}</span>}
                  <span className={`flex-1 truncate ${n === sel ? "text-accent font-semibold" : ""}`}>{i.t}</span>
                  {i.sub && <span className="text-xs text-ink2 shrink-0 capitalize">{i.sub}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-line px-3.5 py-2 text-[11.5px] text-ink2 flex gap-3.5">
          <span>↑↓ navegar</span><span>Enter abrir</span><span>Esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
