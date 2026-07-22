import type { ArcaItem } from "../features/tablon/arca";

// Vencimientos ARCA como asistente contable (spec 24 item 2; simplificado spec 28D item 7).
// El estudio solo necesita IVA y Libro IVA Digital: el resto del feed oficial (autónomos,
// monotributo, ganancias, bienes personales, combustibles, tabaco, seguros, etc.) es
// información repetida o irrelevante para las tres superficies (Login, Calendario, Tablón)
// y se descarta.
//
// NOTA: "información repetida" (mismo vencimiento en Login, Calendario, Tablón) NO es
// duplicación a eliminar. Cada superficie tiene propósito distinto: aviso al entrar,
// vista por día, agenda del mes. Son tres flujos de usuario independientes.

// Keyword normalizada (minúscula, sin tildes) que identifica IVA y Libro IVA Digital: ambos
// títulos oficiales contienen "iva" como palabra, y es el único rubro que el estudio sigue acá.
export const KEYWORDS_CONTABLES = ["iva"];

// minúsculas + sin tildes, para comparar de forma robusta.
const normalizar = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function esContable(it: ArcaItem): boolean {
  const texto = normalizar(`${it.titulo} ${it.sub}`);

  // Incluir si menciona IVA como palabra.
  if (!/\biva\b/.test(texto)) return false;

  // EXCLUIR si es una obligación de retención o percepción (regímenes de agente de retención/percepción).
  // Estos son rubros distintos aunque mencionen "IVA". Es fácil de revertir si el usuario
  // solicita incluirlos: solo comentá estas dos líneas.
  if (/\bpercepcion(es)?\b/.test(texto)) return false;
  if (/\bretencion(es)?\b/.test(texto)) return false;

  return true;
}

// Filtra el feed dejando solo IVA y Libro IVA Digital. Defensivo ante lista vacía.
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
