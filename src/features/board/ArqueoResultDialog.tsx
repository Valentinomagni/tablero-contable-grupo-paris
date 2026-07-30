import { useState } from "react";
import { importeConSigno } from "../../lib/arqueo";

// Mini-diálogo inline "¿Resultado del arqueo?" para cards de control (requiere_resultado).
// onResolve: "ok" cierra sin diferencias; "dif" cierra con importe + observaciones.
// El importe siempre se tipea en positivo; el usuario indica si "falta" o "sobra" y el
// código le pone el signo (falta → negativo, sobra → positivo) al confirmar.
export function ArqueoResultDialog({ onResolve, onCancel }:
  { onResolve: (r: { resultado: "ok" | "dif"; dif_importe?: number; dif_obs?: string }) => void; onCancel: () => void; }) {
  const [conDif, setConDif] = useState(false);
  const [tipo, setTipo] = useState<"falta" | "sobra" | null>(null);
  const [importe, setImporte] = useState("");
  const [obs, setObs] = useState("");

  const importeNum = Number(importe) || 0;
  const puedeConfirmar = importeNum === 0 || tipo !== null;

  return (
    <div className="border border-accent rounded-lg bg-surface2 p-3 mt-2 text-sm">
      <p className="text-ink2 text-sm m-0 mb-2">¿Resultado del arqueo?</p>
      {!conDif ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onResolve({ resultado: "ok" })}
            className="bg-accent text-[color:var(--accent-ink)] font-semibold rounded-lg px-3 py-1.5 text-sm">Sin diferencias</button>
          <button onClick={() => setConDif(true)}
            className="border border-warn/50 text-warn rounded-lg px-3 py-1.5 text-sm">Con diferencias</button>
          <button onClick={onCancel}
            className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm text-ink2">Cancelar</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo("falta")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${tipo === "falta" ? "bg-warn text-white border-warn" : "border-warn/50 text-warn"}`}>
              Falta
            </button>
            <button type="button" onClick={() => setTipo("sobra")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${tipo === "sobra" ? "bg-accent text-[color:var(--accent-ink)] border-accent" : "border-line text-ink2"}`}>
              Sobra
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">Importe
            <input autoFocus type="number" step="0.01" min={0} value={importe} onChange={(e) => setImporte(e.target.value)}
              placeholder="0.00"
              className="w-32 bg-surface border border-line rounded-lg px-2 py-1 text-ink text-sm tnum" />
          </label>
          <p className="text-ink2 text-xs m-0">Cargá el importe en positivo; arriba indicás si falta o sobra.</p>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observaciones…"
            className="w-full bg-surface border border-line rounded-lg px-2 py-1.5 text-ink text-sm min-h-[48px] resize-y" />
          <div className="flex gap-2">
            <button disabled={!puedeConfirmar}
              onClick={() => onResolve({
                resultado: "dif",
                dif_importe: importeNum === 0 ? 0 : importeConSigno(importeNum, tipo!),
                dif_obs: obs.trim(),
              })}
              className="bg-warn text-white font-semibold rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">Registrar diferencia</button>
            <button onClick={onCancel}
              className="border border-line bg-surface2 rounded-lg px-3 py-1.5 text-sm text-ink2">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
