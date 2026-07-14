import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";

// Contenedor único de modales (Seiton: un solo lugar, un solo comportamiento).
// Overlay con fade + panel con spring sutil; Escape y click afuera cierran.
export function Modal({ onClose, maxWidth = 560, children }: { onClose: () => void; maxWidth?: number; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40"
      style={{ backdropFilter: "blur(3px)" }}>
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        role="dialog" aria-modal
        className="bg-surface border border-line rounded-[18px] w-full max-h-[85vh] overflow-y-auto p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)", maxWidth }}>
        {children}
      </motion.div>
    </motion.div>
  );
}
