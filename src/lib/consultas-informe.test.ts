import { describe, it, expect } from "vitest";
import { ordenarConsultas, informeConsultas, type PerfilMinimo } from "./consultas-informe";
import type { Consulta } from "./types";

const PERFILES: PerfilMinimo[] = [
  { id: "u1", name: "Ana Pérez" },
  { id: "u2", name: "Bruno Díaz" },
];
const GENERADO = "2026-07-29T12:00:00.000Z";

function consulta(over: Partial<Consulta> = {}): Consulta {
  return {
    id: "aaaaaaaa-1111-2222-3333-444444444444", autor: "u1", tipo: "consulta",
    texto: "No encuentro el botón de imprimir", estado: "nueva",
    respuesta: null, created_at: "2026-07-20T10:00:00Z", respondida_at: null, ...over,
  };
}

describe("ordenarConsultas", () => {
  it("pone los errores primero: bloquean a alguien ahora", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("dentro del mismo tipo, las nuevas antes que las ya vistas", () => {
    const cs = [
      consulta({ id: "a", tipo: "error", estado: "archivada" }),
      consulta({ id: "b", tipo: "error", estado: "nueva" }),
    ];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("a igual tipo y estado, la más reciente primero", () => {
    const cs = [
      consulta({ id: "a", created_at: "2026-07-01T10:00:00Z" }),
      consulta({ id: "b", created_at: "2026-07-20T10:00:00Z" }),
    ];
    expect(ordenarConsultas(cs)[0].id).toBe("b");
  });

  it("no muta el arreglo que recibe", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    ordenarConsultas(cs);
    expect(cs[0].id).toBe("a");
  });

  it("es defensiva ante entradas raras", () => {
    expect(ordenarConsultas(null as unknown as Consulta[])).toEqual([]);
  });
});

describe("informeConsultas", () => {
  it("resuelve el nombre del autor a partir de los perfiles", () => {
    const md = informeConsultas([consulta({ autor: "u2" })], PERFILES, GENERADO);
    expect(md).toContain("Bruno Díaz");
  });

  it("si no conoce al autor, muestra el id en vez de romperse", () => {
    const md = informeConsultas([consulta({ autor: "desconocido" })], PERFILES, GENERADO);
    expect(md).toContain("desconocido");
  });

  it("incluye el texto de la consulta", () => {
    const md = informeConsultas([consulta()], PERFILES, GENERADO);
    expect(md).toContain("No encuentro el botón de imprimir");
  });

  it("cita el texto como blockquote para que no rompa la estructura del informe", () => {
    // Un texto que arranque con '#' partiría el Markdown en dos si se pegara crudo.
    const md = informeConsultas([consulta({ texto: "## no es un título" })], PERFILES, GENERADO);
    expect(md).toContain("> ## no es un título");
  });

  it("cita bien un texto de varias líneas", () => {
    const md = informeConsultas([consulta({ texto: "linea uno\nlinea dos" })], PERFILES, GENERADO);
    expect(md).toContain("> linea uno");
    expect(md).toContain("> linea dos");
  });

  it("muestra la respuesta cuando ya la hay", () => {
    const md = informeConsultas([consulta({ respuesta: "Está en el menú" })], PERFILES, GENERADO);
    expect(md).toContain("Está en el menú");
  });

  it("marca explícitamente lo que sigue sin responder", () => {
    const md = informeConsultas([consulta({ respuesta: null })], PERFILES, GENERADO);
    expect(md).toMatch(/sin responder/i);
  });

  it("resume cuántas hay de cada estado", () => {
    const cs = [
      consulta({ id: "a", estado: "nueva" }),
      consulta({ id: "b", estado: "nueva" }),
      consulta({ id: "c", estado: "leida" }),
    ];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("3 en total");
    expect(md).toContain("2 nuevas");
    expect(md).toContain("1 leída");
  });

  it("agrupa por tipo con un título por grupo", () => {
    const cs = [consulta({ id: "a", tipo: "error" }), consulta({ id: "b", tipo: "sugerencia" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("## Errores");
    expect(md).toContain("## Sugerencias");
  });

  it("no crea grupos vacíos", () => {
    const md = informeConsultas([consulta({ tipo: "error" })], PERFILES, GENERADO);
    expect(md).not.toContain("## Sugerencias");
  });

  // Encuadre no punitivo: el informe habla de pedidos, no de personas.
  it("no cuenta consultas por persona ni arma ranking de autores", () => {
    const cs = [consulta({ id: "a", autor: "u1" }), consulta({ id: "b", autor: "u1" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).not.toMatch(/Ana Pérez.*\b2\b.*consultas/i);
    expect(md).not.toMatch(/ranking/i);
  });

  it("sin consultas lo dice, en vez de devolver un archivo vacío", () => {
    const md = informeConsultas([], PERFILES, GENERADO);
    expect(md).toMatch(/no hay consultas/i);
  });

  it("deja la fecha de generación para saber a qué momento corresponde", () => {
    const md = informeConsultas([consulta()], PERFILES, GENERADO);
    expect(md).toContain("2026-07-29");
  });

  it("es defensiva ante entradas raras", () => {
    expect(informeConsultas(null as unknown as Consulta[], PERFILES, GENERADO)).toMatch(/no hay consultas/i);
    expect(informeConsultas([consulta()], null as unknown as PerfilMinimo[], GENERADO)).toContain("u1");
  });
});
