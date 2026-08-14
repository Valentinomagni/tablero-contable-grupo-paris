import { describe, it, expect } from "vitest";
import { analizarMes } from "./analisis";
import type { Card, Profile, TaskOccurrence, CardArchive } from "./types";

const p = (id: string, role: Profile["role"] = "empleado", marca: string | null = null, sucursal: string | null = null): Profile =>
  ({ id, name: id, role, email: "", username: null, puesto: "", ficha: "", manager_id: null, marca, sucursal });

const c = (id: string, owner: string, extra: Partial<Card> = {}): Card =>
  ({ id, owner, title: id, status: "pend", description: "", checklist: [], comments: [], history: [],
     done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
     card_type: "normal", deps: [], created_at: "2026-07-01", ...extra });

const occ = (id: string, extra: Partial<TaskOccurrence> = {}): TaskOccurrence =>
  ({ id, card_id: "x", owner: "ana", fecha: "2026-07-10", done: true, done_at: "2026-07-10", ...extra });

const arch = (mes: string, card: Card): CardArchive =>
  ({ id: `${mes}-${card.id}`, owner: card.owner, mes, card, archived_at: `${mes}-28` });

/**
 * Fecha de cierre de las cards `term` de los fixtures: 10/07/2026 09:00 hora argentina.
 *
 * POR QUÉ APARECIÓ (hallazgo 3 de la auditoría del 05/08). Estos fixtures ponían `status: "term"`
 * y dejaban `done_at` en null, porque hasta ahora daba igual: `analizarMes` contaba las
 * terminadas sin mirar CUÁNDO se terminaron. Esa es justamente la falla que se corrigió — el
 * cumplimiento subía solo con el paso del tiempo — así que ahora una terminada sin fecha no se
 * puede ubicar en ningún mes y queda afuera.
 *
 * Los asertos numéricos de los tests de abajo NO se tocaron: siguen esperando 75, 50, 25 y 100.
 * Lo que se corrigió es el fixture, que describía un estado que la app no produce (marcar
 * terminada escribe `done_at` en el mismo update: Board.tsx, CardModal.tsx, cierre-rapido.ts).
 * Que los números den igual con el dato bien formado es la comprobación de que la cota temporal
 * no mueve el mes en curso: sólo saca el trabajo de meses anteriores.
 */
const TERM_JUL = "2026-07-10T12:00:00Z";

describe("analizarMes", () => {
  const profiles = [p("jefe", "jefe"), p("ana", "empleado", "Peugeot", "Merlo"), p("bo", "empleado", "Honda", "Pilar")];

  // El título decía "cumplimiento general"; ahora el número es del MES analizado (2026-07) y el
  // título lo dice, porque eso es lo que cambió de significado con el hallazgo 3.
  it("cumplimiento del mes = terminadas en el mes / vivas del mes (excluye operativa)", () => {
    const cards = [
      c("t1", "ana", { status: "term", done_at: TERM_JUL }), c("t2", "ana", { status: "pend" }),
      c("t3", "bo", { status: "term", done_at: TERM_JUL }), c("t4", "bo", { status: "term", done_at: TERM_JUL }),
      c("op", "ana", { status: "pend", card_type: "operativa" }),
    ];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.cumplimiento).toBe(75); // 3 de 4 (operativa excluida)
  });

  it("porMarca usa marca de la card y si no la del dueño", () => {
    const cards = [c("t1", "ana", { status: "term", done_at: TERM_JUL }), c("t2", "bo", { status: "pend" }), c("t3", "ana", { marca: "Honda", status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    const peu = r.porMarca.find((m) => m.marca === "Peugeot")!;
    const hon = r.porMarca.find((m) => m.marca === "Honda")!;
    expect(peu.total).toBe(1); expect(peu.pct).toBe(100);
    expect(hon.total).toBe(2); expect(hon.pct).toBe(0);
  });

  it("porSucursal agrupa por sucursal del dueño", () => {
    const cards = [c("t1", "ana", { status: "term", done_at: TERM_JUL }), c("t2", "bo", { status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.porSucursal.find((s) => s.sucursal === "Merlo")!.pct).toBe(100);
    expect(r.porSucursal.find((s) => s.sucursal === "Pilar")!.pct).toBe(0);
  });

  it("porPersona excluye al jefe y computa term/vencidas/abiertas", () => {
    const cards = [
      c("t1", "ana", { status: "term", done_at: TERM_JUL }), c("t2", "ana", { status: "pend", due_date: "2020-01-01" }),
      c("t3", "bo", { status: "proc" }), c("tj", "jefe", { status: "pend" }),
    ];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.porPersona.some((x) => x.id === "jefe")).toBe(false);
    const ana = r.porPersona.find((x) => x.id === "ana")!;
    expect(ana.total).toBe(2); expect(ana.pct).toBe(50); expect(ana.abiertas).toBe(1); expect(ana.vencidas).toBe(1);
  });

  it("porPersona excluye al perfil centinela 'Sin asignar' y no afecta la mediana de carga", () => {
    const sinAsignar: Profile = { ...p("sinasignar"), email: "sin-asignar@grupoparis.com" };
    const profilesConSinAsignar = [...profiles, sinAsignar];
    const cards = [
      c("t1", "ana", { status: "pend" }),
      c("t2", "sinasignar", { status: "pend" }), c("t3", "sinasignar", { status: "pend" }),
      c("t4", "sinasignar", { status: "pend" }), c("t5", "sinasignar", { status: "pend" }),
    ];
    const r = analizarMes(cards, profilesConSinAsignar, [], [], 2026, 7);
    expect(r.porPersona.some((x) => x.id === "sinasignar")).toBe(false);
    // Sin el fix, sinasignar (4 abiertas) entraría en la mediana junto a ana(1) y bo(0), distorsionándola.
    expect(r.distribucion.medianaAbiertas).toBe(0.5);
  });

  it("distribucion: mediana de abiertas y sobrecargados > 1.5x", () => {
    const many = Array.from({ length: 10 }, (_, i) => c(`a${i}`, "ana", { status: "pend" }));
    const cards = [...many, c("b1", "bo", { status: "pend" })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    // abiertas: ana=10, bo=1 → mediana 5.5; ana(10) > 8.25 → sobrecargado
    expect(r.distribucion.medianaAbiertas).toBe(5.5);
    expect(r.distribucion.sobrecargados).toEqual(["ana"]);
  });

  it("equipo de 1 no marca sobrecargados", () => {
    const cards = [c("a1", "ana", { status: "pend" }), c("a2", "ana", { status: "pend" })];
    const soloAna = [p("jefe", "jefe"), p("ana")];
    const r = analizarMes(cards, soloAna, [], [], 2026, 7);
    expect(r.distribucion.sobrecargados).toEqual([]);
  });

  it("arqueos: cuenta resultado 'dif' del mes y suma dif_importe", () => {
    const occs = [
      occ("o1", { resultado: "dif", dif_importe: 1500 }),
      occ("o2", { resultado: "dif", dif_importe: null }),
      occ("o3", { resultado: "ok", dif_importe: 0 }),
    ];
    const r = analizarMes([], profiles, occs, [], 2026, 7);
    expect(r.arqueos.difs).toBe(2);
    expect(r.arqueos.montoTotal).toBe(1500);
  });

  it("sin difs → montoTotal 0", () => {
    const r = analizarMes([], profiles, [occ("o1", { resultado: "ok" })], [], 2026, 7);
    expect(r.arqueos).toEqual({ difs: 0, montoTotal: 0 });
  });

  it("montoTotal es magnitud: faltantes (negativos) y sobrantes (positivos) no se cancelan", () => {
    const occs = [
      occ("o1", { resultado: "dif", dif_importe: -500 }),
      occ("o2", { resultado: "dif", dif_importe: 300 }),
    ];
    const r = analizarMes([], profiles, occs, [], 2026, 7);
    expect(r.arqueos.difs).toBe(2);
    expect(r.arqueos.montoTotal).toBe(800);
  });

  it("sin archives → delta y promedio null", () => {
    const cards = [c("t1", "ana", { status: "term", done_at: TERM_JUL })];
    const r = analizarMes(cards, profiles, [], [], 2026, 7);
    expect(r.deltaMesAnterior).toBeNull();
    expect(r.promedioHistorico).toBeNull();
  });

  it("deltaMesAnterior compara contra el archivo del mes previo", () => {
    // actual: 1 de 2 = 50%. Mes previo (2026-06): 1 de 4 = 25%. delta = +25
    const cards = [c("t1", "ana", { status: "term", done_at: TERM_JUL }), c("t2", "ana", { status: "pend" })];
    const prev = [
      arch("2026-06", c("h1", "ana", { status: "term" })),
      arch("2026-06", c("h2", "ana", { status: "pend" })),
      arch("2026-06", c("h3", "ana", { status: "pend" })),
      arch("2026-06", c("h4", "ana", { status: "pend" })),
    ];
    const r = analizarMes(cards, profiles, [], prev, 2026, 7);
    expect(r.deltaMesAnterior).toBe(25);
  });

  it("promedioHistorico promedia todos los meses archivados, sin incluir el actual", () => {
    const archives = [
      arch("2026-05", c("m1", "ana", { status: "term" })), // 100%
      arch("2026-06", c("m2", "ana", { status: "term" })), // 50%
      arch("2026-06", c("m3", "ana", { status: "pend" })),
    ];
    const cards = [c("t1", "ana", { status: "pend" })]; // actual 0%, no debe contar
    const r = analizarMes(cards, profiles, [], archives, 2026, 7);
    expect(r.promedioHistorico).toBe(75); // (100 + 50) / 2
  });

  it("enero (mes 1) busca el archivo de diciembre del año previo", () => {
    // La terminada tiene que estar cerrada DENTRO de enero para contar en el mes que se analiza.
    const cards = [c("t1", "ana", { status: "term", done_at: "2026-01-10T12:00:00Z" })]; // 100%
    const prev = [arch("2025-12", c("h1", "ana", { status: "pend" }))]; // 0%
    const r = analizarMes(cards, profiles, [], prev, 2026, 1);
    expect(r.deltaMesAnterior).toBe(100);
  });
});

describe("analizarMes — histórico con el criterio unificado (visibilidad.archivesParaMetricas)", () => {
  it("excluye del histórico a los usuarios ocultos (antes no excluía a nadie)", () => {
    const oculto: Profile = { ...p("fantasma"), email: "admin@grupoparis.com", oculto: true };
    const profiles = [p("ana"), oculto];
    const archives = [
      arch("2026-06", c("h1", "ana", { status: "term" })),
      arch("2026-06", c("h2", "fantasma", { status: "pend" })),
    ];
    const r = analizarMes([], profiles, [], archives, 2026, 7);
    // Sólo cuenta la card de ana: 100%. Con el fantasma adentro daría 50%.
    expect(r.promedioHistorico).toBe(100);
    // 2026-06 es el mes previo a 2026-07: el delta usa esa misma serie ya filtrada
    // (0% del mes en curso, sin cards, contra el 100% de junio).
    expect(r.deltaMesAnterior).toBe(-100);
  });

  it("MANTIENE al centinela 'Sin asignar' en el histórico (huérfanas son trabajo real)", () => {
    const sinAsignar: Profile = { ...p("sin-asignar"), email: "sin-asignar@grupoparis.com" };
    const profiles = [p("ana"), sinAsignar];
    const archives = [
      arch("2026-06", c("h1", "ana", { status: "term" })),
      arch("2026-06", c("h2", "sin-asignar", { status: "pend" })),
    ];
    expect(analizarMes([], profiles, [], archives, 2026, 7).promedioHistorico).toBe(50);
  });
});

// ============================================================
// COTA TEMPORAL DEL MES — hallazgo 3 de la auditoría del 05/08.
//
// `analizarMes` recibía año y mes y los usaba SÓLO para calcular el mes anterior. El
// cumplimiento salía de `terminadas / total` sobre TODAS las cards vivas, sin ninguna cota
// temporal, y las cards se acumulan para siempre (las "una sola vez" no se reinician nunca —
// eso está bien — y la plantilla de cierre crea nuevas cada mes). Resultado: un número que
// sube solo con el paso del tiempo, en la pantalla que el jefe usa para decidir.
// ============================================================
describe("analizarMes — cumplimiento acotado al mes (hallazgo 3 de la auditoría del 05/08)", () => {
  const equipo = [p("jefe", "jefe"), p("ana", "empleado", "Peugeot", "Merlo")];

  it("EL ESCENARIO: 40 terminadas de meses anteriores + 10 abiertas de este mes dan 0%, no 80%", () => {
    // 2 de agosto: el reinicio corrió bien, las 10 recurrentes están en pendiente y nadie hizo
    // nada todavía. Las 40 puntuales de meses anteriores siguen vivas y en "Terminado".
    const viejas = Array.from({ length: 40 }, (_, i) =>
      c(`v${i}`, "ana", { status: "term", done_at: "2026-07-15T12:00:00Z" }));
    const recurrentes = Array.from({ length: 10 }, (_, i) => c(`r${i}`, "ana", { status: "pend" }));
    const r = analizarMes([...viejas, ...recurrentes], equipo, [], [], 2026, 8);
    // Antes de la corrección daba 80 (40 de 50). Nadie hizo nada en agosto: el número honesto es 0.
    expect(r.cumplimiento).toBe(0);
  });

  it("no sube solo: la misma foto un mes más tarde no mejora el número", () => {
    // Las de agosto quedaron terminadas y en septiembre nadie hizo nada todavía.
    const agosto = Array.from({ length: 10 }, (_, i) =>
      c(`a${i}`, "ana", { status: "term", done_at: "2026-08-20T12:00:00Z" }));
    const septiembre = Array.from({ length: 10 }, (_, i) => c(`s${i}`, "ana", { status: "pend" }));
    expect(analizarMes([...agosto, ...septiembre], equipo, [], [], 2026, 9).cumplimiento).toBe(0);
  });

  it("una terminada DENTRO del mes sí cuenta", () => {
    const cards = [
      c("t1", "ana", { status: "term", done_at: "2026-08-05T12:00:00Z" }),
      c("t2", "ana", { status: "pend" }),
    ];
    expect(analizarMes(cards, equipo, [], [], 2026, 8).cumplimiento).toBe(50);
  });

  it("una abierta vieja cuenta igual: sigue siendo trabajo de ahora", () => {
    // Card creada en marzo y todavía sin terminar. No se cae del mes: está abierta hoy, y
    // sacarla del denominador sería otra manera de inflar el número.
    const cards = [
      c("vieja", "ana", { status: "pend", created_at: "2026-03-01" }),
      c("hecha", "ana", { status: "term", done_at: "2026-08-05T12:00:00Z" }),
    ];
    expect(analizarMes(cards, equipo, [], [], 2026, 8).cumplimiento).toBe(50);
  });

  it("el mes se lee en hora ARGENTINA: cerrada el 31/07 a las 21:30 es de julio, no de agosto", () => {
    // 2026-08-01T00:30Z = 31/07 21:30 en Argentina. Con `done_at.slice(0, 7)` —el mes UTC—
    // esta card se leería como de agosto e inflaría el mes que recién arranca. Es el mismo
    // error que el hallazgo 2 de la auditoría; van cinco bugs con la misma causa.
    const tarde = c("tarde", "ana", { status: "term", done_at: "2026-08-01T00:30:00Z" });
    const abierta = c("abierta", "ana", { status: "pend" });
    expect(analizarMes([tarde, abierta], equipo, [], [], 2026, 8).cumplimiento).toBe(0);
    expect(analizarMes([tarde], equipo, [], [], 2026, 7).cumplimiento).toBe(100);
  });

  it("una terminada sin fecha de cierre no se puede ubicar en ningún mes: queda afuera de los dos lados", () => {
    // Anomalía de datos: la app escribe `done_at` en el mismo update que pone "term"
    // (Board.tsx, CardModal.tsx, cierre-rapido.ts). Si igual aparece una, no hay forma honesta
    // de decir de qué mes es; contarla como terminada del mes en curso es justo el bug que se
    // está corrigiendo. Ni numerador ni denominador.
    const cards = [
      c("sinfecha", "ana", { status: "term" }),
      c("abierta", "ana", { status: "pend" }),
    ];
    expect(analizarMes(cards, equipo, [], [], 2026, 8).cumplimiento).toBe(0);
  });

  // --- DECISIÓN (punto 3): la cota se aplica a TODO el análisis, no sólo al cumplimiento ---
  it("la cota alcanza a porMarca, porSucursal y porPersona: las partes cierran con el total", () => {
    const viejas = Array.from({ length: 4 }, (_, i) =>
      c(`v${i}`, "ana", { status: "term", done_at: "2026-07-15T12:00:00Z" }));
    const delMes = [c("d1", "ana", { status: "pend" })];
    const r = analizarMes([...viejas, ...delMes], equipo, [], [], 2026, 8);
    expect(r.cumplimiento).toBe(0);
    expect(r.porMarca.find((m) => m.marca === "Peugeot")).toEqual({ marca: "Peugeot", pct: 0, total: 1 });
    expect(r.porSucursal.find((s) => s.sucursal === "Merlo")).toEqual({ sucursal: "Merlo", pct: 0, total: 1 });
    const ana = r.porPersona.find((x) => x.id === "ana")!;
    expect(ana.total).toBe(1);
    expect(ana.pct).toBe(0);
  });

  it("vencidas y distribución no cambian: ya miraban sólo tareas abiertas", () => {
    const cards = [
      c("v", "ana", { status: "pend", due_date: "2020-01-01" }),
      c("vieja", "ana", { status: "term", done_at: "2026-07-15T12:00:00Z" }),
    ];
    const r = analizarMes(cards, equipo, [], [], 2026, 8);
    expect(r.vencidas).toBe(1);
    expect(r.porPersona.find((x) => x.id === "ana")!.abiertas).toBe(1);
  });

  it("el histórico NO se re-acota: la fila de archivo ya viene con su mes", () => {
    // `cards_archive` es una foto por mes; el campo `mes` es la cota y es la buena. Volver a
    // filtrar por `done_at` ahí borraría meses enteros del promedio histórico.
    const archives = [
      arch("2026-06", c("h1", "ana", { status: "term", done_at: "2026-06-10T12:00:00Z" })),
      arch("2026-06", c("h2", "ana", { status: "pend" })),
    ];
    const r = analizarMes([], equipo, [], archives, 2026, 8);
    expect(r.promedioHistorico).toBe(50);
  });
});
