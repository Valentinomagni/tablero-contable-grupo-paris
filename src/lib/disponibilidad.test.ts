import { describe, it, expect } from "vitest";
import { disponibilidad, textoNoHabilitado, textoNoHabilitadoAdmin } from "./disponibilidad";

describe("los tres estados de disponibilidad", () => {
  it("la lista llegó y la incluye: está", () => {
    expect(disponibilidad([27, 28, 29], 28)).toBe("si");
  });

  it("la lista llegó y no la incluye: falta, y recién acá se puede afirmar", () => {
    expect(disponibilidad([27, 29], 28)).toBe("no");
  });

  // EL CASO QUE PRODUCÍA EL BUG. `useMigraciones()` devuelve `undefined` mientras la consulta
  // está en vuelo. Con el criterio viejo —"ante la duda, false"— esto daba "no" y la pantalla
  // afirmaba que la función no estaba disponible... aunque la migración estuviera aplicada.
  // La persona veía "no disponible", parpadeaba, y aparecía la función.
  it("mientras carga NO dice que falta: dice que no sabe", () => {
    expect(disponibilidad(undefined, 28)).toBe("nose");
  });

  it("si la consulta falló tampoco afirma que falta", () => {
    // `useMigraciones` devuelve null ante error. Un corte de red no es evidencia de que una
    // migración no esté aplicada.
    expect(disponibilidad(null, 28)).toBe("nose");
  });

  it("ante datos con forma rara no afirma nada", () => {
    expect(disponibilidad({} as unknown as number[], 28)).toBe("nose");
    expect(disponibilidad("28" as unknown as number[], 28)).toBe("nose");
  });

  it("la lista vacía SÍ es información: significa que falta", () => {
    // Distinto de los de arriba: acá la consulta contestó. Que no haya ninguna aplicada es un
    // dato real, no una ausencia de dato.
    expect(disponibilidad([], 28)).toBe("no");
  });
});

describe("qué se le dice a cada uno", () => {
  it("al empleado NUNCA se le nombra un número de migración", () => {
    const t = textoNoHabilitado("los adjuntos");
    expect(t).not.toMatch(/migraci/i);
    expect(t).not.toMatch(/\d/);
  });

  it("y se le dice a quién avisarle, que es lo único que puede hacer", () => {
    expect(textoNoHabilitado("los adjuntos")).toContain("administra el sistema");
  });

  it("en Administración el número SÍ va: quien lee esa pantalla es quien la corre", () => {
    expect(textoNoHabilitadoAdmin("Empresas", 31)).toContain("31");
  });
});
