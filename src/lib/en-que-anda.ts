import type { Card, Profile } from "./types";

// "En qué anda el equipo" — qué tiene abierto cada persona y desde cuándo.
//
// QUÉ ES. La pregunta que un jefe o un encargado necesita responder de un vistazo: si alguien
// pide ayuda, si algo lleva demasiado sin moverse, si la carga está repartida.
//
// QUÉ NO ES, Y ES DELIBERADO:
//
//   · NO hay cronómetro. Se evaluó y se descartó el 04/08/2026, con el mismo fundamento del
//     análisis del ICR: un timer a la vista del jefe se falsea dejando la tarea abierta, así
//     que no mide trabajo — mide cuánto se acuerda cada uno de apretar el botón. Y el costo
//     es alto: el equipo que se siente medido trabaja para la foto, y ahí TODO el dato del
//     sistema pasa a ser mentira.
//
//   · NO hay ranking. El orden es ALFABÉTICO, nunca por cantidad. Ordenar por volumen arma un
//     podio aunque no haya números de puesto, y el podio contradice la regla dura del
//     proyecto: las métricas describen situaciones, nunca juzgan personas.
//
//   · NO se destaca a quien no tiene nada abierto. Aparece igual que los demás, sin marca.
//     Un tablero vacío puede ser alguien de licencia, alguien que cerró todo, o alguien que
//     no está cargando su trabajo. Sacar conclusiones de eso es exactamente lo que no hay
//     que hacer con un dato ambiguo.
//
// PURA: `hoyISO` entra por parámetro.

/** Desde cuántos días sin moverse vale la pena señalar una tarea. */
const DIAS_SIN_MOVER = 5;
const DIA_MS = 86400000;

export interface TareaAbierta {
  id: string;
  title: string;
  /** Cuándo se puso en proceso. `null` si nunca se inició. */
  desde: string | null;
  /** Días desde que se puso en proceso. `null` si no se puede saber. */
  dias: number | null;
  enProceso: boolean;
}

export interface AndarDePersona {
  persona: Profile;
  abiertas: TareaAbierta[];
  enProceso: number;
  /** La que lleva más tiempo sin moverse, si alguna pasa el umbral. */
  sinMover: TareaAbierta | null;
}

export function enQueAnda(cards: Card[], equipo: Profile[], hoyISO: string): AndarDePersona[] {
  if (!Array.isArray(equipo)) return [];
  const lista = Array.isArray(cards) ? cards : [];
  const ahora = new Date(hoyISO).getTime();
  const ahoraOk = isFinite(ahora);

  return equipo
    .filter(Boolean)
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"))
    .map((persona) => {
      const suyas = lista.filter(
        (c) => c && c.owner === persona.id && c.status !== "term" && c.card_type !== "operativa",
      );

      const abiertas: TareaAbierta[] = suyas.map((c) => {
        const desde = c.status === "proc" ? c.proc_at ?? null : null;
        const t = desde ? new Date(desde).getTime() : NaN;
        const dias = desde && ahoraOk && isFinite(t) ? Math.floor((ahora - t) / DIA_MS) : null;
        return { id: c.id, title: c.title, desde, dias, enProceso: c.status === "proc" };
      });

      const candidatas = abiertas.filter((t) => t.dias !== null && t.dias >= DIAS_SIN_MOVER);
      const sinMover = candidatas.length
        ? candidatas.reduce((peor, t) => ((t.dias ?? 0) > (peor.dias ?? 0) ? t : peor))
        : null;

      return {
        persona,
        abiertas,
        enProceso: abiertas.filter((t) => t.enProceso).length,
        sinMover,
      };
    });
}
