import type { ReactNode } from "react";

// Estado vacío unificado (5S/Seiketsu): misma presentación en todas las vistas.
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-line rounded-xl px-4 py-8 text-center">
      {icon && <div className="mx-auto mb-2 text-ink2 w-fit">{icon}</div>}
      <p className="text-ink font-semibold text-sm m-0">{title}</p>
      {hint && <p className="text-ink2 text-sm m-0 mt-1 max-w-[420px] mx-auto">{hint}</p>}
    </div>
  );
}
