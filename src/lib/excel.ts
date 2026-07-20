// Exportación del análisis mensual a Excel (spec 27, item 4). armarLibroAnalisis es PURA
// (sin importar xlsx) para poder testearla sin DOM/side effects; descargarExcel hace el
// dynamic import de xlsx (SheetJS) recién al momento de descargar, para no engordar el
// chunk inicial del bundle.
import type { AnalisisMes } from "./analisis";

type Fila = (string | number | null)[];
export interface Libro { hojas: { nombre: string; filas: Fila[] }[] }

const guion = "—";
const num = (n: number | null): string | number => (n === null ? guion : n);

export function armarLibroAnalisis(a: AnalisisMes, meta: { mesLabel: string; segmento: string | null }): Libro {
  const titulo = `Análisis del mes — ${meta.mesLabel}${meta.segmento ? ` — ${meta.segmento}` : ""}`;

  const resumen: Fila[] = [
    [titulo],
    [],
    ["Cumplimiento %", a.cumplimiento],
    ["Evolución vs mes anterior", num(a.deltaMesAnterior)],
    ["Rendimiento promedio histórico", num(a.promedioHistorico)],
    ["Tareas vencidas", a.vencidas],
    ["Arqueos con diferencias", a.arqueos.difs],
    ["Monto diferencias", a.arqueos.montoTotal],
  ];

  const porPersona: Fila[] = [
    ["Nombre", "Cerradas %", "Total", "Vencidas", "Abiertas"],
    ...a.porPersona.map((p): Fila => [p.nombre, p.pct, p.total, p.vencidas, p.abiertas]),
  ];

  const porMarca: Fila[] = [
    ["Marca", "Cumplimiento %", "Total"],
    ...a.porMarca.map((m): Fila => [m.marca, m.pct, m.total]),
  ];

  const porSucursal: Fila[] = [
    ["Sucursal", "Cumplimiento %", "Total"],
    ...a.porSucursal.map((s): Fila => [s.sucursal, s.pct, s.total]),
  ];

  return {
    hojas: [
      { nombre: "Resumen", filas: resumen },
      { nombre: "Por persona", filas: porPersona },
      { nombre: "Por marca", filas: porMarca },
      { nombre: "Por sucursal", filas: porSucursal },
    ],
  };
}

// Side effect: genera el .xlsx y dispara la descarga en el navegador. Sin test unitario
// (requiere xlsx real); dynamic import para mantenerlo fuera del chunk inicial.
export async function descargarExcel(libro: Libro, nombreArchivo: string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const hoja of libro.hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas);
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre);
  }
  XLSX.writeFile(wb, nombreArchivo);
}
