import { Wallet } from "lucide-react";
import type { Card } from "../../lib/types";
import { useOccurrences } from "../../hooks/useOccurrences";
import { cardsDeControl } from "../../hooks/useArqueo";
import { historialDiferencias, resumenDiferencias } from "../../lib/arqueo";
import { EmptyState } from "../../components/EmptyState";

const cardSh = { boxShadow: "var(--ring),var(--shadow)" };
const fmtMonto = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// Historial personal de diferencias de caja (Task 1, spec28 fase B): para quien tenga
// alguna card de control (requiere_resultado), muestra sus diferencias de arqueo del mes
// en curso. Reusa historialDiferencias/resumenDiferencias (lib/arqueo.ts) — sin lógica propia.
export function MisArqueos({ cards, ownerId }: { cards: Card[]; ownerId: string }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const desdeISO = `${year}-${String(month).padStart(2, "0")}-01`;
  const { data: occs = [] } = useOccurrences(year, month);
  const tengoControl = cardsDeControl(cards).some((c) => c.owner === ownerId);

  const historial = historialDiferencias(occs, ownerId, desdeISO);
  const resumen = resumenDiferencias(historial);

  if (!tengoControl) {
    return (
      <div className="px-6 py-4 w-full max-w-[960px]">
        <EmptyState icon={<Wallet size={22} />} title="No tenés tareas de arqueo asignadas"
          hint="Esta vista es para quien tiene tareas de control (arqueo de caja) a cargo." />
      </div>
    );
  }

  return (
    <div className="px-6 py-4 w-full max-w-[960px] flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight m-0">Mis arqueos</h2>
        <p className="text-ink2 text-sm m-0 capitalize">{now.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5" style={cardSh}>
          <span className="text-2xs uppercase tracking-wide text-ink2">Diferencias del mes</span>
          <b className="text-2xl font-bold tracking-tight tnum">{resumen.cantidad}</b>
        </div>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5" style={cardSh}>
          <span className="text-2xs uppercase tracking-wide text-ink2">Total acumulado</span>
          {/* Magnitud, no neto: faltantes y sobrantes no se cancelan entre sí. */}
          <b className="text-2xl font-bold tracking-tight tnum" style={{ color: resumen.total > 0 ? "var(--warn)" : undefined }}>
            {fmtMonto(resumen.total)}
          </b>
        </div>
        <div className="bg-surface rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5" style={cardSh}>
          <span className="text-2xs uppercase tracking-wide text-ink2">Faltantes / sobrantes</span>
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight tnum">
            {/* En valor absoluto: la etiqueta ya dice cuál es cuál, el menos solo confunde. */}
            <span className="text-danger">{fmtMonto(Math.abs(resumen.faltantes))}</span>
            <span className="text-ink2 font-normal">/</span>
            <span className="text-warn">{fmtMonto(resumen.sobrantes)}</span>
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-2xl p-[18px]" style={cardSh}>
        <h3 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-3.5">Historial de diferencias</h3>
        {historial.length ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-ink2 border-b border-line">
                <th className="font-semibold py-1">Fecha</th>
                <th className="font-semibold py-1 text-right tnum">Importe</th>
                <th className="font-semibold py-1">Observación</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((d, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2 tnum">{d.fecha}</td>
                  <td className={`py-2 text-right tnum ${d.importe < 0 ? "text-danger" : d.importe > 0 ? "text-warn" : ""}`}>
                    {fmtMonto(d.importe)}
                  </td>
                  <td className="py-2 text-ink2">{d.obs ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={<Wallet size={22} />} title="Sin diferencias este mes" hint="Todos tus arqueos cerraron sin diferencias." />
        )}
      </div>
    </div>
  );
}

export default MisArqueos;
