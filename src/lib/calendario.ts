import type { Announcement } from "./types";

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface DiaCal { date: string; dia: number; delMes: boolean; esHoy: boolean; }

const pad = (n: number) => String(n).padStart(2, "0");
export const claveFecha = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Grilla del mes: 6 semanas × 7 días (Lun→Dom), con relleno de meses vecinos. month1a12 = 1..12.
export function grillaMes(year: number, month1a12: number, hoyISO: string): DiaCal[] {
  const primero = new Date(year, month1a12 - 1, 1);
  const offsetLunes = (primero.getDay() + 6) % 7; // días desde el lunes anterior
  const inicio = new Date(year, month1a12 - 1, 1 - offsetLunes);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const date = claveFecha(d);
    return { date, dia: d.getDate(), delMes: d.getMonth() === month1a12 - 1, esHoy: date === hoyISO };
  });
}

// Agrupa avisos por su fecha (due_date). Ignora los que no tienen fecha.
export function eventosPorDia(anuncios: Announcement[]): Record<string, Announcement[]> {
  const m: Record<string, Announcement[]> = {};
  for (const a of anuncios) {
    if (!a.due_date) continue;
    (m[a.due_date] ??= []).push(a);
  }
  return m;
}

// Cuántos eventos tiene cada mes de un año (para la vista anual). Devuelve array de 12.
export function conteoPorMes(anuncios: Announcement[], year: number): number[] {
  const c = Array(12).fill(0) as number[];
  const pref = `${year}-`;
  for (const a of anuncios) {
    if (a.due_date && a.due_date.startsWith(pref)) {
      const mes = Number(a.due_date.slice(5, 7)) - 1;
      if (mes >= 0 && mes < 12) c[mes]++;
    }
  }
  return c;
}
