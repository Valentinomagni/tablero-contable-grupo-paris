import { describe, it, expect } from "vitest";
import { radarVencimientos } from "./radar";
import type { Announcement, Card, Vacacion, Profile } from "./types";

function mkAviso(p: Partial<Announcement>): Announcement {
  return {
    id: "a1", kind: "vencimiento", title: "IVA", detail: "",
    due_date: "2026-08-05", created_by: "jefe", created_at: "2026-07-01T00:00:00Z",
    owner_id: "u1", visible_to: [], archivado: false, ...p,
  };
}
function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "Tarea", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: "2026-08-05",
    recurring: false, priority: "media", effort: 1, card_type: "normal", deps: [],
    created_at: "2026-07-01T00:00:00Z", ...p,
  };
}
function mkProfile(p: Partial<Profile>): Profile {
  return {
    id: "u1", name: "Ana", role: "empleado", email: "a@x.com", username: null,
    puesto: "", ficha: "", manager_id: null, marca: null, ...p,
  };
}
function mkVac(p: Partial<Vacacion>): Vacacion {
  return {
    id: "v1", owner: "u1", desde: "2026-08-01", hasta: "2026-08-10", motivo: "Vacaciones",
    reemplazante: null, notas: "", created_by: null, created_at: "2026-07-01T00:00:00Z", ...p,
  };
}

const hoyISO = "2026-07-22";
const profiles = [mkProfile({})];

describe("radarVencimientos", () => {
  it("vencimiento sin card abierta que apunte → riesgo, 'Sin tarea creada'", () => {
    const r = radarVencimientos({ avisos: [mkAviso({})], cards: [], vacaciones: [], profiles, hoyISO });
    expect(r).toHaveLength(1);
    expect(r[0].riesgo).toBe("riesgo");
    expect(r[0].motivo).toMatch(/Sin tarea creada/);
  });

  it("con card en proceso y 10 días → ok", () => {
    const aviso = mkAviso({ due_date: "2026-08-01" });
    const card = mkCard({ owner: "u1", due_date: "2026-08-01", status: "proc" });
    const r = radarVencimientos({ avisos: [aviso], cards: [card], vacaciones: [], profiles, hoyISO: "2026-07-22" });
    expect(r[0].riesgo).toBe("ok");
  });

  it("card en pendiente y ≤ 3 días → atencion", () => {
    const aviso = mkAviso({ due_date: "2026-07-24" });
    const card = mkCard({ owner: "u1", due_date: "2026-07-24", status: "pend" });
    const r = radarVencimientos({ avisos: [aviso], cards: [card], vacaciones: [], profiles, hoyISO: "2026-07-22" });
    expect(r[0].riesgo).toBe("atencion");
  });

  it("responsable de licencia esa fecha → riesgo con motivo de licencia", () => {
    const aviso = mkAviso({ due_date: "2026-08-05", owner_id: "u1" });
    const card = mkCard({ owner: "u1", due_date: "2026-08-05", status: "proc" });
    const vac = mkVac({ owner: "u1", desde: "2026-08-01", hasta: "2026-08-10" });
    const r = radarVencimientos({ avisos: [aviso], cards: [card], vacaciones: [vac], profiles, hoyISO: "2026-07-22" });
    expect(r[0].riesgo).toBe("riesgo");
    expect(r[0].motivo).toMatch(/licencia/i);
  });

  it("vencimiento a 60 días → fuera del horizonte, no aparece", () => {
    const aviso = mkAviso({ due_date: "2026-09-20" });
    const r = radarVencimientos({ avisos: [aviso], cards: [], vacaciones: [], profiles, hoyISO: "2026-07-22" });
    expect(r).toHaveLength(0);
  });

  it("sin responsable asignado → riesgo", () => {
    const aviso = mkAviso({ owner_id: null, due_date: "2026-08-05" });
    const r = radarVencimientos({ avisos: [aviso], cards: [], vacaciones: [], profiles, hoyISO: "2026-07-22" });
    expect(r[0].riesgo).toBe("riesgo");
    expect(r[0].responsable).toBeNull();
  });

  it("avisos vacío → no rompe y devuelve []", () => {
    expect(radarVencimientos({ avisos: [], cards: [], vacaciones: [], profiles, hoyISO })).toEqual([]);
  });

  it("archivado → no aparece", () => {
    const aviso = mkAviso({ archivado: true });
    const r = radarVencimientos({ avisos: [aviso], cards: [], vacaciones: [], profiles, hoyISO });
    expect(r).toHaveLength(0);
  });

  it("kind distinto de vencimiento → no aparece", () => {
    const aviso = mkAviso({ kind: "aviso" });
    const r = radarVencimientos({ avisos: [aviso], cards: [], vacaciones: [], profiles, hoyISO });
    expect(r).toHaveLength(0);
  });
});
