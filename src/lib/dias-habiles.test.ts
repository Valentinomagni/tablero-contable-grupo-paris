import { describe, it, expect } from "vitest";
import { esHabil, habilesDelMes, diasHabilesEntre } from "./dias-habiles";

// Fechas reales de agosto de 2026, con el día anotado para que dentro de un año nadie tenga que
// abrir un calendario:
//   sábado 8 · domingo 9 · lunes 10 · jueves 13 · viernes 14 · lunes 17 · lunes 31

describe("qué día es hábil", () => {
  it("sábado y domingo no lo son", () => {
    expect(esHabil("2026-08-08", new Set())).toBe(false);
    expect(esHabil("2026-08-09", new Set())).toBe(false);
    expect(esHabil("2026-08-10", new Set())).toBe(true);
  });

  it("un feriado cargado no es hábil aunque caiga día de semana", () => {
    // Lunes 17, cargado como feriado.
    expect(esHabil("2026-08-17", new Set(["2026-08-17"]))).toBe(false);
    // Y el mismo lunes sin cargarlo, para que el test no pase por vacío.
    expect(esHabil("2026-08-17", new Set())).toBe(true);
  });

  it("el día de la semana no se corre por la zona horaria", () => {
    // El mismo motivo que en `recurrencia-ciclo`: `new Date("2026-08-08").getDay()` devuelve el
    // día en la zona LOCAL, y la cadena se parsea como medianoche UTC. En Argentina eso corre
    // todo un día y el sábado pasaría por viernes hábil.
    //
    // Acá el costo del error es directo: un mes tendría 22 días hábiles en vez de 21, y el
    // avance de Patricia daría siempre por debajo.
    expect(esHabil("2026-08-08", new Set())).toBe(false);  // sábado, no viernes
    expect(esHabil("2026-08-09", new Set())).toBe(false);  // domingo, no sábado
    expect(esHabil("2026-08-31", new Set())).toBe(true);   // lunes
  });

  it("una fecha rota no es hábil, y no explota", () => {
    expect(esHabil("no-soy-fecha", new Set())).toBe(false);
    expect(esHabil("", new Set())).toBe(false);
    expect(esHabil("2026-13-45", new Set())).toBe(false);
  });
});

describe("los días hábiles de un mes", () => {
  it("agosto de 2026 tiene 21 hábiles sin feriados", () => {
    // 31 días: 5 sábados (1,8,15,22,29) y 5 domingos (2,9,16,23,30) = 10 no hábiles.
    const dias = habilesDelMes("2026-08", new Set());
    expect(dias).toHaveLength(21);
    expect(dias[0]).toBe("2026-08-03");            // lunes 3, porque el 1 es sábado
    expect(dias[dias.length - 1]).toBe("2026-08-31");
  });

  it("un feriado en día de semana descuenta uno", () => {
    expect(habilesDelMes("2026-08", new Set(["2026-08-17"]))).toHaveLength(20);
  });

  it("un feriado que cae domingo no descuenta nada", () => {
    // Ya no era hábil. Si esto restara, el mes perdería un día que nunca tuvo.
    expect(habilesDelMes("2026-08", new Set(["2026-08-09"]))).toHaveLength(21);
  });

  it("un mes inválido devuelve lista vacía, no explota", () => {
    expect(habilesDelMes("no-es-un-mes", new Set())).toEqual([]);
    expect(habilesDelMes("2026-13", new Set())).toEqual([]);
  });
});

describe("contar días hábiles entre dos fechas", () => {
  it("del lunes al viernes son 5", () => {
    expect(diasHabilesEntre("2026-08-10", "2026-08-14", new Set())).toBe(5);
  });

  it("del viernes al lunes son 2, no 4", () => {
    // ESTE ES EL CASO QUE REPORTÓ VALENTINO. Una tarea entregada el viernes y revisada el lunes
    // hoy figura con 4 días de demora. Dos de esos días la oficina estaba cerrada: contarlos
    // como demora operativa hace que el equipo aparezca más lento de lo que trabajó.
    expect(diasHabilesEntre("2026-08-14", "2026-08-17", new Set())).toBe(2);
  });

  it("el mismo día es 1 si es hábil y 0 si no", () => {
    expect(diasHabilesEntre("2026-08-10", "2026-08-10", new Set())).toBe(1);
    expect(diasHabilesEntre("2026-08-09", "2026-08-09", new Set())).toBe(0);
  });

  it("descuenta los feriados del medio", () => {
    // Lunes 10 a viernes 14, con el miércoles 12 feriado: 4 en vez de 5.
    expect(diasHabilesEntre("2026-08-10", "2026-08-14", new Set(["2026-08-12"]))).toBe(4);
  });

  it("si las fechas vienen al revés devuelve 0, no un negativo", () => {
    // Un negativo se propagaría a un promedio y daría un tiempo de ciclo imposible, que es
    // peor que un cero: el cero se nota, el negativo se promedia.
    expect(diasHabilesEntre("2026-08-17", "2026-08-14", new Set())).toBe(0);
  });

  it("una fecha rota devuelve 0", () => {
    expect(diasHabilesEntre("no-es-fecha", "2026-08-14", new Set())).toBe(0);
    expect(diasHabilesEntre("2026-08-14", "", new Set())).toBe(0);
  });
});
