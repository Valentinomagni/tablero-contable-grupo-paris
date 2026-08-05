// Pruebas del tablero: la pantalla donde, si algo se rompe, nadie trabaja.
//
// Se prueba COMPORTAMIENTO, no implementación: qué ve la persona y qué pasa cuando
// interactúa. Nada de clases de CSS ni estructura de nodos — eso se rompe con cada cambio
// de estilo y no prueba que la app funcione.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Board } from "./Board";
import type { Card } from "../../lib/types";

// El Board consulta la base al montar (organización, tiempos máximos, migraciones, trigger
// de notificaciones). Acá no se toca Supabase de verdad: se devuelve siempre "sin datos",
// que es el mismo camino que toma la app cuando esas migraciones no están aplicadas.
vi.mock("../../lib/supabase", () => {
  const sinDatos = {
    select: () => sinDatos,
    eq: () => sinDatos,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (r: (v: { data: null; error: null }) => unknown) => Promise.resolve({ data: null, error: null }).then(r),
    insert: async () => ({ error: null }),
    update: () => sinDatos,
  };
  return {
    SUPABASE_URL: "https://ejemplo.invalid",
    supabase: {
      from: () => sinDatos,
      rpc: async () => ({ data: null, error: new Error("sin rpc") }),
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  };
});

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "DDJJ IIBB", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 2,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

function montar(cards: Card[], onOpen = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Board cards={cards} activity={[]} ownerId="u1" meName="Ana" onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Board", () => {
  it("muestra las tareas de la persona", () => {
    montar([card()]);
    expect(screen.getByText("DDJJ IIBB")).toBeInTheDocument();
  });

  it("no muestra las de otra persona", () => {
    montar([card({ owner: "u2", title: "De otro" })]);
    expect(screen.queryByText("De otro")).toBeNull();
  });

  it("abrir una tarea avisa a quien la monta", () => {
    const { onOpen } = montar([card()]);
    fireEvent.click(screen.getByText("DDJJ IIBB"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // REGLA QUE PROTEGE: la tarjeta se abre sin mouse. Es la interacción central de la app y
  // estuvo rota — la tarjeta era un div con onClick, sin foco ni Enter. Un test que sólo
  // hiciera click habría pasado con el bug adentro.
  it("una tarea se abre con Enter", () => {
    const { onOpen } = montar([card()]);
    const tarjeta = screen.getByText("DDJJ IIBB").closest("[role='button'],button")!;
    fireEvent.keyDown(tarjeta, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("una tarea se abre también con la barra espaciadora", () => {
    const { onOpen } = montar([card()]);
    const tarjeta = screen.getByText("DDJJ IIBB").closest("[role='button'],button")!;
    fireEvent.keyDown(tarjeta, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("una tarea vencida se distingue de una que vence lejos", () => {
    // El título no dice "vencida" a propósito: si lo dijera, el aserto podría pasar por el
    // título y no por el aviso, que es lo que se quiere probar.
    montar([card({ id: "a", title: "Libro IVA", due_date: "2020-01-01" })]);
    expect(screen.getByText(/venció/i)).toBeInTheDocument();
  });

  it("una tarea sin vencimiento no habla de fechas", () => {
    montar([card()]);
    expect(screen.queryByText(/venci|vence/i)).toBeNull();
  });

  it("la búsqueda deja sólo lo que coincide", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Board cards={[card(), card({ id: "c2", title: "Conciliación bancaria" })]}
          activity={[]} ownerId="u1" meName="Ana" query="concilia" onOpen={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Conciliación bancaria")).toBeInTheDocument();
    expect(screen.queryByText("DDJJ IIBB")).toBeNull();
  });

  // REGLA QUE PROTEGE: con el mes cerrado el tablero explica POR QUÉ no se puede editar y
  // CÓMO revertirlo. Un tablero que no responde y no dice nada se lee como una app rota.
  it("con el mes cerrado avisa que es de sólo lectura y dónde reabrirlo", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Board cards={[card()]} activity={[]} ownerId="u1" meName="Ana" cerrado onOpen={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/cerrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Cierre/)).toBeInTheDocument();
  });

  it("sin el mes cerrado no aparece el aviso de sólo lectura", () => {
    montar([card()]);
    expect(screen.queryByText(/este mes está cerrado/i)).toBeNull();
  });

  it("una operativa se muestra aparte de las tareas normales", () => {
    montar([card({ id: "op", title: "Pagos a proveedores", card_type: "operativa", status: "proc" })]);
    expect(screen.getByText("Pagos a proveedores")).toBeInTheDocument();
    expect(screen.getByText(/hoy:/)).toBeInTheDocument();
  });

  it("sin tareas no explota ni muestra columnas rotas", () => {
    expect(() => montar([])).not.toThrow();
    expect(screen.getAllByText("Sin tareas acá.").length).toBeGreaterThan(0);
  });
});
