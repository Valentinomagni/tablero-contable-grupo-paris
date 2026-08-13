import { describe, it, expect } from "vitest";
import { tocaHoy, proximoVencimiento, TXT_NUEVO_CICLO } from "./recurrencia-ciclo";
import type { RecurRule } from "./types";

// 2026-08-13 es JUEVES. Se eligió una fecha real y se dejó anotado el día para que, cuando esto
// falle dentro de un año, no haya que abrir un calendario para entender el caso.
//
// La convención de `dias` es la de `getDay()` y la de `extract(dow)` de Postgres: 0=domingo,
// 4=jueves, 6=sábado. Es la MISMA que usa `materializar_mes_recurrentes` (migración 25), y eso
// no es casualidad: si las dos interpretaciones no coincidieran, una tarea se materializaría un
// día y se reactivaría otro.

describe("cuándo vuelve una tarea recurrente", () => {
  it("una semanal de los jueves toca un jueves", () => {
    expect(tocaHoy({ tipo: "semanal", dias: [4] }, "2026-08-13")).toBe(true);
  });

  it("y no toca un miércoles", () => {
    expect(tocaHoy({ tipo: "semanal", dias: [4] }, "2026-08-12")).toBe(false);
  });

  it("una diaria toca todos los días", () => {
    expect(tocaHoy({ tipo: "diaria" }, "2026-08-12")).toBe(true);
    expect(tocaHoy({ tipo: "diaria" }, "2026-08-13")).toBe(true);
  });

  it("una mensual toca sólo su día del mes", () => {
    expect(tocaHoy({ tipo: "mensual", diaMes: 10 }, "2026-08-10")).toBe(true);
    expect(tocaHoy({ tipo: "mensual", diaMes: 10 }, "2026-08-11")).toBe(false);
  });

  it("el día de la semana no se corre por la zona horaria", () => {
    // ESTE ES EL TEST QUE MÁS IMPORTA DE TODOS. `new Date("2026-08-13").getDay()` devuelve el
    // día en la zona LOCAL, y como la cadena se parsea como medianoche UTC, en Argentina
    // (UTC-3) da MIÉRCOLES. Esa confusión ya causó cuatro bugs distintos en este proyecto.
    //
    // Si alguien "simplifica" la implementación usando getDay(), este test se pone en rojo.
    const jueves: RecurRule = { tipo: "semanal", dias: [4] };
    expect(tocaHoy(jueves, "2026-08-13")).toBe(true);   // jueves de verdad
    expect(tocaHoy(jueves, "2026-08-14")).toBe(false);  // viernes
    // Y el domingo, que es el 0 y el que más se presta a un error de índice.
    expect(tocaHoy({ tipo: "semanal", dias: [0] }, "2026-08-16")).toBe(true);
  });

  it("el próximo vencimiento de una semanal salta al siguiente día marcado", () => {
    expect(proximoVencimiento({ tipo: "semanal", dias: [4] }, "2026-08-13")).toBe("2026-08-20");
  });

  it("con varios días por semana toma el más cercano", () => {
    // Lunes (1) y jueves (4). Desde el jueves 13, la próxima es el lunes 17.
    expect(proximoVencimiento({ tipo: "semanal", dias: [1, 4] }, "2026-08-13")).toBe("2026-08-17");
  });

  it("una diaria vence al día siguiente", () => {
    expect(proximoVencimiento({ tipo: "diaria" }, "2026-08-13")).toBe("2026-08-14");
  });

  it("una diaria cruza bien el fin de mes", () => {
    // El 31 de agosto no existe el 32: tiene que saltar a septiembre.
    expect(proximoVencimiento({ tipo: "diaria" }, "2026-08-31")).toBe("2026-09-01");
  });

  it("una mensual salta al mismo día del mes siguiente", () => {
    expect(proximoVencimiento({ tipo: "mensual", diaMes: 10 }, "2026-08-10")).toBe("2026-09-10");
  });

  it("una mensual del 31 en un mes de 30 cae en el último día, no se pierde", () => {
    // Septiembre tiene 30. Si esto devolviera "2026-09-31" la fecha sería inválida y la tarea
    // desaparecería del calendario. Cae el 30: es tarde por un día, pero existe.
    expect(proximoVencimiento({ tipo: "mensual", diaMes: 31 }, "2026-08-31")).toBe("2026-09-30");
  });

  it("una regla rota no reactiva nada", () => {
    // `recur_rule` es jsonb: puede llegar cualquier cosa. Ante la duda NO se reactiva —
    // devolverle a Pendiente una tarea que ya estaba terminada, sin que corresponda, le borra
    // el trabajo hecho a una persona. El costo de equivocarse para este lado es mucho menor.
    expect(tocaHoy(null as never, "2026-08-13")).toBe(false);
    expect(tocaHoy(undefined as never, "2026-08-13")).toBe(false);
    expect(tocaHoy({ tipo: "loquesea" } as never, "2026-08-13")).toBe(false);
    expect(tocaHoy({ tipo: "semanal" }, "2026-08-13")).toBe(false);       // sin `dias`
    expect(tocaHoy({ tipo: "semanal", dias: [] }, "2026-08-13")).toBe(false);
    expect(tocaHoy({ tipo: "mensual" }, "2026-08-13")).toBe(false);       // sin `diaMes`
  });

  it("una fecha rota tampoco reactiva nada", () => {
    expect(tocaHoy({ tipo: "diaria" }, "no-soy-una-fecha")).toBe(false);
    expect(tocaHoy({ tipo: "diaria" }, "")).toBe(false);
    expect(proximoVencimiento({ tipo: "diaria" }, "no-soy-una-fecha")).toBeNull();
  });

  it("sin próximo vencimiento devuelve null, no una cadena vacía", () => {
    expect(proximoVencimiento(null as never, "2026-08-13")).toBeNull();
    expect(proximoVencimiento({ tipo: "semanal", dias: [] }, "2026-08-13")).toBeNull();
  });

  it("el texto del nuevo ciclo no dice 'reabrió'", () => {
    // El índice de retrabajo (`src/lib/retrabajo.ts`) cuenta las reaperturas leyendo el
    // historial. Si el reinicio automático usara el mismo texto, cada ciclo de cada tarea
    // recurrente contaría como una reapertura — y ese número se le muestra al jefe.
    //
    // Una tarea diaria inflaría el retrabajo en 20 puntos por mes, ella sola.
    expect(TXT_NUEVO_CICLO.toLowerCase()).not.toContain("reabr");
    expect(TXT_NUEVO_CICLO.toLowerCase()).toContain("ciclo");
  });
});
