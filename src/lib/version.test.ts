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
});
