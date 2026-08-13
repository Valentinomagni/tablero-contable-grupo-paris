import type { Card, Profile } from "./types";
import { diasHabilesTranscurridos } from "./dias-habiles";
import { toARTDate } from "./metrics";
import { dueInfo } from "./metrics";
import { esSinAsignar } from "./jerarquia";

// P7 — señales de riesgo para el gestor, mostradas en el Resumen.
// Umbrales conservadores (anti-ruido): solo se dispara con evidencia clara.
export interface Alerta { sev: "alta" | "media"; titulo: string; detalle: string }

const MIN_VENCIDAS = 3;      // ≥3 tareas vencidas por persona
const DIAS_SIN_MOVER = 5;    // prioridad alta quieta ≥5 días

// última señal de movimiento: última entrada de history (por `at`) o created_at.
function ultimoMovimientoMs(c: Card): number {
  const hist = c.history ?? [];
  const last = hist.length ? hist[hist.length - 1].at : null;
  return new Date(last ?? c.created_at).getTime();
}

export function alertasDeRiesgo(
  cards: Card[], team: Profile[], hoyMs: number,
  // Mismo parámetro y mismo default que `estancadas.ts`: las dos tienen que dar el mismo número
  // sobre la misma tarea, o el jefe y el empleado ven cosas distintas.
  noLaborables: Set<string> = new Set(),
): Alerta[] {
  // solo cards no operativas y no terminadas
  const norm = cards.filter((c) => c.card_type !== "operativa" && c.status !== "term");
  const alertas: Alerta[] = [];

  // 1) Persona del team con ≥3 tareas vencidas → alta
  for (const u of team) {
    if (esSinAsignar(u)) continue;
    const vencidas = norm.filter((c) => c.owner === u.id && (dueInfo(c)?.days ?? 0) < 0).length;
    if (vencidas >= MIN_VENCIDAS) {
      alertas.push({ sev: "alta", titulo: `${u.name}: ${vencidas} tareas vencidas`, detalle: "Revisar carga y prioridades." });
    }
  }

  // 2) Tareas sin responsable (owner centinela o fuera del team) → alta
  const idsTeam = new Set(team.filter((u) => !esSinAsignar(u)).map((u) => u.id));
  const centinela = team.filter(esSinAsignar).map((u) => u.id);
  const sinResp = norm.filter((c) => centinela.includes(c.owner) || !idsTeam.has(c.owner)).length;
  if (sinResp > 0) {
    alertas.push({ sev: "alta", titulo: `${sinResp} tareas sin responsable — reasignar`, detalle: "Hay trabajo sin dueño asignado." });
  }

  // 3) Prioridad alta sin movimiento ≥5 días → media
  for (const c of norm) {
    if (c.priority !== "alta") continue;
    // Días de trabajo, igual que en `estancadas.ts`. Si acá se contaran corridos y allá
    // hábiles, la misma tarea se vería quieta hace 5 días para el jefe y hace 3 para quien la
    // tiene — que es exactamente lo que el comentario de estancadas.ts advierte que no puede pasar.
    const ultima = ultimoMovimientoMs(c);
    if (!Number.isFinite(ultima)) continue;
    const dias = diasHabilesTranscurridos(toARTDate(new Date(ultima).toISOString()), toARTDate(new Date(hoyMs).toISOString()), noLaborables);
    if (dias >= DIAS_SIN_MOVER) {
      alertas.push({ sev: "media", titulo: `${c.title}: alta prioridad sin novedades hace ${dias} días`, detalle: "Sin movimiento reciente." });
    }
  }

  // alta primero; máximo 8
  const orden = { alta: 0, media: 1 };
  return alertas.sort((a, b) => orden[a.sev] - orden[b.sev]).slice(0, 8);
}
