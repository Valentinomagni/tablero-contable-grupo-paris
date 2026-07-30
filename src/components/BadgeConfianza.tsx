import { cn } from "../lib/ui";
import type { Confianza, NivelConfianza } from "../lib/confianza-metrica";

// Acá el color SÍ comunica estado (de qué se puede fiar el gráfico), no es decoración.
const PUNTO: Record<NivelConfianza, string> = {
  alta: "var(--done)",
  media: "var(--warn)",
  baja: "var(--danger)",
  "sin-datos": "var(--ink2)",
};

/** Chip chico que dice de qué se puede fiar el dato que acompaña. Califica al dato, no a personas. */
export function BadgeConfianza({ confianza, className }: { confianza: Confianza; className?: string }) {
  return (
    <span
      title={confianza.explicacion}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap",
        className,
      )}
      style={{ background: "var(--chip)", borderColor: "var(--line)", color: "var(--ink2)" }}
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: PUNTO[confianza.nivel] }}
      />
      {confianza.rotulo}
    </span>
  );
}
