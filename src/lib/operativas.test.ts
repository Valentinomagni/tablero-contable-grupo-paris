import { describe, it, expect } from "vitest";
import { nuevaCantidad, progresoCarga, extraerMetaCarga, conMetaCarga, descripcionSinMeta } from "./operativas";

describe("nuevaCantidad", () => {
  it("resta respetando el piso", () => {
    expect(nuevaCantidad(3, -1)).toBe(2);
    expect(nuevaCantidad(0, -1)).toBe(0);
  });
  it("suma", () => {
    expect(nuevaCantidad(2, 5)).toBe(7);
  });
});

describe("progresoCarga", () => {
  it("sin meta devuelve pct null y texto con solo el actual", () => {
    expect(progresoCarga(23, null)).toEqual({ pct: null, texto: "23" });
  });
  it("con meta arma el texto '23 de 30' y el pct redondeado", () => {
    expect(progresoCarga(23, 30)).toEqual({ pct: 77, texto: "23 de 30" });
  });
  it("actual en 0 con meta da pct 0", () => {
    expect(progresoCarga(0, 10)).toEqual({ pct: 0, texto: "0 de 10" });
  });
  it("actual == meta da pct 100", () => {
    expect(progresoCarga(30, 30)).toEqual({ pct: 100, texto: "30 de 30" });
  });
  it("actual > meta topea el pct en 100 pero el texto muestra el real", () => {
    expect(progresoCarga(35, 30)).toEqual({ pct: 100, texto: "35 de 30" });
  });
  it("meta 0 o negativa no rompe (nunca divide por cero): se trata como sin meta", () => {
    expect(progresoCarga(5, 0)).toEqual({ pct: null, texto: "5" });
    expect(progresoCarga(5, -3)).toEqual({ pct: null, texto: "5" });
  });
});

describe("extraerMetaCarga / conMetaCarga / descripcionSinMeta (spec 28, Task 3)", () => {
  // Decisión: sin columna nueva en `cards` (ya hay 4 migraciones sin aplicar). La meta
  // se guarda como una marca estructurada al final de `description`. Se usa un prefijo
  // no imprimible (Unit Separator, U+001F) para evitar colisión con texto legítimo.
  it("extrae null si no hay marca", () => {
    expect(extraerMetaCarga("Cargar remitos del mes")).toBeNull();
  });
  it("extrae la meta de la marca (formato nuevo con prefijo no imprimible)", () => {
    expect(extraerMetaCarga("Cargar remitos del mes\n\n\x1f[[meta:30]]")).toBe(30);
  });
  it("extrae la meta del formato viejo (compatibilidad hacia atrás)", () => {
    expect(extraerMetaCarga("Cargar remitos del mes\n\n[[meta:30]]")).toBe(30);
  });
  it("ignora marcas mal formadas o no numéricas", () => {
    expect(extraerMetaCarga("texto [[meta:abc]]")).toBeNull();
    expect(extraerMetaCarga("texto [[meta:]]")).toBeNull();
  });
  it("conMetaCarga agrega la marca EN FORMATO NUEVO a una descripción sin marca previa", () => {
    expect(conMetaCarga("Cargar remitos", 30)).toBe("Cargar remitos\n\n\x1f[[meta:30]]");
  });
  it("conMetaCarga reemplaza formato viejo que COINCIDE con la meta actual", () => {
    // Si la meta actual es 30 y hay [[meta:30]], se remueve (migración)
    expect(conMetaCarga("Cargar remitos\n\n[[meta:30]]", 30)).toBe("Cargar remitos\n\n\x1f[[meta:30]]");
  });
  it("conMetaCarga PRESERVA formato viejo que NO coincide (texto legítimo)", () => {
    // Si la meta actual es 30 pero hay [[meta:2024]], se preserva (es texto del usuario)
    expect(conMetaCarga("Cargar remitos\n\nVer anexo [[meta:2024]]", 30)).toBe("Cargar remitos\n\nVer anexo [[meta:2024]]\n\n\x1f[[meta:30]]");
  });
  it("conMetaCarga con meta null saca la marca (borrar meta)", () => {
    expect(conMetaCarga("Cargar remitos\n\n\x1f[[meta:30]]", null)).toBe("Cargar remitos");
  });
  it("conMetaCarga con meta null y sin marca previa no cambia nada", () => {
    expect(conMetaCarga("Cargar remitos", null)).toBe("Cargar remitos");
  });
  it("descripcionSinMeta devuelve el texto visible sin la marca (formato nuevo)", () => {
    expect(descripcionSinMeta("Cargar remitos\n\n\x1f[[meta:30]]")).toBe("Cargar remitos");
  });
  it("descripcionSinMeta NO remueve formato viejo (es ambiguo, podría ser texto del usuario)", () => {
    // El formato viejo no se remueve en descripcionSinMeta. La migración viejo→nuevo
    // ocurre en conMetaCarga cuando el usuario guarda. Esto preserva texto legítimo
    // como "Ver anexo [[meta:2024]]" que el usuario podría escribir casualmente.
    expect(descripcionSinMeta("Cargar remitos\n\n[[meta:30]]")).toBe("Cargar remitos\n\n[[meta:30]]");
  });
  it("descripcionSinMeta devuelve el texto sin cambios si no hay marca", () => {
    expect(descripcionSinMeta("Cargar remitos")).toBe("Cargar remitos");
  });
  it("NOTA: extraerMetaCarga detecta formato viejo por compatibilidad", () => {
    // Esto es solo para documentar el comportamiento: el formato viejo SÍ es detectado.
    // Por eso en CardModal, siempre se pasa descripcionSinMeta(c.description) a
    // conMetaCarga, para evitar que format viejo sea re-interpretado.
    expect(extraerMetaCarga("Cargar remitos\n\n[[meta:2024]]")).toBe(2024);
    // Con formato nuevo (prefijo no imprimible), es seguro:
    expect(extraerMetaCarga("Cargar remitos\n\n\x1f[[meta:2024]]")).toBe(2024);
    expect(extraerMetaCarga("Cargar remitos\n\nVer anexo [[meta:2024]]")).toBe(2024);
  });
  it("ciclo completo: texto del usuario con referencia [[meta:N]] distinta se preserva", () => {
    // Card original guardada con meta vieja (formato antiguo)
    const cardDesc = "Cargar remitos\n\n[[meta:30]]";
    // Al leer, extraemos la meta
    const metaOld = extraerMetaCarga(cardDesc);
    expect(metaOld).toBe(30);
    // Se muestra en textarea: descripcionSinMeta NO remueve formato viejo
    // Por eso el usuario VE el [[meta:30]] viejo en el textarea
    const visible = descripcionSinMeta(cardDesc);
    expect(visible).toBe("Cargar remitos\n\n[[meta:30]]");
    // Pero cuando edita en el textarea y borra/reemplaza esa línea,
    // o cuando cambia otra línea, lo que envía al guardar es:
    // (simulando: usuario borró la línea con meta vieja y agregó nueva línea)
    const userEdit = "Cargar remitos\n\nVer anexo [[meta:2024]]";
    // Al guardar: combina edición del usuario + meta actual (30)
    // conMetaCarga preserva [[meta:2024]] porque NO coincide con 30
    const newDesc = conMetaCarga(userEdit, metaOld);
    expect(newDesc).toBe("Cargar remitos\n\nVer anexo [[meta:2024]]\n\n\x1f[[meta:30]]");
    // Re-extraemos: detecta solo la meta con prefijo (30)
    expect(extraerMetaCarga(newDesc)).toBe(30);
    // Sin meta muestra solo el formato nuevo removido; el formato viejo en el texto se preserva
    expect(descripcionSinMeta(newDesc)).toBe("Cargar remitos\n\nVer anexo [[meta:2024]]");
  });
  it("ciclo completo: si usuario tipea [[meta:N]] que COINCIDE con la meta, se deduplica", () => {
    // Card con meta 30 (nueva)
    const cardDesc = "Cargar remitos\n\n\x1f[[meta:30]]";
    const metaCurrent = extraerMetaCarga(cardDesc);
    expect(metaCurrent).toBe(30);
    // Se muestra sin meta
    const visible = descripcionSinMeta(cardDesc);
    expect(visible).toBe("Cargar remitos");
    // Usuario accidentalmente tipea [[meta:30]] (coincide con la actual)
    const userEdit = "Cargar remitos\n\n[[meta:30]]";
    // Al guardar, conMetaCarga REMUEVE el viejo [[meta:30]] que coincide
    const newDesc = conMetaCarga(userEdit, metaCurrent);
    expect(newDesc).toBe("Cargar remitos\n\n\x1f[[meta:30]]");
    // No hay duplicación
    expect(extraerMetaCarga(newDesc)).toBe(30);
  });
});
