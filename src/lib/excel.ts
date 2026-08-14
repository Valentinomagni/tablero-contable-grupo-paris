// Exportación del análisis mensual a Excel (spec 27, item 4). armarLibroAnalisis es PURA
// (sin importar xlsx) para poder testearla sin DOM/side effects; descargarExcel hace el
// dynamic import de xlsx (SheetJS) recién al momento de descargar, para no engordar el
// chunk inicial del bundle.
import type { AnalisisMes } from "./analisis";
import { ENCUADRE_REPARTO } from "./encuadre";

type Fila = (string | number | null)[];
export interface Libro {
  hojas: {
    nombre: string;
    filas: Fila[];
    /** Ver `descargarExcel`: protege la hoja para que no se pueda ordenar ni filtrar. */
    bloquearOrden?: boolean;
  }[];
}

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

  // El encuadre va ARRIBA de la tabla y es el MISMO texto que ya lleva el PDF del Reporte
  // (`ENCUADRE_REPARTO`, fuente única en encuadre.ts). Antes esta hoja salía pelada: los mismos
  // números que en pantalla van acompañados de la aclaración, en el archivo que se manda por mail
  // aparecían como una tabla de personas con un porcentaje al lado y nada más.
  const porPersona: Fila[] = [
    [`Cumplimiento por persona — ${ENCUADRE_REPARTO}`],
    [],
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
      // Sólo esta hoja se bloquea: es la única que pone números al lado de nombres de personas.
      // "Por marca" y "Por sucursal" se pueden ordenar sin que eso arme un podio de nadie.
      { nombre: "Por persona", filas: porPersona, bloquearOrden: true },
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
    // BLOQUEO DE ORDEN (hallazgo 3 de la auditoría del 05/08). En pantalla y en el PDF la tabla
    // por persona sale en un orden que no es un ranking; en el Excel, la columna "Cerradas %" se
    // ordena de mayor a menor con un clic y el podio queda armado igual.
    //
    // NO SE PUEDE bloquear UNA columna: en el formato xlsx la protección es de HOJA, no de
    // columna (`sheetProtection`, ECMA-376 18.3.1.85), así que se bloquea la hoja entera —
    // que acá es exactamente la tabla por persona, sin daño colateral.
    //
    // `{}` alcanza y hace lo que hay que hacer: SheetJS escribe `<sheetProtection sheet="1"/>`,
    // y en ese elemento los atributos `sort` y `autoFilter` valen `true` por defecto, o sea que
    // ordenar y filtrar quedan bloqueados. Ojo con la intuición al revés: pasar `{sort: false}`
    // escribiría `sort="0"`, que es HABILITAR el orden.
    // Comprobado sobre el archivo generado, no sobre la documentación: el .xlsx de prueba trae
    // `<sheetProtection sheet="1"/>` en xl/worksheets/sheet1.xml.
    //
    // Es un freno, no un candado: en Excel se saca con Revisar > Desproteger hoja, sin
    // contraseña. Ponerle contraseña sería peor — el archivo es del equipo, y el objetivo es que
    // ordenar por porcentaje sea un acto deliberado y no un clic distraído. `selectLockedCells`
    // queda habilitado (es el default), así que leer y copiar sigue funcionando igual.
    if (hoja.bloquearOrden) ws["!protect"] = {};
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre);
  }
  XLSX.writeFile(wb, nombreArchivo);
}
