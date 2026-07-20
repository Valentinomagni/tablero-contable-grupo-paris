import { describe, it, expect } from "vitest";
import { APP_VERSION, CHANGELOG } from "./version";

describe("version", () => {
  it("la primera entrada del changelog coincide con APP_VERSION", () => {
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });

  it("ninguna entrada tiene cambios vacíos", () => {
    for (const e of CHANGELOG) {
      expect(e.cambios.length).toBeGreaterThan(0);
      for (const c of e.cambios) expect(c.trim()).not.toBe("");
    }
  });

  it("cada entrada tiene fecha con formato AAAA-MM-DD", () => {
    for (const e of CHANGELOG) expect(e.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("APP_VERSION es siempre la primera entrada del changelog", () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version);
  });

  it("el changelog está ordenado descendente y sin versiones duplicadas", () => {
    const vs = CHANGELOG.map((e) => e.version);
    expect(new Set(vs).size).toBe(vs.length);
    const nums = vs.map((v) => v.split(".").map(Number));
    for (let i = 1; i < nums.length; i++) {
      const [a, b] = [nums[i - 1], nums[i]];
      expect(a[0] * 1e6 + a[1] * 1e3 + a[2]).toBeGreaterThan(b[0] * 1e6 + b[1] * 1e3 + b[2]);
    }
  });
});
