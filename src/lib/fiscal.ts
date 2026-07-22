import type { Announcement } from "./types";

// Calendario fiscal autogenerado (spec 28, E3 Task 2). NO hay integración con
// AFIP/ARCA: no es viable sin certificados propios. Estas son fechas de
// REFERENCIA para gestión interna (en la realidad el vencimiento exacto depende
// de la terminación de CUIT de cada contribuyente). El día de cada obligación
// es configurable acá — ajustalo si cambia la normativa o el criterio interno.
export interface VencimientoFiscal {
  nombre: string;
  detalle: string;
  diaMes: number; // día de referencia del mes (1-31), clampado al último día real
}

export const VENCIMIENTOS_FISCALES: VencimientoFiscal[] = [
  { nombre: "IVA", detalle: "Declaración jurada y pago mensual de IVA (fecha de referencia, no exacta por CUIT).", diaMes: 18 },
  { nombre: "F931 (cargas sociales)", detalle: "Declaración jurada y pago de aportes y contribuciones — F931 (fecha de referencia, no exacta por CUIT).", diaMes: 10 },
  { nombre: "IIBB", detalle: "Ingresos Brutos, anticipo mensual (fecha de referencia, no exacta por CUIT).", diaMes: 15 },
  { nombre: "SICORE", detalle: "Retenciones y percepciones, presentación e ingreso (fecha de referencia, no exacta por CUIT).", diaMes: 20 },
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

// Clave de idempotencia: el título incluye el nombre de la obligación + mes/año
// (mismo criterio que marcaPlantilla en plantilla.ts: una marca textual estable
// que identifica "esta obligación, generada para este mes concreto").
export const tituloVencimiento = (nombre: string, year: number, month1a12: number) =>
  `${nombre} · ${String(month1a12).padStart(2, "0")}/${year}`;

// Vencimientos fiscales que FALTAN generar para el mes pedido: se compara por
// el título exacto (que ya lleva la marca de mes/año) contra los anuncios
// kind="vencimiento" existentes, evitando duplicados si se aprieta el botón dos veces.
export function generarVencimientosMes(
  year: number,
  month1a12: number,
  existentes: Announcement[],
): { title: string; detail: string; due_date: string }[] {
  const ultimoDia = new Date(year, month1a12, 0).getDate();
  return VENCIMIENTOS_FISCALES
    .map((v) => ({
      title: tituloVencimiento(v.nombre, year, month1a12),
      detail: v.detalle,
      due_date: ajustarFinDeSemana(year, month1a12, Math.min(v.diaMes, ultimoDia)),
    }))
    .filter((v) => !existentes.some((a) => a.kind === "vencimiento" && a.title.trim() === v.title));
}
