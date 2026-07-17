import type { ArcaItem } from "../features/tablon/arca";

// Vencimientos ARCA como asistente contable (spec 24 item 2).
// Solo dejamos pasar categorías contables; el resto del feed oficial (combustibles,
// tabaco, seguros, etc.) es ruido para el estudio y se descarta.

// Keywords normalizadas (minúsculas, sin tildes). Se comparan como substring.
export const KEYWORDS_CONTABLES = [
  "iva",
  "empleadores",
  "seguridad social",
  "931",
  "autonomos",
  "monotributo",
  "casas particulares",
  "ganancias",
  "bienes personales",
  "sicore",
  "retenciones",
];

// minúsculas + sin tildes, para comparar de forma robusta.
const normalizar = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function esContable(it: ArcaItem): boolean {
  const texto = normalizar(`${it.titulo} ${it.sub}`);
  return KEYWORDS_CONTABLES.some((k) => texto.includes(k));
}

// Filtra el feed dejando solo las categorías contables. Defensivo ante lista vacía.
export function relevantes(items: ArcaItem[]): ArcaItem[] {
  return (items ?? []).filter(esContable);
}

const pad = (n: number) => String(n).padStart(2, "0");
const diasEnMes = (year: number, month1a12: number) => new Date(year, month1a12, 0).getDate();

export interface EventoVirtual { date: string; title: string; detail: string; }

// Mapea los items contables a eventos virtuales de solo-lectura del mes visible.
// `num` es el día del mes en el feed ARCA. Descarta días fuera del rango del mes.
export function aEventosVirtuales(items: ArcaItem[], year: number, month1a12: number): EventoVirtual[] {
  const max = diasEnMes(year, month1a12);
  return relevantes(items)
    .filter((it) => it.num >= 1 && it.num <= max)
    .map((it) => ({
      date: `${year}-${pad(month1a12)}-${pad(it.num)}`,
      title: it.titulo,
      detail: it.sub,
    }));
}
