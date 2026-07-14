import type { ActivityLog, Card, Snapshot } from "./types";
import { fmtDateTime } from "./metrics";

const isOper = (c: Card) => c.card_type === "operativa";

// el prefijo ' evita que Excel ejecute celdas que empiezan como fórmula (=, +, -, @)
export function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
}

export function buildCsv(cards: Card[], activity: ActivityLog[], nameOf: (id: string) => string): string {
  const est: Record<string, string> = { pend: "Pendiente", proc: "En proceso", term: "Terminado" };
  const filas = cards.map((c) => [
    nameOf(c.owner), c.title, isOper(c) ? "Operativa" : est[c.status],
    c.priority ?? "media", c.effort ?? 1,
    c.due_date ?? "", c.done_at ? fmtDateTime(c.done_at) : "",
    c.recurring ? "Sí" : "No",
    (c.checklist ?? []).filter((i) => i.done).length + "/" + (c.checklist ?? []).length,
    isOper(c) ? activity.filter((a) => a.card_id === c.id).reduce((s, a) => s + a.qty, 0) : "",
  ].map(csvCell).join(";"));
  return "﻿" + ["Persona;Tarea;Estado;Prioridad;Esfuerzo;Vence;Terminada el;Mensual;Checklist;Actividad 60d", ...filas].join("\r\n");
}

export function standupText(cards: Card[], activity: ActivityLog[], nameOf: (id: string) => string, blockedIds: Set<string>, now: number): string {
  const dia = now - 24 * 3600000;
  const hechas = cards.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= dia)
    .map((c) => `• ${c.title} — ${nameOf(c.owner)} (${fmtDateTime(c.done_at)})`);
  const regs = activity.filter((a) => new Date(a.at).getTime() >= dia)
    .map((a) => `• ${a.qty} u. de ${cards.find((c) => c.id === a.card_id)?.title ?? "operativa"} — ${a.who_name}${a.note ? ` (${a.note})` : ""}`);
  const bloq = cards.filter((c) => blockedIds.has(c.id)).map((c) => `• ${c.title} — ${nameOf(c.owner)}`);
  return `RESUMEN DIARIO — ${new Date(now).toLocaleDateString("es-AR")}\n\n` +
    `TERMINADAS (últimas 24 h):\n${hechas.join("\n") || "• (ninguna)"}\n\n` +
    `ACTIVIDAD OPERATIVA (últimas 24 h):\n${regs.join("\n") || "• (sin registros)"}\n\n` +
    `BLOQUEADAS HOY:\n${bloq.join("\n") || "• (ninguna)"}`;
}

// esfuerzo cerrado por día del mes, acumulado sobre todo el historial
export function cicloDelMes(cards: Card[]): { porDia: number[]; total: number; pctQ1: number; insight: string } {
  const porDia = Array(31).fill(0) as number[];
  cards.filter((c) => c.done_at && !isOper(c)).forEach((c) => {
    porDia[new Date(c.done_at!).getDate() - 1] += (c.effort ?? 1);
  });
  const total = porDia.reduce((a, b) => a + b, 0);
  const q1 = porDia.slice(0, 15).reduce((a, b) => a + b, 0);
  const pctQ1 = total ? Math.round((q1 / total) * 100) : 0;
  const insight = pctQ1 >= 60
    ? `La primera quincena concentra el ${pctQ1}% del esfuerzo cerrado (vencimientos y cierres). Del 20 en adelante baja la demanda: es el momento ideal para asignar correcciones, ajustes y tareas de fondo.`
    : pctQ1 <= 40
    ? `La segunda quincena concentra el ${100 - pctQ1}% del esfuerzo. La primera mitad del mes tiene capacidad libre para adelantar trabajo.`
    : `El trabajo está repartido en forma pareja a lo largo del mes (${pctQ1}% en la primera quincena).`;
  return { porDia, total, pctQ1, insight };
}

// evolución de la carga abierta del equipo: esfuerzo abierto por día (fotos diarias)
export function cargaPorFecha(snaps: Snapshot[]): { day: string; v: number }[] {
  const porFecha: Record<string, number> = {};
  snaps.forEach((s) => porFecha[s.day] = (porFecha[s.day] ?? 0) + s.open_effort);
  return Object.keys(porFecha).sort().map((day) => ({ day, v: porFecha[day] }));
}

// cerradas y esfuerzo por día, últimos 14 días
export function ultimos14(cards: Card[], now: number): { lbl: string; count: number; effort: number }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 86400000);
    const key = d.toDateString();
    const del = cards.filter((c) => c.done_at && !isOper(c) && new Date(c.done_at).toDateString() === key);
    return {
      lbl: d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      count: del.length,
      effort: del.reduce((s, c) => s + (c.effort ?? 1), 0),
    };
  });
}
