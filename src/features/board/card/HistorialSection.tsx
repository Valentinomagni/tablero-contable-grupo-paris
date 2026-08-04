import { useState } from "react";
import { type Card } from "../../../lib/types";
import { fmtDateTime } from "../../../lib/metrics";
import { historialDePeriodo, periodosConHistorial, esRuidoDeReinicio } from "../../../lib/historial-periodo";
import { periodoLabel, periodoVigente } from "../../../lib/periodo-instancias";

// El historial de la tarea, acotado AL MES QUE SE ESTÁ MIRANDO.
//
// POR QUÉ. `cards.history` acumula desde que la tarea existe. En agosto se veía
// "HISTORIAL (8)" con entradas de julio y agosto mezcladas, y no había forma de responder la
// pregunta que importa: "¿qué se hizo con esto en julio?". Los otros meses no se pierden:
// quedan a un click en la línea del pie.
//
// Es un cambio de LECTURA: no se toca cómo se escribe el historial ni se borra ninguna entrada.

/** "Agosto 2026" -> "agosto 2026", para que quede natural dentro de una oración. */
function enOracion(periodo: string): string {
  const label = periodoLabel(periodo);
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

export function HistorialSection({ c, periodo }: { c: Card; periodo?: string }) {
  // `periodo` es opcional en el `Board`, así que puede no llegar. En ese caso se muestra el mes
  // vigente: mejor eso que una lista vacía o una pantalla rota.
  const mirado = periodo ?? periodoVigente(new Date().toISOString());
  const [verMes, setVerMes] = useState(mirado);

  const todo = c.history ?? [];
  if (todo.length === 0) return null;

  const delMes = historialDePeriodo(todo, verMes);
  const otros = periodosConHistorial(todo).filter((p) => p !== verMes);

  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-ink2 text-xs tracking-wide">
        Historial de {enOracion(verMes)} ({delMes.length})
      </summary>

      {delMes.length === 0
        ? <div className="text-ink2 mt-1.5">Sin movimientos en {enOracion(verMes)}.</div>
        : delMes.map((h, n) => {
            // El rastro del reinicio mensual NO se oculta —es información legítima— pero va
            // apagado para que no se confunda con el trabajo de una persona.
            const auto = esRuidoDeReinicio(h);
            return (
              <div key={n} className={"pl-3 border-l-2 border-line ml-1 mt-1.5" + (auto ? " text-ink2 opacity-70" : "")}>
                {h.txt} <span className="text-ink2">— {h.who}, {fmtDateTime(h.at)}{auto ? " · automático" : ""}</span>
              </div>
            );
          })}

      {otros.length > 0 && (
        <div className="text-ink2 text-xs mt-2">
          También hay movimientos en{" "}
          {otros.map((p, i) => (
            <span key={p}>
              {i > 0 && (i === otros.length - 1 ? " y " : ", ")}
              <button type="button" onClick={() => setVerMes(p)} className="underline">{enOracion(p)}</button>
            </span>
          ))}
          .
        </div>
      )}
    </details>
  );
}
