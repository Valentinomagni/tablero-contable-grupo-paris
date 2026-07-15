import type { ActivityLog, Card } from "./types";

// Bitácora = línea de tiempo unificada de todo lo que pasó, armada desde datos que ya existen:
// - cards.history (cada acción sobre una tarea: creó, movió, terminó, vinculó, anotó…)
// - activity_log (registros de tareas operativas)
// Sirve para autocontrol (el empleado ve su propia actividad) y control (el jefe ve la del equipo).
export interface Evento {
  at: string;              // ISO timestamp
  quien: string;           // nombre de quien hizo la acción
  ownerId: string;         // dueño de la tarea (para filtrar por persona)
  texto: string;
  cardId: string | null;
  cardTitulo: string | null;
  tipo: "tarea" | "operativa";
}

// filtroOwner: id de persona para ver solo su actividad, o null para todo el equipo.
export function construirBitacora(
  cards: Card[], activity: ActivityLog[], filtroOwner: string | null, nombreDe: (id: string) => string,
): Evento[] {
  const pasaFiltro = (ownerId: string) => filtroOwner === null || ownerId === filtroOwner;
  const eventos: Evento[] = [];

  for (const c of cards) {
    if (!pasaFiltro(c.owner)) continue;
    for (const h of c.history ?? []) {
      eventos.push({
        at: h.at,
        quien: h.who && h.who !== "—" ? h.who : nombreDe(c.owner),
        ownerId: c.owner,
        texto: h.txt,
        cardId: c.id,
        cardTitulo: c.title,
        tipo: "tarea",
      });
    }
  }

  const tituloDe = (cardId: string) => cards.find((c) => c.id === cardId)?.title ?? null;
  for (const a of activity) {
    if (!pasaFiltro(a.owner)) continue;
    eventos.push({
      at: a.at,
      quien: a.who_name || nombreDe(a.owner),
      ownerId: a.owner,
      texto: `Registró ${a.qty} u.${a.note ? " · " + a.note : ""}`,
      cardId: a.card_id,
      cardTitulo: tituloDe(a.card_id),
      tipo: "operativa",
    });
  }

  return eventos.sort((x, y) => y.at.localeCompare(x.at));
}

// agrupa los eventos por día calendario (clave YYYY-MM-DD), preservando el orden desc.
export function agruparPorDia(eventos: Evento[]): { dia: string; eventos: Evento[] }[] {
  const grupos: { dia: string; eventos: Evento[] }[] = [];
  for (const e of eventos) {
    const dia = e.at.slice(0, 10);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.eventos.push(e);
    else grupos.push({ dia, eventos: [e] });
  }
  return grupos;
}
