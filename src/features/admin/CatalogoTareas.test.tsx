// Pruebas de la pantalla del catálogo. Se prueba COMPORTAMIENTO: qué ve el jefe y qué se le
// pide a la base cuando aprieta cada botón.
//
// El caso que justifica el archivo es el tercero: dar de baja tiene que ser un `update` con
// `activa: false` y NUNCA un `delete`. Es la clase de cosa que anda igual en la pantalla y sólo
// se nota meses después, cuando el histórico ya no puede decir de dónde salió una tarea.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogoTareas } from "./CatalogoTareas";
import type { TareaEstandar } from "../../lib/types";

const aviso = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast: aviso }));

// Mismo molde que `Board.test.tsx`: los filtros no filtran, el test decide qué ve cada tabla.
const espia = vi.hoisted(() => ({
  update: vi.fn(), insert: vi.fn(), borrar: vi.fn(), filas: {} as Record<string, unknown[]>,
}));
vi.mock("../../lib/supabase", () => {
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "in", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: null, error: null });
    q.insert = async (body: unknown) => { espia.insert(body); return { error: null }; };
    q.upsert = async () => ({ error: null });
    q.update = (body: unknown) => { espia.update(body); return q; };
    q.delete = () => { espia.borrar(tabla); return q; };
    q.then = (r: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: espia.filas[tabla] ?? null, error: null }).then(r);
    return q;
  };
  return { SUPABASE_URL: "https://ejemplo.invalid", supabase: { from: (t: string) => consulta(t) } };
});

function estandar(over: Partial<TareaEstandar> = {}): TareaEstandar {
  return {
    id: "e1", nombre: "Conciliación bancaria", descripcion: "Cruce del extracto contra el mayor.",
    checklist: [{ txt: "Bajar el extracto", done: false, done_at: null }],
    categoria: "Conciliaciones", effort: 2, tiempo_max_horas: 8, activa: true,
    created_at: "2026-08-01T00:00:00Z", ...over,
  };
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><CatalogoTareas /></QueryClientProvider>);
}

beforeEach(() => {
  espia.update.mockClear(); espia.insert.mockClear(); espia.borrar.mockClear();
  aviso.error.mockClear(); aviso.success.mockClear();
  espia.filas = { schema_migrations: [{ id: 55 }], tareas_estandar: [estandar()] };
});
afterEach(() => cleanup());

describe("CatalogoTareas", () => {
  // Sin la migración la tabla no existe y el hook devuelve [], que se vería igual que un
  // catálogo vacío: alguien cargaría definiciones que no se guardan y creería que las perdió.
  it("sin la migración 55 lo dice, en vez de mostrar un catálogo vacío que no guarda nada", async () => {
    espia.filas.schema_migrations = [{ id: 54 }];
    montar();
    expect(await screen.findByText(/migración 55/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nueva tarea estándar/i })).not.toBeInTheDocument();
  });

  it("lista las definiciones cargadas", async () => {
    montar();
    expect(await screen.findByText("Conciliación bancaria")).toBeInTheDocument();
    expect(screen.getByText("Conciliaciones")).toBeInTheDocument();
  });

  it("las dadas de baja siguen a la vista, con su chip", async () => {
    espia.filas.tareas_estandar = [estandar({ id: "e2", nombre: "IVA compras", activa: false })];
    montar();
    expect(await screen.findByText("IVA compras")).toBeInTheDocument();
    expect(screen.getByText(/dada de baja/i)).toBeInTheDocument();
  });

  // EL TEST QUE IMPORTA. Las tareas ya creadas apuntan a la definición: un borrado físico
  // dejaría el histórico sin poder decir de dónde salió cada una.
  it("dar de baja NO borra: manda activa=false y nunca un delete", async () => {
    montar();
    fireEvent.click(await screen.findByTitle(/dar de baja/i));
    await waitFor(() => expect(espia.update).toHaveBeenCalledWith({ activa: false }));
    expect(espia.borrar).not.toHaveBeenCalled();
  });

  it("una definición dada de baja se puede volver a habilitar", async () => {
    espia.filas.tareas_estandar = [estandar({ activa: false })];
    montar();
    fireEvent.click(await screen.findByTitle(/volver a habilitar/i));
    await waitFor(() => expect(espia.update).toHaveBeenCalledWith({ activa: true }));
  });

  // El índice único de la base lo rechazaría igual, pero con el error crudo de Postgres.
  it("un nombre repetido se avisa acá y no se manda a la base", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /nueva tarea estándar/i }));
    fireEvent.change(screen.getByPlaceholderText(/^Nombre \(ej/i), { target: { value: "conciliación BANCARIA" } });
    fireEvent.click(screen.getByRole("button", { name: /^crear$/i }));
    await waitFor(() => expect(aviso.error).toHaveBeenCalledWith('Ya hay una tarea estándar que se llama "Conciliación bancaria".'));
    expect(espia.insert).not.toHaveBeenCalled();
  });

  it("crear manda el nombre, la descripción y los pasos ya convertidos en checklist", async () => {
    espia.filas.tareas_estandar = [];
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /nueva tarea estándar/i }));
    fireEvent.change(screen.getByPlaceholderText(/^Nombre \(ej/i), { target: { value: "  IVA compras  " } });
    fireEvent.change(screen.getByPlaceholderText(/qué incluye esta tarea/i), { target: { value: "Libro de IVA compras del mes." } });
    fireEvent.change(screen.getByPlaceholderText(/uno por renglón/i), { target: { value: "Bajar el libro\n\nCruzar con la DDJJ" } });
    fireEvent.click(screen.getByRole("button", { name: /^crear$/i }));
    await waitFor(() => expect(espia.insert).toHaveBeenCalled());
    expect(espia.insert.mock.calls[0][0]).toMatchObject({
      nombre: "IVA compras",
      descripcion: "Libro de IVA compras del mes.",
      checklist: [
        { txt: "Bajar el libro", done: false, done_at: null },
        { txt: "Cruzar con la DDJJ", done: false, done_at: null },
      ],
      tiempo_max_horas: null,
    });
  });

  // Al editar se ve lo que ya estaba cargado: un formulario en blanco haría borrar la
  // descripción de todos sin querer, con sólo tocar el lápiz y guardar.
  it("editar precarga lo que ya estaba, incluidos los pasos", async () => {
    montar();
    fireEvent.click(await screen.findByTitle("Editar"));
    expect(screen.getByDisplayValue("Conciliación bancaria")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cruce del extracto contra el mayor.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bajar el extracto")).toBeInTheDocument();
  });
});
