// Pruebas del panel "Esperando a otras áreas".
//
// Dos de estos casos no verifican que la pantalla funcione: verifican DECISIONES DE DISEÑO que
// hoy sólo viven en comentarios. Un comentario no impide que alguien las cambie sin darse cuenta
// de lo que rompe.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Card } from "../../lib/types";

// El hook de feriados va contra Supabase. Acá sólo importa que devuelva un Set: el cálculo de
// días hábiles ya está probado en `dias-habiles.test.ts` y `bloqueo-area.test.ts`.
vi.mock("../../hooks/useData", () => ({ useDiasNoLaborables: () => new Set<string>() }));

const { EsperasExternas } = await import("./EsperasExternas");

afterEach(cleanup);

// Lunes 17/08/2026. Fechas reales, con el día anotado, como en el resto del proyecto.
const HOY = "2026-08-17T12:00:00Z";

function card(over: Partial<Card> = {}): Card {
  return {
    id: "c1", owner: "u1", title: "Conciliación Chevrolet", status: "proc", description: "",
    checklist: [], comments: [], history: [], done_at: null, proc_at: null,
    due_date: null, recurring: false, priority: "media", effort: 1,
    card_type: "normal", deps: [], created_at: "2026-08-01T09:00:00Z", ...over,
  };
}

const trabada = (id: string, area: string, desde: string, over: Partial<Card> = {}) =>
  card({ id, bloqueo_area: area, bloqueo_desde: desde, ...over });

describe("Esperando a otras áreas", () => {
  it("muestra el área, cuántas son y hace cuánto la más vieja", () => {
    render(<EsperasExternas cards={[
      trabada("a", "Ventas", "2026-08-07T15:00:00Z"),   // viernes 7 → 6 hábiles
      trabada("b", "Ventas", "2026-08-14T09:00:00Z"),
    ]} hoyISO={HOY} onOpenCard={() => {}} />);

    expect(screen.getByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText(/2 tareas/)).toBeInTheDocument();
    expect(screen.getByText(/la más vieja hace 6 días/)).toBeInTheDocument();
  });

  // DECISIÓN DE DISEÑO, no un caso borde. Un panel que dice "no hay esperas" ocupa el mismo lugar
  // que uno con información y entrena a saltearlo. Si nada está trabado, esto no existe.
  it("no se dibuja nada cuando no hay ninguna tarea trabada", () => {
    const { container } = render(
      <EsperasExternas cards={[card()]} hoyISO={HOY} onOpenCard={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // LA OTRA DECISIÓN: ordenado por la espera MÁS VIEJA, no por cantidad. Cuatro tareas de dos
  // días son ruido normal; una sola parada hace dos semanas es el problema. Ordenar por cantidad
  // escondería justo eso, que es lo único que amerita levantar el teléfono.
  it("primero el área con la espera más vieja, aunque tenga menos tareas", () => {
    render(<EsperasExternas cards={[
      trabada("a", "Ventas", "2026-08-14T09:00:00Z"),
      trabada("b", "Ventas", "2026-08-14T09:00:00Z"),
      trabada("c", "Ventas", "2026-08-14T09:00:00Z"),
      trabada("z", "Sistemas", "2026-08-03T09:00:00Z"),
    ]} hoyISO={HOY} onOpenCard={() => {}} />);

    const areas = screen.getAllByText(/^(Ventas|Sistemas)$/).map((n) => n.textContent);
    expect(areas[0]).toBe("Sistemas");
  });

  it("una tarea terminada ya no espera a nadie", () => {
    const { container } = render(
      <EsperasExternas
        cards={[trabada("a", "Ventas", "2026-08-10T09:00:00Z", { status: "term" })]}
        hoyISO={HOY} onOpenCard={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("las tareas se pueden abrir desde el panel", () => {
    // Un panel que informa y no deja hacer nada es la mitad de un panel: quien lo lee tendría
    // que ir a buscar la tarea a mano en el tablero.
    const abiertas: string[] = [];
    render(<EsperasExternas cards={[trabada("a", "Ventas", "2026-08-10T09:00:00Z")]}
      hoyISO={HOY} onOpenCard={(c) => abiertas.push(c.id)} />);
    screen.getByText("Conciliación Chevrolet").click();
    expect(abiertas).toEqual(["a"]);
  });

  it("no nombra a ninguna persona", () => {
    // ENCUADRE NO PUNITIVO: esto describe dónde está trabado el PROCESO, no quién tiene tareas
    // trabadas. Agrupar por persona convertiría el panel en un ranking encubierto.
    const { container } = render(<EsperasExternas
      cards={[trabada("a", "Ventas", "2026-08-10T09:00:00Z", { owner: "u1" })]}
      hoyISO={HOY} onOpenCard={() => {}} />);
    expect(container.textContent).not.toContain("u1");
  });
});
