import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Link2, Activity, PencilLine, RotateCcw, MoveRight } from "lucide-react";
import type { ActivityLog, Card, Profile } from "../../lib/types";
import { construirBitacora, agruparPorDia, type Evento } from "../../lib/bitacora";
import { Avatar } from "../../lib/ui";

function iconoDe(e: Evento) {
  if (e.tipo === "operativa") return <Activity size={13} />;
  const t = e.texto.toLowerCase();
  if (t.includes("terminada") || t.includes("completó")) return <CheckCircle2 size={13} />;
  if (t.includes("reabrió")) return <RotateCcw size={13} />;
  if (t.includes("creó")) return <Plus size={13} />;
  if (t.includes("dependencia") || t.includes("vinculó")) return <Link2 size={13} />;
  if (t.includes("movió") || t.includes("proceso") || t.includes("planificó")) return <MoveRight size={13} />;
  return <PencilLine size={13} />;
}
const colorDe = (e: Evento) =>
  e.texto.toLowerCase().includes("terminada") ? "text-done bg-done/10" : "text-accent bg-accent-soft";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
function etiquetaDia(dia: string): string {
  const hoy = new Date(); const ayer = new Date(hoy.getTime() - 86400000);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (dia === key(hoy)) return "Hoy";
  if (dia === key(ayer)) return "Ayer";
  return new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export function Bitacora({ cards, activity, team, isJefe, meId, onOpenCard }: {
  cards: Card[]; activity: ActivityLog[]; team: Profile[]; isJefe: boolean; meId: string;
  onOpenCard: (c: Card) => void;
}) {
  const [filtro, setFiltro] = useState<string>(""); // "" = todo el equipo (solo jefe)
  const nombreDe = (id: string) => team.find((u) => u.id === id)?.name ?? "?";
  const objetivo = isJefe ? (filtro || null) : meId;

  const grupos = useMemo(() => {
    const ev = construirBitacora(cards, activity, objetivo, nombreDe).slice(0, 300);
    return agruparPorDia(ev);
    // nombreDe depende de team; incluirlo evita autores "?" si el equipo carga después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, activity, objetivo, team]);

  const total = grupos.reduce((s, g) => s + g.eventos.length, 0);

  return (
    <div className="px-6 py-4 w-full max-w-[820px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-ink2 text-[13px] m-0">
          {isJefe ? "Todo lo que hizo el equipo, del más reciente al más viejo." : "Tu actividad, del más reciente al más viejo."}
          {" "}<span className="tnum">{total}</span> movimientos.
        </p>
        {isJefe && (
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
            className="ml-auto bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-[13px]">
            <option value="">Todo el equipo</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {total === 0 && <p className="text-ink2 text-sm">Todavía no hay actividad registrada.</p>}

      {grupos.map((g) => (
        <div key={g.dia} className="mb-5">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-ink2 font-semibold mb-2 capitalize">{etiquetaDia(g.dia)}</h2>
          <div className="border-l-2 border-line ml-[13px]">
            {g.eventos.map((e, i) => {
              const card = e.cardId ? cards.find((c) => c.id === e.cardId) ?? null : null;
              return (
                <div key={i} className="relative pl-5 pb-3 last:pb-0">
                  <span className={`absolute -left-[13px] top-0 grid place-items-center w-6 h-6 rounded-full ${colorDe(e)}`}>{iconoDe(e)}</span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {isJefe && filtro === "" && <span className="inline-flex items-center gap-1"><Avatar name={e.quien} size={16} /><b className="text-[13px]">{e.quien}</b></span>}
                    <span className="text-sm">{e.texto}</span>
                    {e.cardTitulo && (
                      card
                        ? <button onClick={() => onOpenCard(card)} className="text-accent text-sm font-medium hover:underline">{e.cardTitulo}</button>
                        : <span className="text-ink2 text-sm">{e.cardTitulo}</span>
                    )}
                    <span className="text-ink2 text-xs tnum ml-auto">{hora(e.at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Bitacora;
