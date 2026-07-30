import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonVista } from "./Skeleton";

describe("Skeleton", () => {
  it("se anuncia como contenido que está cargando, para quien usa lector de pantalla", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[aria-busy="true"]');
    expect(el).toBeTruthy();
  });

  it("queda fuera del árbol accesible: es decoración, no contenido", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("acepta clases para dar la forma del hueco que va a ocupar", () => {
    const { container } = render(<Skeleton className="h-8 w-40" />);
    expect(container.querySelector(".h-8.w-40")).toBeTruthy();
  });

  it("late, para que se lea como espera y no como algo colgado", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".latir")).toBeTruthy();
  });
});

describe("SkeletonVista", () => {
  it("dibuja varios huecos: uno solo no insinúa una pantalla", () => {
    const { container } = render(<SkeletonVista />);
    expect(container.querySelectorAll(".latir").length).toBeGreaterThan(2);
  });

  it("no muestra la palabra Cargando: el esqueleto ya lo dice", () => {
    const { container } = render(<SkeletonVista />);
    expect(container.textContent ?? "").not.toMatch(/cargando/i);
  });
});
