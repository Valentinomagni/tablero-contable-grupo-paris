import type { Announcement, Card, Vacacion, Profile } from "./types";
import { estaDeVacaciones } from "./vacaciones";
import { esVisible } from "./visibilidad";

// Radar predictivo de vencimientos fiscales (spec 28, Fase B, J3): para cada aviso de tipo
// "vencimiento" dentro del horizonte, evalúa si hay riesgo de incumplirlo. Es una anticipación,
// no una sanción: el motivo describe la situación, nunca juzga a la persona responsable.

export type RiesgoVto = "ok" | "atencion" | "riesgo";

export interface RadarItem {
  aviso: Announcement;
  riesgo: RiesgoVto;
  motivo: string;
  responsable: Profile | null;
}

// Heurística de "card que apunta al vencimiento": no existe un vínculo formal entre un aviso
// y una card en el esquema actual, así que se aproxima por convención: una card abierta del
// mismo responsable cuyo due_date coincide exactamente con el due_date del aviso. Es una
// aproximación disponible sin migrar el esquema, no una relación garantizada.
function cardQueApunta(aviso: Announcement, cards: Card[]): Card | null {
  if (!aviso.owner_id || !aviso.due_date) return null;
  return cards.find((c) =>
    c.status !== "term" && c.owner === aviso.owner_id && c.due_date === aviso.due_date) ?? null;
}

function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function radarVencimientos(input: {
  avisos: Announcement[]; cards: Card[]; vacaciones: Vacacion[]; profiles: Profile[];
  hoyISO: string; diasHorizonte?: number;
}): RadarItem[] {
  const { avisos, cards, vacaciones, profiles, hoyISO, diasHorizonte = 30 } = input;
  const hoy = new Date(hoyISO + "T00:00:00");
  const items: RadarItem[] = [];

  for (const aviso of avisos) {
    if (aviso.kind !== "vencimiento" || aviso.archivado || !aviso.due_date) continue;
    const dueDate = new Date(aviso.due_date + "T00:00:00");
    const dias = Math.round((dueDate.getTime() - hoy.getTime()) / 86400000);
    if (dias < 0 || dias > diasHorizonte) continue;

    // Alcance del radar: solo avisos de personas visibles para quien mira. Si el aviso tiene
    // responsable pero ese perfil no está en la lista visible (usuario oculto, o alguien de
    // otra área fuera del alcance del encargado), el aviso no es asunto de esta pantalla:
    // se descarta en vez de quedar como "Riesgo" sin nombre para siempre.
    const responsable = aviso.owner_id ? profiles.find((p) => p.id === aviso.owner_id) ?? null : null;
    if (aviso.owner_id && !(responsable && esVisible(responsable))) continue;

    if (!aviso.owner_id) {
      items.push({ aviso, riesgo: "riesgo", motivo: "Sin responsable asignado", responsable: null });
      continue;
    }

    const deLicencia = estaDeVacaciones(vacaciones, aviso.owner_id, aviso.due_date);
    if (deLicencia) {
      items.push({ aviso, riesgo: "riesgo", motivo: `El responsable está de licencia el ${fmt(aviso.due_date)}`, responsable });
      continue;
    }

    const card = cardQueApunta(aviso, cards);
    if (!card) {
      // "atencion", no "riesgo": el vínculo aviso↔card es una heurística (misma fecha y dueño),
      // así que no encontrarla es la señal MÁS DÉBIL del radar. "riesgo" queda reservado para
      // las señales verificables (sin responsable asignado, responsable de licencia).
      items.push({ aviso, riesgo: "atencion", motivo: "No encontramos una tarea vinculada", responsable });
      continue;
    }

    if (card.status === "pend" && dias <= 3) {
      items.push({ aviso, riesgo: "atencion", motivo: `Tarea todavía pendiente, faltan ${dias} día(s)`, responsable });
      continue;
    }

    items.push({ aviso, riesgo: "ok", motivo: "En curso", responsable });
  }

  const ORDEN: Record<RiesgoVto, number> = { riesgo: 0, atencion: 1, ok: 2 };
  return items.sort((a, b) => {
    const porSeveridad = ORDEN[a.riesgo] - ORDEN[b.riesgo];
    if (porSeveridad !== 0) return porSeveridad;
    return (a.aviso.due_date ?? "").localeCompare(b.aviso.due_date ?? "");
  });
}
