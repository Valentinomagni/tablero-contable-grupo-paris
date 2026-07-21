// Verificación del arrastrar y soltar dentro de un carril: el drop tiene que
// resolver el estado destino de la columna donde se suelta, no el del origen.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Carriles } from "./Carriles";
import { COLS, type Card } from "../../lib/types";
import { PREF, getPref } from "../../lib/prefs";

const card = (id: string, categoria: string | null, status: Card["status"]): Card =>
  ({ id, owner: "u1", title: id, status, description: "", checklist: [], comments: [],
     history: [], done_at: null, due_date: null, recurring: false, priority: "media",
     effort: 1, card_type: "normal", deps: [], created_at: "", categoria, marca: null } as Card);

const cards = [card("a", "Bancos", "pend"), card("b", "Bancos", "term"), card("c", "Impuestos", "proc")];

const renderCard = (c: Card) => (
  <div key={c.id} data-testid={`card-${c.id}`} draggable
    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>{c.title}</div>
);

const dataTransfer = (id: string) => ({ getData: () => id, setData: vi.fn() });

beforeEach(() => { cleanup(); localStorage.clear(); });

describe("Carriles", () => {
  it("dibuja un carril por grupo y reparte las cards por estado", () => {
    render(<Carriles cards={cards} modo="categoria" profiles={[]} columnas={COLS}
      renderCard={renderCard} onDropCard={vi.fn()} />);
    expect(screen.getByText("Bancos")).toBeInTheDocument();
    expect(screen.getByText("Impuestos")).toBeInTheDocument();
    expect(screen.getByTestId("card-a")).toBeInTheDocument();
    expect(screen.getByTestId("card-b")).toBeInTheDocument();
  });

  it("soltar una card en otra columna del mismo carril reporta el estado destino", () => {
    const onDropCard = vi.fn();
    render(<Carriles cards={cards} modo="categoria" profiles={[]} columnas={COLS}
      renderCard={renderCard} onDropCard={onDropCard} />);
    // primer carril (Bancos) → tercera columna (Terminado)
    const colTerm = screen.getByTestId("carril-Bancos-term");
    fireEvent.drop(colTerm, { dataTransfer: dataTransfer("a") });
    expect(onDropCard).toHaveBeenCalledWith("a", "term");
  });

  it("cada columna del carril resuelve su propio estado destino", () => {
    const onDropCard = vi.fn();
    render(<Carriles cards={cards} modo="categoria" profiles={[]} columnas={COLS}
      renderCard={renderCard} onDropCard={onDropCard} />);
    fireEvent.drop(screen.getByTestId("carril-Bancos-pend"), { dataTransfer: dataTransfer("b") });
    fireEvent.drop(screen.getByTestId("carril-Bancos-proc"), { dataTransfer: dataTransfer("b") });
    expect(onDropCard).toHaveBeenNthCalledWith(1, "b", "pend");
    expect(onDropCard).toHaveBeenNthCalledWith(2, "b", "proc");
  });

  it("soltar una card de otro carril no dispara el cambio de estado", () => {
    const onDropCard = vi.fn();
    render(<Carriles cards={cards} modo="categoria" profiles={[]} columnas={COLS}
      renderCard={renderCard} onDropCard={onDropCard} />);
    // "c" es de Impuestos; soltarla en una columna del carril Bancos no debe aceptar el drop.
    fireEvent.drop(screen.getByTestId("carril-Bancos-term"), { dataTransfer: dataTransfer("c") });
    expect(onDropCard).not.toHaveBeenCalled();
  });

  it("la cabecera colapsa el carril y lo persiste en localStorage", () => {
    render(<Carriles cards={cards} modo="categoria" profiles={[]} columnas={COLS}
      renderCard={renderCard} onDropCard={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle("Colapsar carril")[0]);
    expect(screen.queryByTestId("card-a")).not.toBeInTheDocument();
    expect(JSON.parse(getPref(PREF.carrilesColapsados("categoria"))!)).toEqual(["Bancos"]);
  });
});
