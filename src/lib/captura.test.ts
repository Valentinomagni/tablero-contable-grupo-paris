import { describe, it, expect } from "vitest";
import { validarCaptura, imagenDelPegado, rutaCaptura, MAX_CAPTURA } from "./captura";

/** File de mentira: en Node no hay uno real con `size` controlable sin cargar bytes. */
function archivo(type: string, size: number, name = "image.png"): File {
  return { type, size, name } as File;
}

describe("qué imagen se acepta", () => {
  it("un PNG de tamaño normal entra", () => {
    // Es lo que produce la tecla de captura de Windows, o sea el caso principal.
    expect(validarCaptura(archivo("image/png", 1_200_000))).toBeNull();
  });

  it("también JPG, WEBP y GIF", () => {
    for (const t of ["image/jpeg", "image/webp", "image/gif"]) {
      expect(validarCaptura(archivo(t, 500_000))).toBeNull();
    }
  });

  it("un PDF no, y el mensaje dice qué sí se puede", () => {
    const m = validarCaptura(archivo("application/pdf", 100_000));
    expect(m).toContain("imagen");
    expect(m).toContain("PNG");
  });

  it("una imagen enorme no, con el límite escrito en el mensaje", () => {
    const m = validarCaptura(archivo("image/png", MAX_CAPTURA + 1));
    expect(m).toContain("5 MB");
  });

  it("justo en el límite entra", () => {
    expect(validarCaptura(archivo("image/png", MAX_CAPTURA))).toBeNull();
  });

  it("sin archivo devuelve un motivo, no explota", () => {
    expect(validarCaptura(null)).toContain("Probá de nuevo");
  });
});

describe("sacar la imagen de lo pegado", () => {
  const item = (kind: string, type: string, f: File | null) =>
    ({ kind, type, getAsFile: () => f });

  it("encuentra la imagen entre lo pegado", () => {
    const f = archivo("image/png", 1000);
    expect(imagenDelPegado([item("file", "image/png", f)])).toBe(f);
  });

  it("la encuentra aunque venga después del texto", () => {
    // El portapapeles de Windows manda varias representaciones de lo mismo. La imagen no siempre
    // viene primera, y quedarse con el primer item devolvería null en un caso que sí funciona.
    const f = archivo("image/png", 1000);
    expect(imagenDelPegado([
      item("string", "text/plain", null),
      item("string", "text/html", null),
      item("file", "image/png", f),
    ])).toBe(f);
  });

  // PEGAR TEXTO ES LO NORMAL Y NO PUEDE AVISAR NADA. Alguien pega la ruta de un archivo o el
  // mensaje de error que copió: eso es exactamente lo que se espera que haga. Un "eso no es una
  // imagen" ahí es un reproche por hacer lo correcto.
  it("pegar texto devuelve null, en silencio", () => {
    expect(imagenDelPegado([item("string", "text/plain", null)])).toBeNull();
  });

  it("sin nada pegado devuelve null y no rompe", () => {
    expect(imagenDelPegado(null)).toBeNull();
    expect(imagenDelPegado(undefined)).toBeNull();
    expect(imagenDelPegado([])).toBeNull();
  });
});

describe("la ruta dentro del bucket", () => {
  const UID = "11111111-2222-3333-4444-555555555555";

  // LA POLICY DE STORAGE SOLO DEJA ESCRIBIR EN LA CARPETA PROPIA (migración 52). Una ruta que
  // no arranque con el uuid es un 403 con un mensaje que no le sirve a nadie.
  it("empieza SIEMPRE con el uuid de quien sube", () => {
    const r = rutaCaptura(UID, "image/png", "2026-08-14T18:30:00.000Z");
    expect(r?.startsWith(UID + "/")).toBe(true);
  });

  it("la extensión sale del tipo, no del nombre del archivo", () => {
    expect(rutaCaptura(UID, "image/jpeg", "2026-08-14T18:30:00.000Z")).toMatch(/\.jpg$/);
    expect(rutaCaptura(UID, "image/webp", "2026-08-14T18:30:00.000Z")).toMatch(/\.webp$/);
    expect(rutaCaptura(UID, "image/png", "2026-08-14T18:30:00.000Z")).toMatch(/\.png$/);
  });

  // Lo pegado desde el portapapeles llega SIEMPRE como "image.png". Si el nombre saliera de ahí,
  // la segunda captura pisaría la primera y el reporte anterior perdería su evidencia.
  it("dos capturas del mismo usuario no comparten nombre", () => {
    const a = rutaCaptura(UID, "image/png", "2026-08-14T18:30:00.000Z");
    const b = rutaCaptura(UID, "image/png", "2026-08-14T18:30:01.000Z");
    expect(a).not.toBe(b);
  });

  it("no deja dos puntos en el nombre: rompen rutas en algunos clientes", () => {
    const r = rutaCaptura(UID, "image/png", "2026-08-14T18:30:00.000Z");
    expect(r?.slice(UID.length + 1)).not.toContain(":");
  });

  it("sin datos devuelve null en vez de una ruta inventada", () => {
    expect(rutaCaptura("", "image/png", "2026-08-14T18:30:00.000Z")).toBeNull();
    expect(rutaCaptura(UID, "image/png", "")).toBeNull();
  });
});
