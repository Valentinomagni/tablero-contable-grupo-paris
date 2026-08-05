// Pruebas del blanqueo de contraseña: la pantalla donde un bug deja a alguien afuera.
//
// Se prueba comportamiento: qué pasa cuando se aprieta cada botón y qué ve la persona
// cuando la llamada sale bien o sale mal. La red se simula: no se toca Supabase de verdad.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BlanquearClave } from "./BlanquearClave";

// La sesión se lee para mandar el token; acá no hace falta ninguna sesión real.
vi.mock("../../lib/supabase", () => ({
  SUPABASE_URL: "https://ejemplo.invalid",
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
}));

// La clave se fija para poder afirmar que aparece —y sobre todo, que NO aparece cuando la
// llamada falla—. El generador ya tiene sus propios tests; lo que se prueba acá es la
// pantalla, y contra algo aleatorio no se puede afirmar nada.
const CLAVE_FIJA = "PruebaXY23";
vi.mock("../../lib/clave-temporal", async (original) => ({
  ...(await original<typeof import("../../lib/clave-temporal")>()),
  generarClaveTemporal: () => CLAVE_FIJA,
}));

/** Respuesta simulada del Edge Function. */
function stubFetch(res: { ok: boolean; body?: unknown } | Error) {
  const fn = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return { ok: res.ok, json: async () => res.body ?? {} } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function montar() {
  render(<BlanquearClave userId="u9" nombre="Beto" />);
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BlanquearClave", () => {
  // REGLA QUE PROTEGE: es una acción sobre la cuenta de otra persona y la deja sin poder
  // entrar. No puede pasar por un clic al pasar, así que el primer botón NO blanquea nada.
  it("el botón inicial no blanquea nada: primero pide confirmación", () => {
    const fetchSpy = stubFetch({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /sí, blanquear/i })).toBeInTheDocument();
  });

  it("la confirmación dice que la contraseña actual deja de servir", () => {
    stubFetch({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    const aviso = screen.getByText(/deja de servir/i);
    expect(aviso).toBeInTheDocument();
    // Y avisa la consecuencia concreta: hasta que le pases la nueva, no puede entrar.
    expect(aviso.textContent).toMatch(/no va a poder entrar/i);
    expect(aviso.textContent).toMatch(/Beto/);
  });

  it("se puede cancelar y no pasa nada", () => {
    const fetchSpy = stubFetch({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /sí, blanquear/i })).toBeNull();
    expect(screen.getByRole("button", { name: /blanquear contraseña/i })).toBeInTheDocument();
    expect(screen.queryByText(CLAVE_FIJA)).toBeNull();
  });

  // REGLA QUE PROTEGE: la clave se muestra UNA sola vez y no se guarda en ningún lado, así
  // que el texto tiene que pedir que la anoten AHORA. Si el aviso se perdiera, la persona
  // cierra la pantalla y hay que blanquear de nuevo.
  it("tras blanquear, la clave se muestra una vez y el texto pide anotarla", async () => {
    stubFetch({ ok: true, body: {} });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    expect(await screen.findByText(CLAVE_FIJA)).toBeInTheDocument();
    expect(screen.getByText(/anotala ahora/i)).toBeInTheDocument();
    expect(screen.getByText(/no se puede volver a ver/i)).toBeInTheDocument();
    // Y ya no se puede volver a blanquear desde acá sin salir: la pantalla queda en el
    // resultado, no vuelve al botón como si nada hubiera pasado.
    expect(screen.queryByRole("button", { name: /sí, blanquear/i })).toBeNull();
  });

  it("recuerda avisarle a la persona: blanquear sin aviso la deja parada sin entender por qué", async () => {
    stubFetch({ ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    await screen.findByText(CLAVE_FIJA);
    expect(screen.getByText(/pasásela/i)).toBeInTheDocument();
  });

  // EL ASERTO MÁS IMPORTANTE DE ESTE ARCHIVO.
  // Si la llamada falla, la contraseña NO se cambió: mostrar igual una clave dejaría a
  // alguien intentando entrar durante horas con algo que no existe, y culpando a su memoria.
  it("si la llamada falla, se muestra un mensaje entendible y NO se muestra ninguna clave", async () => {
    stubFetch({ ok: false, body: { error: "No tenés permiso para blanquear contraseñas." } });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    expect(await screen.findByText(/no tenés permiso para blanquear/i)).toBeInTheDocument();
    expect(screen.queryByText(CLAVE_FIJA)).toBeNull();
    expect(screen.queryByText(/anotala ahora/i)).toBeNull();
  });

  // Mismo caso, pero cuando ni siquiera hay respuesta (se cortó la red). El mensaje sale de
  // `mensajeUsuario`, así que nunca es el error crudo — y tampoco aparece la clave.
  it("si se corta la red, tampoco se muestra ninguna clave", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /sí, blanquear/i })).toBeEnabled());
    expect(screen.queryByText(CLAVE_FIJA)).toBeNull();
    // Hay un mensaje, y no es la jerga cruda de la librería.
    const msg = screen.getByText(/conexión|internet|volvé a intentar|no se pudo/i);
    expect(msg.textContent).not.toMatch(/Failed to fetch|TypeError/);
  });

  it("si el servidor falla sin explicar, igual se dice algo entendible", async () => {
    stubFetch({ ok: false, body: {} });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    expect(await screen.findByText(/no se pudo blanquear la contraseña/i)).toBeInTheDocument();
    expect(screen.queryByText(CLAVE_FIJA)).toBeNull();
  });

  // Mientras la llamada está en vuelo no se puede disparar dos veces: dos blanqueos seguidos
  // dejarían a la persona con la SEGUNDA clave y a quien la blanqueó mirando la primera.
  it("mientras está generando no se puede volver a confirmar", async () => {
    let resolver: (v: unknown) => void = () => {};
    const pendiente = new Promise((r) => { resolver = r; });
    const fetchSpy = vi.fn(async () => {
      await pendiente;
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchSpy);
    montar();
    fireEvent.click(screen.getByRole("button", { name: /blanquear contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, blanquear/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /generando/i })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /generando/i }));
    resolver(null);
    await screen.findByText(CLAVE_FIJA);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
