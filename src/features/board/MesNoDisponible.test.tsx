// Pruebas de lo que se muestra cuando un mes pasado NO se puede mostrar.
//
// Estos casos no verifican que la pantalla "funcione": verifican la REGLA que salió del incidente
// del 02/09. Ese día el equipo abrió agosto, vio 51 pendientes y 0 terminadas, y tres personas
// concluyeron que se había perdido el mes. No se había perdido —157 tareas, 119 terminadas, en el
// archivo— pero una falla se dibujó como un dato prolijo y creíble, y le creyeron.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MesNoDisponible } from "./MesNoDisponible";

afterEach(cleanup);

describe("MesNoDisponible", () => {
  it("dice qué pasó y da un detalle", () => {
    render(<MesNoDisponible titulo="No se pudo cargar este mes" detalle="Puede ser la conexión." />);
    expect(screen.getByText("No se pudo cargar este mes")).toBeInTheDocument();
    expect(screen.getByText("Puede ser la conexión.")).toBeInTheDocument();
  });

  // LA REGLA, y es la que faltaba en agosto: nunca se dibujan tarjetas. Mostrar tareas en blanco
  // sería inventar un mes que nadie guardó — que es exactamente lo que hacía la pantalla vieja.
  it("NO muestra ninguna tarjeta", () => {
    const { container } = render(
      <MesNoDisponible titulo="Este mes no quedó archivado" detalle="No hay una foto de agosto." />,
    );
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/pendiente|terminado/i);
  });

  // MISMO CRITERIO QUE `fallas.ts`: ofrecer "Reintentar" cuando reintentar no puede funcionar es
  // peor que no ofrecer nada. La persona lo aprieta tres veces, ve lo mismo, y concluye que el
  // sistema está roto — cuando el mes simplemente no tiene foto y nunca la va a tener.
  it("sin forma de reintentar, no ofrece el botón", () => {
    render(<MesNoDisponible titulo="Este mes no quedó archivado" detalle="No hay foto." />);
    expect(screen.queryByText("Reintentar")).not.toBeInTheDocument();
  });

  it("cuando reintentar SÍ puede servir, ofrece el botón y funciona", () => {
    const reintentar = vi.fn();
    render(<MesNoDisponible titulo="No se pudo cargar" detalle="Revisá la conexión."
      onReintentar={reintentar} />);
    screen.getByText("Reintentar").click();
    expect(reintentar).toHaveBeenCalledOnce();
  });
});
