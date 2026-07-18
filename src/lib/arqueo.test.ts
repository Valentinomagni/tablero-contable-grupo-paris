import { describe, it, expect } from "vitest";
import { statsArqueo, evolucionMensual } from "./arqueo";
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
