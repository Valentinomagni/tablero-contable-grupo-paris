import { describe, it, expect } from "vitest";
import { escaparHtml, documentoImpresion, type DatosReporte } from "./impresion";

const DATOS: DatosReporte = {
  titulo: "Reporte ejecutivo — Equipo Contable",
  subtitulo: "Peugeot · Centro",
  generado: "27 de julio de 2026",
  kpis: [{ rotulo: "Salud del equipo", valor: "82%", detalle: "Saludable" }],
  secciones: [{ titulo: "Por persona", encabezados: ["Persona", "Puntos"], filas: [{ celdas: ["Ana", "12"] }] }],
};

describe("escaparHtml", () => {
  it("escapa los caracteres que romperían el HTML", () => {
    expect(escaparHtml('<b>"A" & \'B\'</b>')).toBe("&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;");
  });
  it("el & se escapa primero (no se re-escapan las entidades que genera)", () => {
    expect(escaparHtml("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });
  it("defensiva ante valores no-string", () => {
    expect(escaparHtml(null as unknown as string)).toBe("");
    expect(escaparHtml(undefined as unknown as string)).toBe("");
  });
});

describe("documentoImpresion", () => {
  it("devuelve un documento HTML completo y autocontenido", () => {
    const html = documentoImpresion(DATOS);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
    // sin recursos externos: imprimir no debe depender de la red
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("incluye título, subtítulo, fecha, KPIs y las filas de cada sección", () => {
    const html = documentoImpresion(DATOS);
    expect(html).toContain("Reporte ejecutivo");
    expect(html).toContain("Peugeot · Centro");
    expect(html).toContain("27 de julio de 2026");
    expect(html).toContain("Salud del equipo");
    expect(html).toContain("82%");
    expect(html).toContain("Saludable");
    expect(html).toContain("Por persona");
    expect(html).toContain("Ana");
    expect(html).toContain("12");
  });

  it("escapa los datos de usuario (un nombre con etiquetas no rompe el documento)", () => {
    const html = documentoImpresion({
      ...DATOS,
      secciones: [{ titulo: "T", encabezados: ["P"], filas: [{ celdas: ["<script>x</script>"] }] }],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapa también el título y el subtítulo", () => {
    const html = documentoImpresion({ ...DATOS, titulo: "<img onerror=1>", subtitulo: "a & b" });
    expect(html).not.toContain("<img onerror=1>");
    expect(html).toContain("a &amp; b");
  });

  it("sin secciones ni kpis igual devuelve un documento válido", () => {
    const html = documentoImpresion({ ...DATOS, kpis: [], secciones: [] });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
  });

  it("una sección sin filas OMITE la tabla y avisa que no hay datos", () => {
    const html = documentoImpresion({ ...DATOS, secciones: [{ titulo: "Vacía", encabezados: ["A"], filas: [] }] });
    expect(html).toContain("Vacía");
    expect(html).toContain("Sin datos en este período.");
    expect(html).not.toContain("<table>");   // sin esto el test pasaba aunque la rama se rompiera
    expect(html).toContain("</html>");
  });

  // Los encabezados y los KPIs también reciben datos de la base (marcas, sucursales,
  // nombres): si no se escaparan, el agujero de inyección seguiría abierto por ahí.
  it("escapa los encabezados de tabla", () => {
    const html = documentoImpresion({
      ...DATOS,
      secciones: [{ titulo: "T", encabezados: ["<b>Persona</b>"], filas: [{ celdas: ["x"] }] }],
    });
    expect(html).not.toContain("<b>Persona</b>");
    expect(html).toContain("&lt;b&gt;Persona&lt;/b&gt;");
  });

  it("escapa rótulo, valor y detalle de los KPIs", () => {
    const html = documentoImpresion({
      ...DATOS,
      kpis: [{ rotulo: "<i>R</i>", valor: "<i>V</i>", detalle: "<i>D</i>" }],
      secciones: [],
    });
    expect(html).not.toContain("<i>R</i>");
    expect(html).not.toContain("<i>V</i>");
    expect(html).not.toContain("<i>D</i>");
    expect(html).toContain("&lt;i&gt;R&lt;/i&gt;");
  });

  it("repite el encabezado de tabla en cada hoja y evita cortar filas al medio", () => {
    const html = documentoImpresion(DATOS);
    expect(html).toContain("table-header-group");
    expect(html).toContain("break-inside");
  });

  it("define el tamaño de página para que el PDF salga prolijo", () => {
    expect(documentoImpresion(DATOS)).toContain("@page");
  });

  it("el KPI sin detalle no imprime 'undefined'", () => {
    const html = documentoImpresion({ ...DATOS, kpis: [{ rotulo: "Avance", valor: "40%" }], secciones: [] });
    expect(html).not.toContain("undefined");
  });
});
