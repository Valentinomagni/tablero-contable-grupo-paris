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
const espia = vi.hoisted(() => ({ update: vi.fn(), filas: {} as Record<string, unknown[]> }));

// El aviso que ve la persona. No hay `<Toaster />` montado en estos tests, así que sin esto el
// texto no llega a ningún nodo del DOM y no se puede afirmar nada sobre él. Importa poder
// afirmarlo: cuando el tablero rechaza un movimiento y NO explica por qué, la tarjeta vuelve
// sola a su columna y eso se lee como un bug del arrastre.
const aviso = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast: aviso }));

// El Board consulta la base al montar (organización, tiempos máximos, migraciones, trigger
// de notificaciones). Acá no se toca Supabase de verdad: por defecto se devuelve "sin datos",
// que es el mismo camino que toma la app cuando esas migraciones no están aplicadas.
//
// `espia.filas` es la única excepción, y existe por el arqueo mensual: su contador ("6 de 21")
// sale de DOS tablas —las ocurrencias del mes y los días no laborables— así que sin poder
// devolver filas distintas según la tabla no hay forma de probar que el denominador respeta los
// feriados. Y ése es justo el número que tiene que coincidir con la planilla de Patricia.
vi.mock("../../lib/supabase", () => {
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {};
    // Los filtros no filtran nada: el test decide qué filas ve cada tabla. Alcanza de sobra
    // para probar comportamiento de pantalla, que es lo único que se prueba acá.
    for (const m of ["select", "eq", "gte", "lte", "in", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: null, error: null });
    q.insert = async () => ({ error: null });
    q.upsert = async () => ({ error: null });
    q.update = (body: unknown) => { espia.update(body); return q; };
    q.then = (r: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: espia.filas[tabla] ?? null, error: null }).then(r);
    return q;
  };
  return {
    SUPABASE_URL: "https://ejemplo.invalid",
    supabase: {
      from: (tabla: string) => consulta(tabla),
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

function montar(cards: Card[], onOpen = vi.fn(), extra: { periodo?: string; cerrado?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Board cards={cards} activity={[]} ownerId="u1" meName="Ana" onOpen={onOpen} {...extra} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

beforeEach(() => { localStorage.clear(); espia.update.mockClear(); espia.filas = {}; aviso.error.mockClear(); });
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

  // La tarjeta arranca EN PROCESO y antes arrancaba en Pendiente. No es un detalle de la
  // fixture: desde `transicion.ts`, arrastrar de Pendiente a Terminado es un movimiento
  // INVÁLIDO —saltea En proceso y deja `proc_at` en null, o sea la tarea figura resuelta en
  // cero horas—, así que con la fixture vieja este test ya no probaba lo que dice probar:
  // el update no salía por la regla nueva, no por la columna plegada.
  it("soltar una tarjeta en una columna plegada la mueve igual", async () => {
    montar([card({ status: "proc" })]);
    fireEvent.click(screen.getByTitle("Plegar Terminado"));
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(espia.update).toHaveBeenCalled());
    expect(espia.update.mock.calls[0][0]).toMatchObject({ status: "term" });
  });
});

// El arrastre es el único de los seis caminos que el guardián `transicion.guard.test.ts` NO
// puede ver: escribe `{ status }` desde una variable, nunca el literal `status: "term"`, así
// que la búsqueda por texto no lo encuentra. Por eso su conexión con la regla se prueba acá,
// a mano — si alguien la saca, esto es lo único que se entera.
describe("Board · las dos reglas de estado al arrastrar", () => {
  const suelta = (id: string) => ({ dataTransfer: { getData: () => id, setData: vi.fn() } });

  // El aviso se afirma con el TEXTO, no con "hubo un error": la regla se lanza como
  // `FallaDeUsuario` justamente para que `mensajeUsuario` lo respete. Si mañana vuelve a ser un
  // `Error` pelado, la persona lee "No se pudo mover la tarea" y este aserto lo agarra.
  it("arrastrar de Pendiente a Terminado no guarda nada y explica por qué", async () => {
    montar([card({ status: "pend" })]);
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(aviso.error).toHaveBeenCalledWith(expect.stringMatching(/En proceso/)));
    expect(espia.update).not.toHaveBeenCalled();
  });

  it("con pasos del checklist sin tildar tampoco cierra, aunque venga de En proceso", async () => {
    montar([card({ status: "proc", checklist: [{ txt: "conciliar", done: false, done_at: null }] })]);
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(aviso.error).toHaveBeenCalledWith(expect.stringMatching(/checklist/i)));
    expect(espia.update).not.toHaveBeenCalled();
  });

  it("de En proceso a Terminado, con el checklist completo, guarda", async () => {
    montar([card({ status: "proc", checklist: [{ txt: "conciliar", done: true, done_at: "2026-08-10T12:00:00Z" }] })]);
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(espia.update).toHaveBeenCalled());
    expect(espia.update.mock.calls[0][0]).toMatchObject({ status: "term" });
  });

  // EL MISMO DEFECTO QUE LAS REGLAS DE ESTADO, EN EL OTRO CORTE DE LA MUTACIÓN. El mes cerrado
  // se frenaba con un `Error` pelado, y `mensajeUsuario` sólo respeta el texto de
  // `FallaDeUsuario`: el motivo se perdía y la persona veía "No se pudo mover la tarea" mientras
  // la tarjeta volvía sola a su columna. Sin saber que el mes está cerrado, lo intenta otra vez.
  //
  // Se afirma por el TEXTO —"reabrilo desde Cierre"— y no por "hubo un error", porque es
  // justamente lo que el genérico se lleva puesto.
  it("con el mes cerrado, el aviso al arrastrar dice por qué y dónde reabrirlo", async () => {
    montar([card({ status: "proc" })], vi.fn(), { cerrado: true });
    fireEvent.drop(screen.getByTestId("columna-term"), suelta("c1"));
    await waitFor(() => expect(aviso.error).toHaveBeenCalledWith(expect.stringContaining("reabrilo desde Cierre")));
    expect(espia.update).not.toHaveBeenCalled();
  });
});

// El reporte de Patricia: "hoy se genera una tarea por cada día hábil y la lista es
// interminable". Los arqueos YA se guardaban por día en `task_occurrences` desde la migración
// 23; lo que faltaba era mostrarlos juntos — una sola tarjeta con el avance del mes adentro.
//
// REGLA QUE PROTEGE, y es la que decide si la función sirve: el contador tiene que coincidir
// con lo que ella ve en su planilla. Si "6 de 21" no cierra —porque el denominador cuenta
// sábados, o ignora un feriado— la tarjeta es PEOR que no tenerla: un número que no cierra
// hace que se deje de creer también el resto del tablero.
describe("Board · arqueo mensual", () => {
  const arqueo = (over: Partial<Card> = {}) => card({
    id: "arq", title: "Arqueo de caja", status: "proc",
    recur_rule: { tipo: "diaria" }, requiere_resultado: true, ...over,
  });

  // Agosto de 2026 tiene 21 días hábiles (31 días, 10 entre sábados y domingos). Seis hechos.
  const HECHOS = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10"];
  const ocurrencias = (fechas: string[]) =>
    fechas.map((fecha, i) => ({ id: `o${i}`, card_id: "arq", owner: "u1", fecha, done: true, done_at: null }));

  // El mes se fija con `periodo` y no se deja al reloj: un test cuyo resultado cambia según el
  // día en que se corre no prueba nada, y encima falla solo un martes cualquiera.
  const enAgosto = (cards: Card[], onOpen = vi.fn()) => montar(cards, onOpen, { periodo: "2026-08" });

  // El avance llega de DOS consultas asincrónicas (las ocurrencias del mes y los feriados), así
  // que hay que esperarlo. Los tiempos largos —acá y en el `timeout` de cada `it`— no tapan
  // ningún bug: con la suite entera corriendo, el primer montaje de esta pantalla tarda bastante
  // más que los siguientes, y con el segundo por defecto esto fallaba una vez cada tantas. Un
  // test que falla cuando la máquina está cargada se termina borrando por molesto, y ahí se
  // pierde la protección entera. Mismo criterio que los guardianes de `src/lib`.
  const LENTO = { timeout: 30_000 };
  const esperar = (txt: RegExp | string) => screen.findByText(txt, {}, { timeout: 10_000 });

  it("el mes entero se ve en UNA tarjeta, no en una por día", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    enAgosto([arqueo()]);
    expect(await esperar(/6 de 21/)).toBeInTheDocument();
    expect(screen.getAllByText("Arqueo de caja")).toHaveLength(1);
    // Los días viven ADENTRO de la tarjeta: el tablero no se llena de tarjetas iguales.
    expect(screen.queryByTitle(/2026-08-03/)).toBeNull();
  });

  it("un feriado no cuenta en el total, aunque el mes tenga ese día", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    espia.filas.dias_no_laborables = [{ fecha: "2026-08-17", motivo: "Paso a la Inmortalidad" }];
    enAgosto([arqueo()]);
    // 21 hábiles menos el feriado. Si acá dijera 21, el avance de todo el equipo daría por
    // debajo de lo real cada mes que tenga feriado — que en Argentina son casi todos.
    expect(await esperar(/6 de 20/)).toBeInTheDocument();
  });

  it("al abrirla aparecen los días del mes", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    enAgosto([arqueo()]);
    await esperar(/6 de 21/);
    fireEvent.click(screen.getByText("Ver los días"));
    expect(screen.getByTitle(/2026-08-04/)).toBeInTheDocument();
    expect(screen.getByTitle(/2026-08-31/)).toBeInTheDocument();
  });

  // Las dos cosas que la vuelven inútil si se rompen: si no se arrastra, deja de ser una
  // tarjeta del tablero; si no se abre, no se llega al detalle de la tarea.
  it("se arrastra a otra columna como cualquier otra tarjeta", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    enAgosto([arqueo()]);
    await esperar(/6 de 21/);
    fireEvent.drop(screen.getByTestId("columna-term"), { dataTransfer: { getData: () => "arq", setData: vi.fn() } });
    await waitFor(() => expect(espia.update).toHaveBeenCalled(), { timeout: 10_000 });
    expect(espia.update.mock.calls[0][0]).toMatchObject({ status: "term" });
  });

  it("se abre con el mouse y con el teclado, como cualquier otra tarjeta", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    const { onOpen } = enAgosto([arqueo()]);
    const titulo = await esperar("Arqueo de caja");
    fireEvent.click(titulo);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(titulo.closest("[role='button']")!, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  // Marcar el arqueo de un día y abrir la tarea son dos intenciones distintas. Si tocar un día
  // abriera la tarjeta, registrar el arqueo sería imposible sin pelearse con la pantalla.
  it("tocar un día registra el arqueo y no abre la tarea", LENTO, async () => {
    espia.filas.task_occurrences = ocurrencias(HECHOS);
    const { onOpen } = enAgosto([arqueo({ requiere_resultado: false })]);
    await esperar(/6 de 21/);
    fireEvent.click(screen.getByText("Ver los días"));
    fireEvent.click(screen.getByTitle(/2026-08-04/));
    await waitFor(() => expect(espia.update).toHaveBeenCalled(), { timeout: 10_000 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("una tarea que no se hace todos los días no habla de días hábiles", () => {
    enAgosto([card()]);
    expect(screen.queryByText(/días hábiles/)).toBeNull();
  });
});
