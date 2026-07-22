import { describe, it, expect } from "vitest";
import { statsArqueo, evolucionMensual, historialDiferencias, resumenDiferencias, importeConSigno } from "./arqueo";
import type { TaskOccurrence } from "./types";

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
    expect(r.total).toBe(150);
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
