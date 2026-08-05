import { useEffect, type ReactNode } from "react";

// Contenedor único de modales (Seiton: un solo lugar, un solo comportamiento).
// Overlay con fade + panel que entra desplazado; Escape y click afuera cierran.
//
// La animación se hace con dos clases de `index.css` (`fondo-entra`, `modal-entra`) y no con
// la librería `motion`, que costaba 42 kB comprimidos en el arranque de toda la app para
// animar sólo este componente. No había animación de salida que perder: el modal nunca tuvo
// `exit` ni `AnimatePresence`, se desmontaba de golpe igual que ahora.
export function Modal({ onClose, maxWidth = 560, children }: { onClose: () => void; maxWidth?: number; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fondo-entra fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40"
      style={{ backdropFilter: "blur(3px)" }}>
      <div
        role="dialog" aria-modal
        className="modal-entra bg-surface border border-line rounded-[18px] w-full max-h-[85vh] overflow-y-auto p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)", maxWidth }}>
        {children}
      </div>
    </div>
  );
}
