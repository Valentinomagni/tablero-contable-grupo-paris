import { describe, it, expect } from "vitest";
import { posibleDuplicado, esTareaDeTransferencias, montoValido, textoAviso } from "./transferencias";

const base = { fecha: "2026-08-10", cliente: "Torres SA", cuit: "30712345678", monto: 150000 };

describe("detectar transferencias repetidas", () => {
  it("mismo número de comprobante es duplicado seguro", () => {
    const previas = [{ ...base, nro_comprobante: "ABC-123" }] as never;
    const nueva = { ...base, fecha: "2026-08-11", nro_comprobante: "ABC-123" } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  it("mismo cliente y mismo monto en el mismo mes: avisa", () => {
    // No lo bloquea: puede ser legítimo. Pero Patricia tiene que poder mirarlo.
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, fecha: "2026-08-20", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  it("mismo cliente y monto en OTRO mes no es duplicado", () => {
    // Un abono mensual del mismo importe es lo normal, no un error.
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, fecha: "2026-09-10", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  it("mismo monto de clientes distintos no es duplicado", () => {
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, cliente: "Gómez SRL", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  it("sin previas nunca hay duplicado", () => {
    expect(posibleDuplicado({ ...base, nro_comprobante: "X" } as never, [])).toBeNull();
  });
});

describe("cómo se comparan los datos escritos a mano", () => {
  // El comprobante lo tipea una persona mirando un PDF: espacios de más y mayúsculas
  // distintas son lo normal, y no tienen que hacer pasar dos cargas iguales por distintas.
  it("el comprobante se compara sin espacios ni mayúsculas", () => {
    const previas = [{ ...base, nro_comprobante: "abc 123" }] as never;
    const nueva = { ...base, fecha: "2026-11-02", cliente: "Otro", nro_comprobante: " ABC123 " } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  // Mismo motivo: "Torres S.A." y "torres sa" son el mismo cliente para quien controla.
  it("el cliente se compara sin tildes, puntos ni mayúsculas", () => {
    const previas = [{ ...base, cliente: "Peláez S.A.", nro_comprobante: null }] as never;
    const nueva = { ...base, cliente: "pelaez sa", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).not.toBeNull();
  });

  // Un peso de diferencia es otra transferencia: no se avisa por montos parecidos, porque
  // un aviso que salta de más se empieza a cerrar sin leer y deja de servir para el que sí importa.
  it("un monto distinto por un peso no avisa", () => {
    const previas = [{ ...base, nro_comprobante: null }] as never;
    const nueva = { ...base, monto: 150001, nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  // Los centavos importan: es plata y las conciliaciones cierran al centavo.
  it("los centavos cuentan como diferencia", () => {
    const previas = [{ ...base, monto: 150000.5, nro_comprobante: null }] as never;
    const nueva = { ...base, monto: 150000.51, nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  // Editar una transferencia ya cargada no puede hacer que se avise a sí misma.
  it("una transferencia no es duplicado de sí misma", () => {
    const previas = [{ ...base, id: "t1", nro_comprobante: "ABC-123" }] as never;
    const nueva = { ...base, id: "t1", nro_comprobante: "ABC-123" } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  // Sin comprobante y sin cliente no hay con qué comparar: avisar ahí sería adivinar.
  it("sin cliente ni comprobante no avisa", () => {
    const previas = [{ ...base, cliente: "", nro_comprobante: null }] as never;
    const nueva = { ...base, cliente: "   ", nro_comprobante: null } as never;
    expect(posibleDuplicado(nueva, previas)).toBeNull();
  });

  it("devuelve la transferencia parecida, no un booleano: hay que poder mostrarla", () => {
    const previas = [{ ...base, id: "t9", nro_comprobante: "ABC-123" }] as never;
    const nueva = { ...base, fecha: "2026-08-12", nro_comprobante: "ABC-123" } as never;
    expect(posibleDuplicado(nueva, previas)?.id).toBe("t9");
  });
});

describe("qué tareas muestran el registro de transferencias", () => {
  it("reconoce la categoría escrita de varias formas", () => {
    expect(esTareaDeTransferencias("Transferencias")).toBe(true);
    expect(esTareaDeTransferencias("transferencias de clientes")).toBe(true);
    expect(esTareaDeTransferencias("TRANSFERENCIA")).toBe(true);
    expect(esTareaDeTransferencias("Control de transferencias")).toBe(true);
  });

  it("no se cuela en otras categorías ni sin categoría", () => {
    expect(esTareaDeTransferencias("Bancos")).toBe(false);
    expect(esTareaDeTransferencias("")).toBe(false);
    expect(esTareaDeTransferencias(null)).toBe(false);
    expect(esTareaDeTransferencias(undefined)).toBe(false);
  });
});

describe("el monto que se tipea en el formulario", () => {
  it("acepta coma decimal, que es como se escribe acá", () => {
    expect(montoValido("150000,50")).toBe(150000.5);
    expect(montoValido("150000.50")).toBe(150000.5);
    expect(montoValido(" 1500 ")).toBe(1500);
  });

  it("rechaza vacío, cero, negativos y texto", () => {
    expect(montoValido("")).toBeNull();
    expect(montoValido("0")).toBeNull();
    expect(montoValido("-100")).toBeNull();
    expect(montoValido("mil")).toBeNull();
  });
});

describe("el aviso describe la situación, nunca a la persona", () => {
  it("nombra la transferencia parecida y pregunta, no acusa", () => {
    const previa = { fecha: "2026-08-10", cliente: "Torres SA", monto: 150000, nro_comprobante: "ABC-123" } as never;
    const txt = textoAviso(previa);
    expect(txt).toContain("Torres SA");
    expect(txt).toContain("10/08/2026");
    // Encuadre no punitivo: describe lo cargado, no juzga a quien lo cargó.
    expect(txt).not.toMatch(/error|mal|equivoc|culpa/i);
  });
});
