import { useState } from "react";
import { CalendarCheck, X } from "lucide-react";
import type { ResumenSemana } from "../../lib/tu-semana";
import { PREF, getPref, setPref } from "../../lib/prefs";

// "Tu semana" — P4 de docs/PROPUESTAS-ADOPCION.md.
//
// Espejo PERSONAL y PRIVADO de lo terminado en la semana. La lógica de qué mostrar (y
// sobre todo de cuándo callarse) vive entera en `lib/tu-semana.ts`; acá sólo se dibuja.
//
// Lo que este componente NO hace, a propósito:
//   - no muestra lo vencido, lo abierto ni lo entregado tarde;
//   - no compara con nadie ni menciona al equipo;
//   - no felicita ni reta: enumera. Sin caritas, sin signos de exclamación.
// El día que alguien pida "una vista donde el jefe vea el resumen de cada uno", esto deja
// de ser un espejo y pasa a ser evaluación semanal automática. Ese pedido va a sonar barato.

export function TuSemana({ resumen, ownerId }: { resumen: ResumenSemana; ownerId: string }) {
  const clave = PREF.semanaVista(ownerId);
  const [cerrado, setCerrado] = useState(() => getPref(clave) === resumen.desde);
  if (cerrado) return null;

  const ocultar = () => { setPref(clave, resumen.desde); setCerrado(true); };
  const restantes = resumen.total - resumen.titulos.length;

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface2/40 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck size={15} className="text-ink2 shrink-0" />
        <span className="text-xs uppercase tracking-wide text-ink2 font-semibold">Tu semana</span>
        <button onClick={ocultar} aria-label="Ocultar el resumen de la semana"
          className="ml-auto text-ink2 hover:text-ink transition p-0.5 -m-0.5">
          <X size={14} />
        </button>
      </div>
      <p className="text-sm text-ink m-0 mb-2">
        Terminaste <b className="tnum">{resumen.total}</b>{" "}
        {resumen.total === 1 ? "tarea" : "tareas"}
        {resumen.enFecha > 0 && (
          <span className="text-ink2">, <b className="tnum text-ink">{resumen.enFecha}</b> en fecha</span>
        )}
        .
      </p>
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {resumen.titulos.map((t, i) => (
          <li key={i} className="text-sm text-ink2 truncate">· {t}</li>
        ))}
      </ul>
      {restantes > 0 && (
        <p className="text-xs text-ink2 m-0 mt-1.5">y {restantes} más.</p>
      )}
      {resumen.racha >= 2 && (
        <p className="text-xs text-ink2 m-0 mt-2 pt-2 border-t border-line">
          <b className="tnum text-ink">{resumen.racha}</b> semanas seguidas cerrando en fecha.
        </p>
      )}
    </div>
  );
}
