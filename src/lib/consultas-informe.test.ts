import { describe, it, expect } from "vitest";
import { agruparPorTipo, informeConsultas, type PerfilMinimo } from "./consultas-informe";
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

describe("agruparPorTipo", () => {
  it("pone los errores primero: bloquean a alguien ahora", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    expect(agruparPorTipo(cs)[0].titulo).toBe("Errores");
  });

  it("respeta el orden errores, consultas, sugerencias", () => {
    const cs = [
      consulta({ id: "a", tipo: "sugerencia" }),
      consulta({ id: "b", tipo: "consulta" }),
      consulta({ id: "c", tipo: "error" }),
    ];
    expect(agruparPorTipo(cs).map((g) => g.titulo)).toEqual(["Errores", "Consultas", "Sugerencias"]);
  });

  it("dentro del grupo, las nuevas antes que las ya vistas", () => {
    const cs = [
      consulta({ id: "a", tipo: "error", estado: "archivada" }),
      consulta({ id: "b", tipo: "error", estado: "nueva" }),
    ];
    expect(agruparPorTipo(cs)[0].consultas[0].id).toBe("b");
  });

  it("a igual tipo y estado, la más reciente primero", () => {
    const cs = [
      consulta({ id: "a", created_at: "2026-07-01T10:00:00Z" }),
      consulta({ id: "b", created_at: "2026-07-20T10:00:00Z" }),
    ];
    expect(agruparPorTipo(cs)[0].consultas[0].id).toBe("b");
  });

  it("no crea grupos vacíos", () => {
    expect(agruparPorTipo([consulta({ tipo: "error" })]).map((g) => g.titulo)).toEqual(["Errores"]);
  });

  // DEFECTO ENCONTRADO EN REVISIÓN: antes, un tipo desconocido desaparecía del informe
  // mientras el total del resumen lo seguía contando. Un informe que se contradice solo es
  // peor que uno incompleto, porque quien lo lee no puede notarlo.
  it("un tipo desconocido va a 'Otros' en vez de desaparecer", () => {
    const cs = [consulta({ id: "raro", tipo: "pedido" as Consulta["tipo"], texto: "no me pierdas" })];
    const grupos = agruparPorTipo(cs);
    expect(grupos.map((g) => g.titulo)).toEqual(["Otros"]);
    expect(grupos[0].consultas[0].id).toBe("raro");
  });

  it("no muta el arreglo que recibe", () => {
    const cs = [consulta({ id: "a", tipo: "sugerencia" }), consulta({ id: "b", tipo: "error" })];
    agruparPorTipo(cs);
    expect(cs[0].id).toBe("a");
  });

  it("es defensiva ante entradas raras", () => {
    expect(agruparPorTipo(null as unknown as Consulta[])).toEqual([]);
  });

  // DEFECTO ENCONTRADO EN REVISIÓN: un null adentro del arreglo rompía el informe entero.
  it("un elemento nulo no tira abajo todo el informe", () => {
    const cs = [consulta({ id: "a" }), null as unknown as Consulta];
    expect(agruparPorTipo(cs)[0].consultas).toHaveLength(1);
  });
});

describe("informeConsultas", () => {
  it("resuelve el nombre del autor a partir de los perfiles", () => {
    expect(informeConsultas([consulta({ autor: "u2" })], PERFILES, GENERADO)).toContain("Bruno Díaz");
  });

  it("si no conoce al autor, muestra el id en vez de romperse", () => {
    expect(informeConsultas([consulta({ autor: "desconocido" })], PERFILES, GENERADO)).toContain("desconocido");
  });

  it("incluye el texto de la consulta", () => {
    expect(informeConsultas([consulta()], PERFILES, GENERADO)).toContain("No encuentro el botón de imprimir");
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

  it("un texto vacío se dice, no se muestra como un blockquote pelado", () => {
    const md = informeConsultas([consulta({ texto: "" })], PERFILES, GENERADO);
    expect(md).toContain("(sin texto)");
  });

  it("muestra la respuesta cuando ya la hay", () => {
    expect(informeConsultas([consulta({ respuesta: "Está en el menú" })], PERFILES, GENERADO)).toContain("Está en el menú");
  });

  it("marca explícitamente lo que sigue sin responder", () => {
    expect(informeConsultas([consulta({ respuesta: null })], PERFILES, GENERADO)).toMatch(/sin responder/i);
  });

  it("usa las mismas etiquetas de estado que la bandeja de la app", () => {
    // Antes imprimía el valor crudo: la misma consulta era "Leída" en la app y "leida" acá.
    const md = informeConsultas([consulta({ estado: "leida" })], PERFILES, GENERADO);
    expect(md).toContain("Leída");
  });

  it("resume cuántas hay en total y cuántas sin ver", () => {
    const cs = [
      consulta({ id: "a", estado: "nueva" }),
      consulta({ id: "b", estado: "nueva" }),
      consulta({ id: "c", estado: "leida" }),
    ];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("3 en total");
    expect(md).toContain("2 sin ver");
  });

  // El resumen se calcula sobre lo que el informe MUESTRA, no sobre la entrada.
  it("el total del resumen coincide con lo listado, incluso con un tipo desconocido", () => {
    const cs = [consulta({ id: "a" }), consulta({ id: "b", tipo: "pedido" as Consulta["tipo"] })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("2 en total");
    expect(md).toContain("## Otros (1)");
    expect(md).toContain("## Consultas (1)");
  });

  it("agrupa por tipo con un título por grupo", () => {
    const cs = [consulta({ id: "a", tipo: "error" }), consulta({ id: "b", tipo: "sugerencia" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).toContain("## Errores");
    expect(md).toContain("## Sugerencias");
  });

  it("no crea grupos vacíos", () => {
    expect(informeConsultas([consulta({ tipo: "error" })], PERFILES, GENERADO)).not.toContain("## Sugerencias");
  });

  // Encuadre no punitivo: el informe habla de pedidos, no de personas.
  it("no cuenta consultas por persona ni arma ranking de autores", () => {
    const cs = [consulta({ id: "a", autor: "u1" }), consulta({ id: "b", autor: "u1" })];
    const md = informeConsultas(cs, PERFILES, GENERADO);
    expect(md).not.toMatch(/Ana Pérez.*\b2\b.*consultas/i);
    expect(md).not.toMatch(/ranking/i);
  });

  it("sin consultas lo dice, en vez de devolver un archivo vacío", () => {
    expect(informeConsultas([], PERFILES, GENERADO)).toMatch(/no hay consultas/i);
  });

  it("deja la fecha de generación para saber a qué momento corresponde", () => {
    expect(informeConsultas([consulta()], PERFILES, GENERADO)).toContain("2026-07-29");
  });

  // DEFECTO ENCONTRADO EN REVISIÓN: con toISOString(), todo lo mandado después de las 21
  // hora argentina se fechaba al día siguiente, y el "Generado el" salía con fecha futura
  // si el script se corría de noche — que es justo cuando se corrió la primera vez.
  it("fecha en día calendario argentino, no en UTC", () => {
    // 2026-07-29 23:30 en Argentina sigue siendo el 29, aunque en UTC ya sea el 30.
    const cs = [consulta({ created_at: "2026-07-30T02:30:00Z" })];
    const md = informeConsultas(cs, PERFILES, "2026-07-30T01:10:00Z");
    expect(md).toContain("Generado el 2026-07-29");
    expect(md).toContain("· 2026-07-29 ·");
  });

  it("una fecha ausente se dice, en vez de dejar un separador vacío", () => {
    const md = informeConsultas([consulta({ created_at: null as unknown as string })], PERFILES, GENERADO);
    expect(md).toContain("fecha desconocida");
  });

  it("una fecha ilegible se muestra tal cual en vez de romper", () => {
    expect(informeConsultas([consulta({ created_at: "ayer" })], PERFILES, GENERADO)).toContain("ayer");
  });

  it("es defensiva ante entradas raras", () => {
    expect(informeConsultas(null as unknown as Consulta[], PERFILES, GENERADO)).toMatch(/no hay consultas/i);
    expect(informeConsultas([consulta()], null as unknown as PerfilMinimo[], GENERADO)).toContain("u1");
  });
});
