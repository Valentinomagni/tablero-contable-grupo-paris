import { useState } from "react";

// Mini-diálogo inline "¿Resultado del arqueo?" para cards de control (requiere_resultado).
// onResolve: "ok" cierra sin diferencias; "dif" cierra con importe + observaciones.
export function ArqueoResultDialog({ onResolve, onCancel }:
  { onResolve: (r: { resultado: "ok" | "dif"; dif_importe?: number; dif_obs?: string }) => void; onCancel: () => void; }) {
  const [conDif, setConDif] = useState(false);
  const [importe, setImporte] = useState("");
  const [obs, setObs] = useState("");

  return (
    <div className="border border-accent rounded-lg bg-surface2 p-3 mt-2 text-sm">
      <p className="text-ink2 text-[13px] m-0 mb-2">¿Resultado del arqueo?</p>
      {!conDif ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onResolve({ resultado: "ok" })}
            className="bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3 py-1.5 text-[13px]">Sin diferencias</button>
          <button onClick={() => setConDif(true)}
            className="border border-warn/50 text-warn rounded-lg px-3 py-1.5 text-[13px]">Con diferencias</button>
          <button onClick={onCancel}
            className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px] text-ink2">Cancelar</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[13px]">Importe
            <input autoFocus type="number" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)}
              placeholder="0.00"
              className="w-32 bg-surface border border-line rounded-lg px-2 py-1 text-ink text-[13px] tnum" />
          </label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observaciones…"
            className="w-full bg-surface border border-line rounded-lg px-2 py-1.5 text-ink text-[13px] min-h-[48px] resize-y" />
          <div className="flex gap-2">
            <button onClick={() => onResolve({ resultado: "dif", dif_importe: Number(importe) || 0, dif_obs: obs.trim() })}
              className="bg-warn text-white font-semibold rounded-lg px-3 py-1.5 text-[13px]">Registrar diferencia</button>
            <button onClick={onCancel}
              className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-[13px] text-ink2">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
