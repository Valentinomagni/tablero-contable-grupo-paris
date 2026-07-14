import type { Profile } from "./types";

export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// paleta monocromática de marca: variaciones del azul Paris — cohesión premium, sin arcoíris
const AV_COLORS = ["#1b3c6f", "#27508d", "#33619f", "#16325c", "#3f72b0", "#0f2647"];
export const initials = (n: string) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const avColor = (n: string) =>
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

export function esc(s: unknown) { return String(s ?? ""); }
export type { Profile };
