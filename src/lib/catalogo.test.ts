import { describe, it, expect } from "vitest";
import { desdeEstandar, validarEstandar, checklistDesdeTexto, textoDeChecklist, ordenarEstandares } from "./catalogo";
import type { TareaEstandar } from "./types";

function estandar(over: Partial<TareaEstandar> = {}): TareaEstandar {
  return {
    id: "e1",
    nombre: "Conciliación bancaria",
    descripcion: "Cruce del extracto contra el mayor, cuenta por cuenta.",
    checklist: [
      { txt: "Bajar el extracto", done: false, done_at: null },
      { txt: "Cruzar contra el mayor", done: false, done_at: null },
    ],
    categoria: "Conciliaciones",
    effort: 2,
    tiempo_max_horas: 8,
    activa: true,
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("desdeEstandar — qué se copia de la definición a la tarea", () => {
  it("el título y la descripción salen de la definición, que es todo el punto", () => {
    const c = desdeEstandar(estandar(), "juan", "Chevrolet", "Casa Central");
    expect(c.title).toBe("Conciliación bancaria");
    expect(c.description).toBe("Cruce del extracto contra el mayor, cuenta por cuenta.");
  });

  it("guarda de qué definición salió: sin eso no hay nada que comparar después", () => {
    expect(desdeEstandar(estandar({ id: "abc-123" }), "juan", null, null).estandar_id).toBe("abc-123");
  });

  it("copia categoría, esfuerzo y tiempo máximo", () => {
    const c = desdeEstandar(estandar(), "juan", null, null);
    expect(c.categoria).toBe("Conciliaciones");
    expect(c.effort).toBe(2);
    expect(c.tiempo_max_horas).toBe(8);
  });

  it("responsable, marca y sucursal vienen de afuera: la definición no sabe de quién es", () => {
    const c = desdeEstandar(estandar(), "juan", "Chevrolet", "Sucursal Norte");
    expect(c.owner).toBe("juan");
    expect(c.marca).toBe("Chevrolet");
    expect(c.sucursal).toBe("Sucursal Norte");
  });

  // LA PRIORIDAD NO SE ESTANDARIZA, y no es un olvido. Qué es urgente depende del mes, de la
  // marca y de lo que pase esa semana: la misma conciliación puede ser urgente en un cierre y
  // no serlo en el siguiente. Fijarla en la definición pondría a todo el equipo a arrancar por
  // lo mismo aunque no corresponda.
  it("no fija la prioridad ni el estado: eso es de cada tarea, no de la definición", () => {
    const c = desdeEstandar(estandar(), "juan", null, null);
    expect(c.priority).toBeUndefined();
    expect(c.status).toBeUndefined();
    expect(c.due_date).toBeUndefined();
  });

  it("una definición sin categoría ni tiempo máximo no inventa valores", () => {
    const c = desdeEstandar(estandar({ categoria: null, tiempo_max_horas: null }), "juan", null, null);
    expect(c.categoria).toBeNull();
    expect(c.tiempo_max_horas).toBeNull();
  });

  it("el nombre se recorta: un espacio al final no puede ser el título de la tarea", () => {
    expect(desdeEstandar(estandar({ nombre: "  Conciliación  " }), "juan", null, null).title)
      .toBe("Conciliación");
  });
});

// ============================================================
// EL CHECKLIST SE COPIA, NO SE REFERENCIA.
//
// Es la decisión que sostiene todo el catálogo. Si la tarea creada compartiera los objetos del
// checklist con la definición, cambiar la definición cambiaría las tareas YA CERRADAS del mes
// pasado, y el histórico dejaría de reflejar lo que se hizo de verdad: la foto de junio se
// reescribiría sola cada vez que alguien edita un paso en Administración.
//
// La trampa concreta es que `[...e.checklist]` PARECE una copia y no lo es: el arreglo es nuevo
// pero los ítems adentro son los mismos objetos. Tildar un paso en la tarea lo tildaría en la
// definición del catálogo, para todos. Por eso los tests de acá abajo mutan a los dos lados.
// ============================================================
describe("desdeEstandar — el checklist se copia, no se referencia", () => {
  it("tildar un paso en la tarea creada NO toca la definición del catálogo", () => {
    const e = estandar();
    const c = desdeEstandar(e, "juan", null, null);
    c.checklist![0].done = true;
    c.checklist![0].done_at = "2026-08-18T10:00:00Z";
    expect(e.checklist[0].done).toBe(false);
    expect(e.checklist[0].done_at).toBeNull();
  });

  it("editar la definición después NO cambia la tarea ya creada", () => {
    const e = estandar();
    const c = desdeEstandar(e, "juan", null, null);
    e.checklist[0].txt = "Otro paso";
    e.checklist.push({ txt: "Paso agregado el mes que viene", done: false, done_at: null });
    expect(c.checklist).toHaveLength(2);
    expect(c.checklist![0].txt).toBe("Bajar el extracto");
  });

  it("ni el arreglo ni los ítems son los mismos objetos", () => {
    const e = estandar();
    const c = desdeEstandar(e, "juan", null, null);
    expect(c.checklist).not.toBe(e.checklist);
    expect(c.checklist![0]).not.toBe(e.checklist[0]);
  });

  // Una definición puede quedar guardada con pasos tildados (alguien probó, quedó así). La
  // tarea nueva tiene que arrancar en cero igual: nace con trabajo ya hecho, si no.
  it("los pasos arrancan sin tildar aunque la definición los tenga tildados", () => {
    const e = estandar({ checklist: [{ txt: "Bajar el extracto", done: true, done_at: "2026-07-01T00:00:00Z" }] });
    const c = desdeEstandar(e, "juan", null, null);
    expect(c.checklist![0]).toEqual({ txt: "Bajar el extracto", done: false, done_at: null });
  });

  it("una definición sin pasos deja la tarea con checklist vacío, no undefined", () => {
    expect(desdeEstandar(estandar({ checklist: [] }), "juan", null, null).checklist).toEqual([]);
  });

  // Defensivo: `checklist` es jsonb y puede venir con cualquier cosa de una base vieja o de una
  // edición a mano. Que la pantalla de crear tareas se caiga por eso sería peor que perder los
  // pasos sugeridos.
  it("aguanta un checklist que no es arreglo sin romper", () => {
    const roto = estandar({ checklist: null as unknown as TareaEstandar["checklist"] });
    expect(desdeEstandar(roto, "juan", null, null).checklist).toEqual([]);
  });

  it("descarta los pasos sin texto en vez de crear renglones vacíos", () => {
    const e = estandar({ checklist: [{ txt: "  ", done: false, done_at: null }, { txt: "Paso real", done: false, done_at: null }] });
    expect(desdeEstandar(e, "juan", null, null).checklist).toEqual([{ txt: "Paso real", done: false, done_at: null }]);
  });
});

describe("validarEstandar — qué se rechaza antes de mandarlo a la base", () => {
  const base = { nombre: "Conciliación bancaria", descripcion: "", checklist: [], categoria: null, effort: 2 as const, tiempo_max_horas: null };
  const existentes = [estandar({ id: "e1", nombre: "Conciliación bancaria" }), estandar({ id: "e2", nombre: "IVA compras" })];

  it("sin nombre no hay definición", () => {
    expect(validarEstandar({ ...base, nombre: "   " }, [])).toBe("La tarea estándar necesita un nombre.");
  });

  // La base tiene un índice único sobre `lower(nombre)`. Sin este chequeo, el duplicado vuelve
  // como error crudo de Postgres, que no le dice a nadie qué hacer.
  it("un nombre repetido se avisa acá, no con el error crudo de la base", () => {
    expect(validarEstandar({ ...base, nombre: "conciliación BANCARIA" }, existentes))
      .toBe('Ya hay una tarea estándar que se llama "Conciliación bancaria".');
  });

  it("al editar, su propio nombre no cuenta como repetido", () => {
    expect(validarEstandar(base, existentes, "e1")).toBeNull();
  });

  it("un tiempo máximo de cero o negativo no significa nada", () => {
    expect(validarEstandar({ ...base, tiempo_max_horas: 0 }, [])).toBe("El tiempo máximo tiene que ser mayor a cero, o quedar vacío.");
    expect(validarEstandar({ ...base, tiempo_max_horas: -3 }, [])).toBe("El tiempo máximo tiene que ser mayor a cero, o quedar vacío.");
  });

  it("sin tiempo máximo está bien: manda el de la categoría", () => {
    expect(validarEstandar({ ...base, nombre: "Otra cosa", tiempo_max_horas: null }, existentes)).toBeNull();
  });
});

describe("ordenarEstandares — qué se ve primero en la pantalla", () => {
  it("las activas van arriba: las dadas de baja no estorban el uso diario", () => {
    const l = [
      estandar({ id: "1", nombre: "Zeta", activa: true }),
      estandar({ id: "2", nombre: "Alfa", activa: false }),
      estandar({ id: "3", nombre: "Beta", activa: true }),
    ];
    expect(ordenarEstandares(l).map((e) => e.id)).toEqual(["3", "1", "2"]);
  });

  it("dentro de cada grupo, por nombre", () => {
    const l = [estandar({ id: "1", nombre: "IVA compras" }), estandar({ id: "2", nombre: "Conciliación" })];
    expect(ordenarEstandares(l).map((e) => e.id)).toEqual(["2", "1"]);
  });

  it("no muta la lista que recibe", () => {
    const l = [estandar({ id: "1", nombre: "Zeta" }), estandar({ id: "2", nombre: "Alfa" })];
    ordenarEstandares(l);
    expect(l.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("aguanta que no llegue una lista", () => {
    expect(ordenarEstandares(null as unknown as [])).toEqual([]);
  });
});

describe("checklistDesdeTexto / textoDeChecklist — los pasos se editan como texto", () => {
  it("un paso por renglón", () => {
    expect(checklistDesdeTexto("Bajar el extracto\nCruzar contra el mayor")).toEqual([
      { txt: "Bajar el extracto", done: false, done_at: null },
      { txt: "Cruzar contra el mayor", done: false, done_at: null },
    ]);
  });

  it("los renglones vacíos y los espacios sobrantes se descartan", () => {
    expect(checklistDesdeTexto("  Uno  \n\n\n   \nDos\n")).toEqual([
      { txt: "Uno", done: false, done_at: null },
      { txt: "Dos", done: false, done_at: null },
    ]);
  });

  it("texto vacío es checklist vacío, no un paso en blanco", () => {
    expect(checklistDesdeTexto("")).toEqual([]);
    expect(checklistDesdeTexto("   \n  ")).toEqual([]);
  });

  it("aguanta los saltos de línea de Windows", () => {
    expect(checklistDesdeTexto("Uno\r\nDos")).toEqual([
      { txt: "Uno", done: false, done_at: null },
      { txt: "Dos", done: false, done_at: null },
    ]);
  });

  it("ida y vuelta: lo que se guarda es lo que se vuelve a ver al editar", () => {
    const txt = "Bajar el extracto\nCruzar contra el mayor";
    expect(textoDeChecklist(checklistDesdeTexto(txt))).toBe(txt);
  });

  it("un checklist roto o vacío se muestra como texto vacío", () => {
    expect(textoDeChecklist([])).toBe("");
    expect(textoDeChecklist(null as unknown as [])).toBe("");
  });
});
