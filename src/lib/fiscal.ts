import type { Announcement } from "./types";

// Calendario fiscal autogenerado (spec 28, E3 Task 2). NO hay integración con
// AFIP/ARCA: no es viable sin certificados propios. Estas son fechas de
// REFERENCIA para gestión interna (en la realidad el vencimiento exacto depende
// de la terminación de CUIT de cada contribuyente). El día de cada obligación
// es configurable acá — ajustalo si cambia la normativa o el criterio interno.
export interface VencimientoFiscal {
  slug: string; // id corto y estable de la obligación, va embebido en el detail (ver marcaFiscal)
  nombre: string;
  detalle: string;
  diaMes: number; // día de referencia del mes (1-31), clampado al último día real
}

export const VENCIMIENTOS_FISCALES: VencimientoFiscal[] = [
  { slug: "iva", nombre: "IVA", detalle: "Declaración jurada y pago mensual de IVA (fecha de referencia, no exacta por CUIT).", diaMes: 18 },
  { slug: "f931", nombre: "F931 (cargas sociales)", detalle: "Declaración jurada y pago de aportes y contribuciones — F931 (fecha de referencia, no exacta por CUIT).", diaMes: 10 },
  { slug: "iibb", nombre: "IIBB", detalle: "Ingresos Brutos, anticipo mensual (fecha de referencia, no exacta por CUIT).", diaMes: 15 },
  { slug: "sicore", nombre: "SICORE", detalle: "Retenciones y percepciones, presentación e ingreso (fecha de referencia, no exacta por CUIT).", diaMes: 20 },
];

// Los vencimientos fiscales no caen en fin de semana: si el día de referencia
// cae sábado o domingo, se corre al lunes siguiente.
export function ajustarFinDeSemana(year: number, month1a12: number, day: number): string {
  const d = new Date(year, month1a12 - 1, day);
  const dow = d.getDay(); // 0 = domingo, 6 = sábado
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const tituloVencimiento = (nombre: string, year: number, month1a12: number) =>
  `${nombre} · ${String(month1a12).padStart(2, "0")}/${year}`;

// Marca de idempotencia embebida en el `detail`: identifica la obligación (slug)
// y el mes/año en que fue generada. A diferencia del título (100% editable desde
// AnuncioEditForm), el detail es texto largo que en uso normal nadie reescribe
// entero — pero SIGUE siendo editable, así que esto no es una ancla dura como
// card.history (append-only) en marcaPlantilla de plantilla.ts. Es la mejor
// aproximación disponible dado que Announcement no tiene un campo no-editable
// para metadatos; si el detail se reescribe por completo, el fallback por
// due_date+mes (ver generarVencimientosMes) acota el daño a "no vuelve a
// duplicar salvo que también le cambien la fecha".
export const marcaFiscal = (slug: string, year: number, month1a12: number) =>
  `[fiscal:${slug}:${year}-${String(month1a12).padStart(2, "0")}]`;

// Vencimientos fiscales que FALTAN generar para el mes pedido. Se considera que
// una obligación ya existe si hay un anuncio kind="vencimiento" cuyo due_date
// cae en ese mes/año Y (tiene la marca estable en el detail O coincide el título
// exacto). La condición por título exacto es el criterio viejo (pre-fix): se
// mantiene para reconocer avisos generados con la versión anterior del código
// (sin marca en el detail) y no duplicarlos en la migración.
export function generarVencimientosMes(
  year: number,
  month1a12: number,
  existentes: Announcement[],
): { title: string; detail: string; due_date: string }[] {
  const ultimoDia = new Date(year, month1a12, 0).getDate();
  const pref = `${year}-${String(month1a12).padStart(2, "0")}`;
  return VENCIMIENTOS_FISCALES
    .map((v) => ({
      title: tituloVencimiento(v.nombre, year, month1a12),
      detail: `${v.detalle} ${marcaFiscal(v.slug, year, month1a12)}`,
      due_date: ajustarFinDeSemana(year, month1a12, Math.min(v.diaMes, ultimoDia)),
      marca: marcaFiscal(v.slug, year, month1a12),
    }))
    .filter((v) => !existentes.some((a) =>
      a.kind === "vencimiento" &&
      (a.due_date ?? "").startsWith(pref) &&
      (a.detail.includes(v.marca) || a.title.trim() === v.title),
    ))
    .map(({ title, detail, due_date }) => ({ title, detail, due_date }));
}
