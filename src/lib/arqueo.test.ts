import { describe, it, expect } from "vitest";
import { statsArqueo, evolucionMensual, historialDiferencias, resumenDiferencias, importeConSigno, tendenciaDiferencias, textoDiferencia } from "./arqueo";
import type { TaskOccurrence, Profile } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
// Genera `nOk` ocurrencias 'ok' + `nDif` 'dif' + `nPend` sin done, todas del mes dado.
function occsMes(mes: string, nOk: number, nDif = 0, nPend = 0): TaskOccurrence[] {
  const out: TaskOccurrence[] = [];
  let dia = 1;
  const push = (done: boolean, resultado: "ok" | "dif" | null) => {
    out.push({
      id: `${mes}-${dia}`, card_id: "c1", owner: "u1", fecha: `${mes}-${pad(dia)}`,
      done, done_at: done ? "x" : null, resultado,
    });
    dia++;
  };
  for (let i = 0; i < nOk; i++) push(true, "ok");
  for (let i = 0; i < nDif; i++) push(true, "dif");
  for (let i = 0; i < nPend; i++) push(false, null);
  return out;
}

describe("statsArqueo", () => {
  it("30 ok de 31 done → pctOk 96.77 (ejemplo clave del spec)", () => {
    const s = statsArqueo(occsMes("2026-07", 30, 1), "2026-07");
    expect(s.total).toBe(31);
    expect(s.ok).toBe(30);
    expect(s.dif).toBe(1);
    expect(s.pctOk).toBe(96.77);
    expect(s.diasCorrectos).toBe(30);
  });

  it("31 de 31 ok → pctOk 100", () => {
    const s = statsArqueo(occsMes("2026-07", 31), "2026-07");
    expect(s.pctOk).toBe(100);
    expect(s.pctDif).toBe(0);
  });

  it("sin ocurrencias done → pcts 0", () => {
    const s = statsArqueo(occsMes("2026-07", 0, 0, 5), "2026-07");
    expect(s.total).toBe(0);
    expect(s.pctOk).toBe(0);
    expect(s.pctDif).toBe(0);
  });

  it("solo cuenta el mes indicado", () => {
    const occs = [...occsMes("2026-07", 2), ...occsMes("2026-06", 4)];
    expect(statsArqueo(occs, "2026-07").total).toBe(2);
  });
});

describe("evolucionMensual", () => {
  it("devuelve n meses de más viejo a más nuevo", () => {
    const occs = [...occsMes("2026-07", 30, 1), ...occsMes("2026-06", 31)];
    const ev = evolucionMensual(occs, "2026-07", 6);
    expect(ev.length).toBe(6);
    expect(ev[0].mes).toBe("2026-02");
    expect(ev[5].mes).toBe("2026-07");
    expect(ev[5].pctOk).toBe(96.77);
    expect(ev[4].pctOk).toBe(100);
  });

  it("cruza el año hacia atrás", () => {
    const ev = evolucionMensual([], "2026-01", 3);
    expect(ev.map((e) => e.mes)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("historialDiferencias / resumenDiferencias", () => {
  const occ = (id: string, fecha: string, resultado: "ok" | "dif" | null, dif_importe?: number | null, dif_obs?: string | null): TaskOccurrence => ({
    id, card_id: "c1", owner: "u1", fecha, done: true, done_at: "x", resultado, dif_importe, dif_obs: dif_obs ?? null,
  });

  it("sin ocurrencias → historial vacío y resumen en cero", () => {
    const h = historialDiferencias([], "u1", "2026-01-01");
    expect(h).toEqual([]);
    const r = resumenDiferencias(h);
    expect(r).toEqual({ cantidad: 0, total: 0, faltantes: 0, sobrantes: 0 });
  });

  it("solo entran las ocurrencias con resultado 'dif' (las 'ok' se ignoran)", () => {
    const occs = [occ("1", "2026-07-01", "ok", 0), occ("2", "2026-07-02", "dif", -500)];
    const h = historialDiferencias(occs, "u1", "2026-01-01");
    expect(h.length).toBe(1);
    expect(h[0].importe).toBe(-500);
  });

  it("ordena descendente por fecha", () => {
    const occs = [occ("1", "2026-07-01", "dif", -100), occ("2", "2026-07-15", "dif", 200), occ("3", "2026-07-08", "dif", -50)];
    const h = historialDiferencias(occs, "u1", "2026-01-01");
    expect(h.map((x) => x.fecha)).toEqual(["2026-07-15", "2026-07-08", "2026-07-01"]);
  });

  it("importes negativos suman faltantes y positivos suman sobrantes", () => {
    const occs = [occ("1", "2026-07-01", "dif", -100), occ("2", "2026-07-02", "dif", 300), occ("3", "2026-07-03", "dif", -50)];
    const h = historialDiferencias(occs, "u1", "2026-01-01");
    const r = resumenDiferencias(h);
    expect(r.cantidad).toBe(3);
    expect(r.total).toBe(450); // magnitud: 100 + 300 + 50, no el neto (150)
    expect(r.faltantes).toBe(-150);
    expect(r.sobrantes).toBe(300);
  });

  it("dif_importe null cuenta como 0 y no rompe", () => {
    const occs = [occ("1", "2026-07-01", "dif", null)];
    const h = historialDiferencias(occs, "u1", "2026-01-01");
    expect(h[0].importe).toBe(0);
    const r = resumenDiferencias(h);
    expect(r.cantidad).toBe(1);
    expect(r.total).toBe(0);
    expect(r.faltantes).toBe(0);
    expect(r.sobrantes).toBe(0);
  });
});

describe("importeConSigno", () => {
  it("falta → negativo", () => {
    expect(importeConSigno(500, "falta")).toBe(-500);
  });

  it("sobra → positivo", () => {
    expect(importeConSigno(500, "sobra")).toBe(500);
  });

  it("si el usuario ya tipeó negativo, se normaliza con abs antes de aplicar el signo", () => {
    expect(importeConSigno(-500, "falta")).toBe(-500);
    expect(importeConSigno(-500, "sobra")).toBe(500);
  });

  it("cero es cero en cualquier caso", () => {
    expect(importeConSigno(0, "falta")).toBe(0);
    expect(importeConSigno(0, "sobra")).toBe(0);
  });
});

describe("tendenciaDiferencias", () => {
  const perfil = (id: string, name: string, oculto = false): Profile => ({
    id, name, role: "empleado", email: `${id}@x.com`, username: null, puesto: "x", ficha: "1",
    manager_id: null, marca: null, oculto,
  });
  const dif = (id: string, owner: string, fecha: string, importe: number): TaskOccurrence => ({
    id, card_id: "c1", owner, fecha, done: true, done_at: "x", resultado: "dif", dif_importe: importe,
  });

  it("sin ocurrencias → serie vacía y sin reincidentes", () => {
    const r = tendenciaDiferencias([], [perfil("u1", "Ana")]);
    expect(r).toEqual({ serie: [], reincidentes: [] });
  });

  it("una persona con diferencias en 1 solo mes → NO es reincidente", () => {
    const occs = [dif("1", "u1", "2026-07-01", -100), dif("2", "u1", "2026-07-05", 50)];
    const r = tendenciaDiferencias(occs, [perfil("u1", "Ana")]);
    expect(r.reincidentes).toEqual([]);
    expect(r.serie.find((s) => s.mes === "2026-07")).toEqual({ mes: "2026-07", cantidad: 2, total: 150 });
  });

  it("en 3 meses distintos → sí es reincidente, con meses: 3", () => {
    const occs = [
      dif("1", "u1", "2026-05-10", -100),
      dif("2", "u1", "2026-06-10", 200),
      dif("3", "u1", "2026-07-10", -50),
    ];
    const r = tendenciaDiferencias(occs, [perfil("u1", "Ana")]);
    expect(r.reincidentes).toEqual([{ id: "u1", nombre: "Ana", meses: 3, cantidad: 3, total: 350 }]);
  });

  it("la serie respeta mesesAtras y viene ordenada ascendente por mes", () => {
    const occs = [
      dif("1", "u1", "2026-01-05", -10),
      dif("2", "u1", "2026-07-05", -20),
    ];
    const r = tendenciaDiferencias(occs, [perfil("u1", "Ana")], 3);
    expect(r.serie.map((s) => s.mes)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(r.serie[2]).toEqual({ mes: "2026-07", cantidad: 1, total: 20 });
    expect(r.serie[0]).toEqual({ mes: "2026-05", cantidad: 0, total: 0 });
  });

  it("el usuario oculto no aparece ni en la serie ni en reincidentes", () => {
    const occs = [
      dif("1", "oculto1", "2026-05-10", -100),
      dif("2", "oculto1", "2026-06-10", -100),
      dif("3", "u1", "2026-07-10", -30),
    ];
    const r = tendenciaDiferencias(occs, [perfil("u1", "Ana"), perfil("oculto1", "Fantasma", true)]);
    expect(r.reincidentes).toEqual([]);
    expect(r.serie.find((s) => s.mes === "2026-05")).toEqual({ mes: "2026-05", cantidad: 0, total: 0 });
    expect(r.serie.find((s) => s.mes === "2026-07")).toEqual({ mes: "2026-07", cantidad: 1, total: 30 });
  });

  // ESTE TEST EXIGÍA EL PODIO Y SE DIO VUELTA. Se llamaba "ordena reincidentes por meses desc
  // y luego por total desc" y afirmaba `["u2", "u1"]`: Beto arriba de Ana por tener más meses
  // con faltantes de caja, desempatado por MONTO.
  //
  // El monto es justamente el dato que la vista decidió no mostrar al lado de un nombre porque
  // "convierte la tabla en un ranking". Se ocultó la columna y se dejó el criterio de orden,
  // que hace exactamente lo mismo sin que se vea. Y acá estaba escrito como requisito, en
  // verde, blindándolo.
  //
  // Ahora verifica lo contrario: alfabético, Ana antes que Beto, sin importar los números.
  it("no ordena a las personas por sus faltantes de caja", () => {
    const occs = [
      dif("1", "u1", "2026-05-01", -10), dif("2", "u1", "2026-06-01", -10),
      dif("3", "u2", "2026-05-01", -500), dif("4", "u2", "2026-06-01", -500), dif("5", "u2", "2026-07-01", -500),
    ];
    const r = tendenciaDiferencias(occs, [perfil("u1", "Ana"), perfil("u2", "Beto")]);
    expect(r.reincidentes.map((x) => x.id)).toEqual(["u1", "u2"]);
  });
});

describe("textoDiferencia", () => {
  it("negativo → falta, en valor absoluto", () => {
    expect(textoDiferencia(-500)).toBe("falta $500");
  });
  it("positivo → sobra", () => {
    expect(textoDiferencia(500)).toBe("sobra $500");
  });
  it("cero o null → sin diferencia (no rompe)", () => {
    expect(textoDiferencia(0)).toBe("sin diferencia");
    expect(textoDiferencia(null)).toBe("sin diferencia");
  });
  it("nunca imprime el signo menos", () => {
    expect(textoDiferencia(-1250)).not.toMatch(/-/);
  });
});
