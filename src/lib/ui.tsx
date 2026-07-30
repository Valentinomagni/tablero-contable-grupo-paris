import type { KeyboardEvent } from "react";

export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/** Activa un elemento no nativo con Enter o Espacio, como haría un botón real.
    Vive acá y no copiado en cada vista: es la misma regla de accesibilidad para
    todas las filas y tarjetas que no pueden ser un <button> de verdad (5S/Seiton).
    El preventDefault es obligatorio: sin él, la barra espaciadora además scrollea. */
export function teclaActiva(accion: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); accion(); }
  };
}

// paleta monocromática de marca: escala grafito (negro/gris), sin azul ni arcoíris
const AV_COLORS = ["#18181b", "#27272a", "#3f3f46", "#52525b", "#2a2a2e", "#3a3a40"];
const initials = (n: string) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avColor = (n: string) =>
  AV_COLORS[[...(n || "?")].reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length];

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, background: avColor(name), fontSize: size * 0.42,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.2)" }}
    >
      {initials(name)}
    </span>
  );
}
