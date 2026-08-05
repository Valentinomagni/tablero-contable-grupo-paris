// Pruebas de "En qué anda el equipo": la pantalla que mira quien conduce.
//
// La mitad de estos tests no verifica que la pantalla funcione — verifica que SIGA SIENDO NO
// PUNITIVA. Esas reglas hoy viven en comentarios, y un comentario no impide que alguien las
// cambie sin darse cuenta de lo que rompe. Cada uno de esos casos dice qué regla protege.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EnQueAnda } from "./EnQueAnda";
import type { Card, Profile } from "../../lib/types";

afterEach(cleanup);

function persona(over: Partial<Profile> = {}): Profile {
  return {
    id: "p1", name: "Ana", role: "empleado", email: "ana@paris.com", username: null,
    puesto: "", ficha: "", manager_id: null, marca: null, ...over,
  };
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "p1", title: "DDJJ IIBB", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 1,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

const jefa = persona({ id: "j1", name: "Jefa", role: "jefe", email: "jefa@paris.com" });

function montar(cards: Card[], team: Profile[]) {
  render(<EnQueAnda cards={cards} team={team} me={jefa} />);
}

/** Días atrás desde ahora, en ISO — para no atarse a una fecha fija del calendario. */
function haceDias(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

describe("EnQueAnda", () => {
  it("lista a cada persona del equipo con lo que tiene abierto", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    const beto = persona({ id: "p2", name: "Beto", email: "beto@paris.com" });
    montar(
      [card({ id: "a", owner: "p1", title: "Conciliación Banco Nación" }),
       card({ id: "b", owner: "p2", title: "Libro IVA compras" })],
      [ana, beto],
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.getByText("Conciliación Banco Nación")).toBeInTheDocument();
    expect(screen.getByText("Libro IVA compras")).toBeInTheDocument();
  });

  it("una tarea terminada ya no figura como abierta", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar([card({ id: "a", owner: "p1", title: "Ya cerrada", status: "term" })], [ana]);
    expect(screen.queryByText("Ya cerrada")).toBeNull();
    expect(screen.getByText("Sin tareas abiertas.")).toBeInTheDocument();
  });

  // REGLA QUE PROTEGE: el orden es ALFABÉTICO, nunca por cantidad.
  // Ordenar por volumen arma un podio aunque no haya números de puesto, y el podio contradice
  // la regla dura del proyecto: las métricas describen situaciones, nunca juzgan personas.
  // Los datos están armados para que el orden por cantidad sea EL INVERSO del alfabético:
  // Ana tiene 1 tarea y Zulema tiene 3. Si alguien cambiara el criterio a "más cargados
  // primero", este test se pondría rojo.
  it("el orden de las personas es alfabético y no por cantidad de tareas", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    const zulema = persona({ id: "p2", name: "Zulema", email: "zulema@paris.com" });
    montar(
      [card({ id: "a", owner: "p1", title: "Una sola" }),
       card({ id: "b", owner: "p2", title: "Tarea uno" }),
       card({ id: "c", owner: "p2", title: "Tarea dos" }),
       card({ id: "d", owner: "p2", title: "Tarea tres" })],
      [zulema, ana], // llegan desordenadas a propósito
    );
    const nombres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(nombres).toEqual(["Ana", "Zulema"]);
  });

  // REGLA QUE PROTEGE: quien no tiene nada abierto aparece IGUAL que los demás, sin destaque
  // ni color de alarma. Un tablero vacío puede ser una licencia, alguien que cerró todo, o
  // alguien que no está cargando su trabajo: el dato es ambiguo y se muestra como lo que es.
  // Si alguien agregara un "0 tareas" en rojo o un cartel de atención, esto se pone rojo.
  it("quien no tiene nada abierto aparece sin destaque ni color de alarma", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    const beto = persona({ id: "p2", name: "Beto", email: "beto@paris.com" });
    montar([card({ id: "a", owner: "p1", title: "Algo abierto" })], [ana, beto]);

    // Beto aparece, igual que Ana.
    expect(screen.getByText("Beto")).toBeInTheDocument();

    const tarjetaBeto = screen.getByText("Beto").closest("div")!.parentElement!;
    const texto = tarjetaBeto.textContent ?? "";
    // Ni palabras de alarma ni signos de admiración.
    expect(texto).not.toMatch(/atenci[oó]n|alerta|inactiv|sin trabajo|ocios|nada que hacer|!/i);
    // Ni el color de peligro o de aviso, que es como se destacaría visualmente.
    expect(tarjetaBeto.innerHTML).not.toMatch(/danger|--warn|text-warn/);
    // Y no se le pone un contador de cero, que es la forma más fácil de armar la comparación.
    expect(texto).not.toMatch(/\b0\b/);
  });

  // REGLA QUE PROTEGE: el encuadre va a la VISTA, no a un tooltip. Un texto escondido no
  // encuadra nada — la línea visible es lo único que evita que la lista se lea como una nota
  // de desempeño. Se verifica que esté en el contenido de la pantalla, no en un `title`.
  it("la línea de encuadre está visible en pantalla, no escondida en un tooltip", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar([card({ id: "a", owner: "p1" })], [ana]);
    const encuadre = screen.getByText(/no mide desempeño/i);
    expect(encuadre).toBeInTheDocument();
    expect(encuadre.textContent).toMatch(/repartir la carga|dar una mano/i);
  });

  // REGLA QUE PROTEGE: cuando algo lleva días sin moverse, el texto habla de LA TAREA, no de
  // la persona. "Libro IVA lleva 8 días sin moverse" le sirve igual a quien conduce y no
  // afirma que alguien haya fallado.
  it("una tarea sin moverse hace días se señala por la tarea, no por la persona", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar(
      [card({ id: "a", owner: "p1", title: "Libro IVA", status: "proc", proc_at: haceDias(8) })],
      [ana],
    );
    const aviso = screen.getByText(/sin moverse/i);
    expect(aviso.textContent).toMatch(/^Libro IVA lleva \d+ días sin moverse\./);
    // El nombre de la persona no aparece en el aviso: el sujeto de la frase es la tarea.
    expect(aviso.textContent).not.toMatch(/Ana/);
  });

  // REGLA QUE PROTEGE: sin fecha de inicio no se escribe ningún número de días. Que una tarea
  // no tenga `proc_at` no dice nada sobre quien la tiene, así que poner "sin iniciar" o un
  // contador sería afirmar lo que no se sabe.
  it("sin fecha de inicio no se escribe ningún número de días", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar([card({ id: "a", owner: "p1", title: "Sin arrancar", proc_at: null })], [ana]);
    expect(screen.getByText("Sin arrancar")).toBeInTheDocument();
    expect(screen.queryByText(/desde hace/i)).toBeNull();
    expect(screen.queryByText(/sin iniciar/i)).toBeNull();
  });

  it("cuando una tarea está en proceso sí dice desde hace cuánto", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar(
      [card({ id: "a", owner: "p1", title: "En marcha", status: "proc", proc_at: haceDias(2) })],
      [ana],
    );
    expect(screen.getByText(/desde hace 2 días/i)).toBeInTheDocument();
  });

  it("resume cuántas tiene abiertas y cuántas en proceso", () => {
    const ana = persona({ id: "p1", name: "Ana", email: "ana@paris.com" });
    montar(
      [card({ id: "a", owner: "p1", title: "Una", status: "proc", proc_at: haceDias(1) }),
       card({ id: "b", owner: "p1", title: "Otra" })],
      [ana],
    );
    const tarjeta = screen.getByText("Ana").closest("div")!.parentElement!;
    expect(within(tarjeta).getByText(/2 abiertas · 1 en proceso/)).toBeInTheDocument();
  });

  it("sin equipo lo dice en vez de mostrar una pantalla vacía", () => {
    montar([], []);
    expect(screen.getByText(/todavía no hay personas en tu equipo/i)).toBeInTheDocument();
  });
});
