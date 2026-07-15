import { describe, it, expect } from "vitest";
import { filtrarOrdenar, notaATarea } from "./notas";
import type { Note } from "./types";

const n = (id: string, title: string, body: string, c: string, u: string, archived = false): Note =>
  ({ id, owner: "u", title, body, archived, created_at: c, updated_at: u });

const notas = [
  n("a", "IVA", "revisar", "2026-07-01", "2026-07-10"),
  n("b", "banco", "conciliar", "2026-07-05", "2026-07-05"),
];

describe("filtrarOrdenar", () => {
  it("busca en título y cuerpo", () =>
    expect(filtrarOrdenar(notas, "conc", "creado").map((x) => x.id)).toEqual(["b"]));
  it("busca en título", () =>
    expect(filtrarOrdenar(notas, "iva", "creado").map((x) => x.id)).toEqual(["a"]));
  it("ordena por creación desc", () =>
    expect(filtrarOrdenar(notas, "", "creado").map((x) => x.id)).toEqual(["b", "a"]));
  it("ordena por última modificación desc", () =>
    expect(filtrarOrdenar(notas, "", "modificado").map((x) => x.id)).toEqual(["a", "b"]));
  it("excluye archivadas por defecto", () => {
    const con = [...notas, n("c", "vieja", "archivada", "2026-06-01", "2026-06-01", true)];
    expect(filtrarOrdenar(con, "", "creado").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("incluye archivadas con el toggle", () => {
    const con = [...notas, n("c", "vieja", "archivada", "2026-06-01", "2026-06-01", true)];
    expect(filtrarOrdenar(con, "", "creado", true).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});

describe("notaATarea", () => {
  it("usa el título y el cuerpo como descripción", () => {
    const t = notaATarea(n("a", "Revisar IVA", "detalle del cuerpo", "c", "u"), "me1");
    expect(t).toMatchObject({ owner: "me1", title: "Revisar IVA", description: "detalle del cuerpo", status: "pend" });
  });
  it("si no hay título, toma las primeras palabras del cuerpo", () => {
    const t = notaATarea(n("a", "  ", "conciliar la cuenta del banco provincia rápido ahora ya", "c", "u"), "me1");
    expect(t.title).toBe("conciliar la cuenta del banco provincia rápido ahora");
  });
  it("cae a un título por defecto si todo está vacío", () => {
    expect(notaATarea(n("a", "", "", "c", "u"), "me1").title).toBe("Anotación");
  });
});
