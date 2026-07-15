import { describe, it, expect } from "vitest";
import { editarItem, borrarItem } from "./checklist";
const base = [{ txt: "a", done: false, done_at: null }, { txt: "b", done: true, done_at: "x" }];
describe("editarItem", () => {
  it("cambia solo el texto del índice y preserva done", () =>
    expect(editarItem(base, 0, "a2")).toEqual([{ txt: "a2", done: false, done_at: null }, base[1]]));
});
describe("borrarItem", () => {
  it("elimina el índice", () => expect(borrarItem(base, 0)).toEqual([base[1]]));
});
