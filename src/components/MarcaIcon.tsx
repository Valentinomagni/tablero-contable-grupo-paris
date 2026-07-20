// Glifos monocromos por marca (spec 26 item 7). Deliberadamente NO son los
// logos oficiales (marcas registradas): son monogramas geométricos propios,
// mismo trazo que Lucide (stroke 2, currentColor) para consistencia visual.
import { Building2, Wrench } from "lucide-react";

const MONOGRAMA: Record<string, string> = {
  // letra inicial en un rombo/círculo — dibujadas como <text> centrado
  Peugeot: "P",
  Citroën: "C",
  Chevrolet: "CH",
  Honda: "H",
};

export function MarcaIcon({
  marca,
  size = 18,
}: {
  marca: string;
  size?: number;
}) {
  if (marca === "General")
    return (
      <Building2
        size={size}
        className="text-ink2 shrink-0"
      />
    );
  if (marca === "Postventa")
    return (
      <Wrench
        size={size}
        className="text-ink2 shrink-0"
      />
    );
  const m = MONOGRAMA[marca];
  if (!m)
    return (
      <Building2
        size={size}
        className="text-ink2 shrink-0"
      />
    ); // marca futura: fallback
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="text-ink2 shrink-0"
      aria-hidden
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize={m.length > 1 ? 8.5 : 11}
        fontWeight="700"
        fill="currentColor"
        fontFamily="inherit"
      >
        {m}
      </text>
    </svg>
  );
}
