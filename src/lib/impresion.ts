// Vista de impresión DEDICADA (spec 28-correcciones, item 1).
//
// QUÉ FALLABA ANTES: el botón "Imprimir / PDF" hacía `window.print()` sobre la app y un
// bloque `@media print` intentaba esconder el armazón (sidebar, botones) y deshacer el
// layout. Pero el contenido vive dentro de una cadena de contenedores flex con altura fija
// y `overflow` recortado; deshacer eso desde CSS de impresión es frágil y depende del
// navegador. Resultado: hojas en blanco. Y yo lo di por verificado con una captura
// estática, que NO ejercita el motor de impresión — por eso no lo detecté.
//
// QUÉ SE HACE AHORA: se arma un documento HTML COMPLETO Y PROPIO con los datos del reporte
// y se imprime ESE documento en una ventana nueva (ver impresion-dom.ts). La ventana nueva
// no tiene nada del armazón de la app, así que no hay nada que deshacer: el modo de falla
// anterior queda estructuralmente imposible, no "mitigado".
//
// Este archivo es PURO (sin DOM, sin React): se puede testear entero.

/**
 * Escapa texto para insertarlo en HTML. TODO dato que venga de la base (nombres de
 * personas, marcas, sucursales, títulos de tareas) pasa por acá: se inyectan como string
 * en el documento, así que un nombre con `<` o `&` rompería el HTML — o algo peor.
 * El `&` va PRIMERO, si no se re-escaparían las entidades que generan los demás.
 */
export function escaparHtml(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Una métrica destacada de la cabecera del reporte. */
export interface KpiImpresion { rotulo: string; valor: string; detalle?: string }

/** Una tabla del reporte. */
export interface SeccionImpresion {
  titulo: string;
  encabezados: string[];
  filas: { celdas: string[] }[];
}

/** Todo lo que necesita el documento impreso. Sólo strings ya formateados: la función no
 *  calcula ni formatea nada — de eso se encarga quien tiene los datos (el Reporte). */
export interface DatosReporte {
  titulo: string;
  subtitulo: string;
  generado: string;
  kpis: KpiImpresion[];
  secciones: SeccionImpresion[];
}

// CSS del documento impreso. Deliberadamente mínimo y SIN recursos externos (ni fuentes ni
// imágenes remotas): imprimir no debe depender de la red ni quedarse esperando una
// descarga. Monocromo, coherente con la marca.
const ESTILOS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #18181b;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 11pt; line-height: 1.45;
  }
  header { border-bottom: 1.5px solid #18181b; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 17pt; margin: 0 0 2px; letter-spacing: -.02em; }
  .sub { color: #52525b; font-size: 10pt; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .kpi {
    border: 1px solid #d4d4d8; border-radius: 8px; padding: 10px 14px;
    min-width: 150px; break-inside: avoid;
  }
  .kpi .rot { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #52525b; }
  .kpi .val { font-size: 16pt; font-weight: 700; letter-spacing: -.02em; }
  .kpi .det { font-size: 9pt; color: #52525b; }
  h2 { font-size: 12pt; margin: 18px 0 6px; letter-spacing: -.01em; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  /* Repite el encabezado en cada hoja: sin esto, a partir de la página 2 la tabla
     aparece sin títulos de columna y no se entiende qué es cada número. */
  thead { display: table-header-group; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e4e4e7; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #52525b; border-bottom-color: #a1a1aa; }
  td:not(:first-child), th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
  /* Que una fila no se parta entre dos hojas. */
  tr { break-inside: avoid; }
  .vacio { color: #71717a; font-size: 10pt; font-style: italic; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e4e4e7; color: #71717a; font-size: 8.5pt; }
`;

function kpiHtml(k: KpiImpresion): string {
  const det = k.detalle ? `<div class="det">${escaparHtml(k.detalle)}</div>` : "";
  return `<div class="kpi"><div class="rot">${escaparHtml(k.rotulo)}</div>`
    + `<div class="val">${escaparHtml(k.valor)}</div>${det}</div>`;
}

function seccionHtml(s: SeccionImpresion): string {
  const titulo = `<h2>${escaparHtml(s.titulo)}</h2>`;
  if (!s.filas?.length) return `${titulo}<p class="vacio">Sin datos en este período.</p>`;
  const th = (s.encabezados ?? []).map((h) => `<th>${escaparHtml(h)}</th>`).join("");
  const filas = s.filas
    .map((f) => `<tr>${(f.celdas ?? []).map((c) => `<td>${escaparHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `${titulo}<table><thead><tr>${th}</tr></thead><tbody>${filas}</tbody></table>`;
}

/**
 * Documento HTML completo y autocontenido del reporte, listo para imprimir.
 * Autocontenido = sin ninguna referencia a la red: todo el estilo va embebido.
 */
export function documentoImpresion(d: DatosReporte): string {
  const kpis = (d.kpis ?? []).map(kpiHtml).join("");
  const secciones = (d.secciones ?? []).map(seccionHtml).join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escaparHtml(d.titulo)}</title>
<style>${ESTILOS}</style>
</head>
<body>
<header>
  <h1>${escaparHtml(d.titulo)}</h1>
  <div class="sub">${escaparHtml(d.subtitulo)}</div>
</header>
${kpis ? `<div class="kpis">${kpis}</div>` : ""}
${secciones}
<footer>Generado el ${escaparHtml(d.generado)} — Tablero Contable, Grupo Paris</footer>
</body>
</html>`;
}
