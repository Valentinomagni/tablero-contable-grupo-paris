import { Sparkles } from "lucide-react";
import { Modal } from "./Modal";
import { APP_VERSION, CHANGELOG } from "../lib/version";

function fmtFecha(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

// Modal de "Novedades": lista los cambios de la última versión y permite
// desplegar el historial completo del changelog.
export function NovedadesModal({ onClose }: { onClose: () => void }) {
  const [actual, ...resto] = CHANGELOG;
  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div className="flex items-center gap-2.5 mb-1">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent-soft text-accent"><Sparkles size={16} /></span>
        <h2 className="text-lg font-bold tracking-tight m-0">Novedades</h2>
      </div>
      <p className="text-ink2 text-sm m-0 mb-3.5">Versión {APP_VERSION} · {fmtFecha(actual.fecha)}</p>

      <ul className="m-0 mb-4 pl-5 flex flex-col gap-1.5 text-sm list-disc">
        {actual.cambios.map((c, i) => <li key={i}>{c}</li>)}
      </ul>

      {resto.length > 0 && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-ink2 select-none">Ver historial completo</summary>
          <div className="mt-2.5 flex flex-col gap-3">
            {resto.map((e) => (
              <div key={e.version}>
                <p className="m-0 text-sm font-semibold">Versión {e.version} <span className="text-ink2 font-normal">· {fmtFecha(e.fecha)}</span></p>
                <ul className="m-0 mt-1 pl-5 flex flex-col gap-1 text-sm list-disc">
                  {e.cambios.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <button onClick={onClose}
        className="w-full bg-accent text-[color:var(--accent-ink)] rounded-lg px-4 py-2.5 text-sm font-semibold">
        Entendido
      </button>
    </Modal>
  );
}
