import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { cn } from "../../lib/ui";
import type { ModoAgrupar } from "../../lib/agrupar";
import {
  ORDENES_COLUMNA, ETIQUETA_ORDEN, ETIQUETA_AGRUPAR, vistaActiva,
  type OrdenColumna, type VistaColumna,
} from "../../lib/columna-vista";

const AGRUPACIONES: ModoAgrupar[] = ["ninguno", "categoria", "prioridad", "marca"];

/**
 * Menú de orden y agrupación de UNA columna (spec 28-correcciones, item 7).
 * Cada columna tiene el suyo y son independientes entre sí.
 *
 * El botón se marca con el color de acento cuando la columna tiene alguna preferencia
 * activa, para que se vea de un vistazo que esa columna no está en su orden natural.
 */
export function MenuColumna({ vista, onCambiar, etiqueta }: {
  vista: VistaColumna;
  onCambiar: (v: VistaColumna) => void;
  etiqueta: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activa = vistaActiva(vista);

  // Cerrar al hacer clic afuera o con Escape (mismo comportamiento que el resto de los
  // menús de la app; sin esto el panel queda abierto tapando la columna de al lado).
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAbierto(false); } };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);

  const Opcion = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] flex items-center gap-2 transition",
        activo ? "bg-accent-soft text-accent font-semibold" : "text-ink2 hover:text-ink hover:bg-chip")}>
      <Check size={12} className={activo ? "opacity-100" : "opacity-0"} />
      {children}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        title={`Orden y agrupación de "${etiqueta}"`}
        aria-label={`Orden y agrupación de ${etiqueta}`}
        aria-expanded={abierto}
        className={cn("rounded-md p-1 transition", activa ? "text-accent" : "text-ink2 hover:text-ink")}>
        <SlidersHorizontal size={13} />
      </button>

      {abierto && (
        <div className="absolute right-0 top-7 z-30 w-[190px] bg-surface border border-line rounded-xl p-1.5"
          style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="px-2.5 pt-1 pb-1 text-[10.5px] uppercase tracking-wider text-ink2 font-semibold">Ordenar</div>
          {ORDENES_COLUMNA.map((o: OrdenColumna) => (
            <Opcion key={o} activo={vista.orden === o} onClick={() => onCambiar({ ...vista, orden: o })}>
              {ETIQUETA_ORDEN[o]}
            </Opcion>
          ))}
          <div className="h-px bg-line my-1.5" />
          <div className="px-2.5 pt-1 pb-1 text-[10.5px] uppercase tracking-wider text-ink2 font-semibold">Agrupar</div>
          {AGRUPACIONES.map((a) => (
            <Opcion key={a} activo={vista.agrupar === a} onClick={() => onCambiar({ ...vista, agrupar: a })}>
              {ETIQUETA_AGRUPAR[a]}
            </Opcion>
          ))}
        </div>
      )}
    </div>
  );
}
