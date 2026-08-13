// Pruebas del tablero: la pantalla donde, si algo se rompe, nadie trabaja.
//
// Se prueba COMPORTAMIENTO, no implementación: qué ve la persona y qué pasa cuando
// interactúa. Nada de clases de CSS ni estructura de nodos — eso se rompe con cada cambio
// de estilo y no prueba que la app funcione.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Board } from "./Board";
import type { Card } from "../../lib/types";

// Espía de la escritura a la base. Existe por un solo caso: soltar una tarjeta en una columna
// PLEGADA. Ahí no hay nada visible que cambie en el momento, así que sin mirar si se pidió el
// movimiento no se puede distinguir "funcionó" de "no pasó nada" — que es justo el bug a evitar.
const espia = vi.hoisted(() => ({ update: vi.fn() }));

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
    update: (body: unknown) => { espia.update(body); return sinDatos; },
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

beforeEach(() => { localStorage.clear(); espia.update.mockClear(); });
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

// El reporte que originó esto: "el scroll vertical del tablero es interminable".
//
// REGLA QUE PROTEGE: plegar sirve sólo si se cumplen dos cosas, y si falla cualquiera de las
// dos la función se abandona sola. Una: lo que la persona eligió tiene que seguir ahí después
// de recargar — una columna que se abre sola en cada carga enseña que no anda. Dos: el tablero
// tiene que seguir aceptando que le suelten una tarjeta encima de una columna plegada — si
// arrastrás algo ahí y no pasa nada, se deja de plegar.
describe("Board · columnas plegables", () => {
  const suelta = (id: string) => ({ dataTransfer: { getData: () => id, setData: vi.fn() } });

  it("cada columna ofrece plegarse", () => {
    montar([card()]);
    expect(screen.getByTitle("Plegar Pendiente")).toBeInTheDocument();
    expect(screen.getByTitle("Plegar En proceso")).toBeInTheDocument();
    expect(screen.getByTitle("Plegar Terminado")).toBeInTheDocument();
    expect(screen.getByTitle("Plegar Operativas")).toBeInTheDocument();
  });

  // El contador es lo que hace que plegar no sea perder información: se esconde el detalle,
  // no el dato de cuánto hay.
  it("plegada esconde las tarjetas pero deja el título y cuántas hay", () => {
    montar([card(), card({ id: "c2", title: "Libro IVA" })]);
    fireEvent.click(screen.getByTitle("Plegar Pendiente"));
    expect(screen.queryByText("DDJJ IIBB")).toBeNull();
    expect(screen.queryByText("Libro IVA")).toBeNull();
    const col = screen.getByTestId("columna-pend");
    expect(within(col).getByText("Pendiente")).toBeInTheDocument();
    expect(within(col).getByText("2")).toBeInTheDocument();
  });

  it("desplegarla vuelve a mostrar las tareas", () => {
    montar([card()]);
    fireEvent.click(screen.getByTitle("Plegar Pendiente"));
    fireEvent.click(screen.getByTitle("Desplegar Pendiente"));
    expect(screen.getByText("DDJJ IIBB")).toBeInTheDocument();
  });

  it("sigue plegada después de recargar la página", () => {
    montar([card()]);
    fireEvent.click(screen.getByTitle("Plegar Pendiente"));
    cleanup(); // recargar = montar de cero, sin nada en memoria
    montar([card()]);
    expect(screen.queryByText("DDJJ IIBB")).toBeNull();
    expect(screen.getByTitle("Desplegar Pendiente")).toBeInTheDocument();
  });

  it("plegar en un tablero no pliega el de otra persona", () => {
    montar([card()]);
    fireEvent.click(screen.getByTitle("Plegar Pendiente"));
    cleanup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Board cards={[card({ owner: "u2" })]} activity={[]} ownerId="u2" meName="Ana" onOpen={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("DDJJ IIBB")).toBeInTheDocument();
  });

  it("arrastrar por encima de una columna plegada la abre, para ver dónde va a caer", () => {
    montar([card(), card({ id: "c2", status: "term", title: "Cierre de junio" })]);
    fireEvent.click(screen.getByTitle("Plegar Terminado"));
    expect(screen.queryByText("Cierre de junio")).toBeNull();
    fireEvent.dragOver(screen.getByTestId("columna-term"));
    expect(screen.getByText("Cierre de junio")).toBeInTheDocument();
  });

  // Abrirse al pasar por encima es ayuda momentánea, no un cambio de preferencia: pasar
  // arrastrando no es pedir que la columna quede abierta.
  it("al terminar el arrastre vuelve a quedar como la persona la dejó", () => {
    montar([card(), card({ id: "c2", status: "term", title: "Cierre de junio" })]);
    fireEvent.click(screen.getByTitle("Plegar Terminado"));
    const col = screen.getByTestId("columna-term");
    fireEvent.dragOver(col);
    fireEvent.dragEnd(col);
    expect(screen.queryByText("Cierre de junio")).toBeNull();
    expect(screen.getByTitle("Desplegar Terminado")).toBeInTheDocument();
  });

  it("soltar una tarjeta en una columna plegada la mueve igual", async () => {
    montar([card()]);
    fireEvent.click(screen.getByTitle("Plegar Terminado"));
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(espia.update).toHaveBeenCalled());
    expect(espia.update.mock.calls[0][0]).toMatchObject({ status: "term" });
  });
});
