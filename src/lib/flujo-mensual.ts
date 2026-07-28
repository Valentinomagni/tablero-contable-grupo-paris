import type { Snapshot } from "./types";

// Flujo de trabajo dentro del mes, por persona. Hoy el mes se resume en UN porcentaje
// agregado y no se ve CUÁNDO trabaja cada quien. Esto lo abre por día.
//
// ENCUADRE (regla dura del proyecto): describe la DISTRIBUCIÓN de la carga, no evalúa a
// nadie. "Mayor carga hacia el cierre" es un dato del proceso —sirve para repartir mejor—,
// no un juicio sobre la persona. Por eso no hay etiquetas de bueno/malo ni semáforo acá.
//
// PURA: la fecha entra por `mes`; sin `new Date()` adentro (tests estables).

export type PerfilCarga = "temprano" | "tardio" | "uniforme" | "sin-datos";

export const TEXTO_PERFIL: Record<PerfilCarga, string> = {
  temprano: "Mayor carga al principio del mes",
  tardio: "Mayor carga hacia el cierre",
  uniforme: "Carga repartida en el mes",
  "sin-datos": "Sin actividad registrada",
};

export interface FlujoPersona {
  owner: string;
  /** 31 posiciones: índice 0 = día 1. */
  dias: number[];
  total: number;
  /** Día (1..31) de mayor carga; 0 si no hubo. */
  picoDia: number;
  perfil: PerfilCarga;
}

// Umbral para decir que la carga se cargó de un lado. 60% es deliberadamente conservador:
// con 50% cualquier ruido daría "temprano" o "tardío" y el dato perdería sentido.
const SESGO = 0.6;

export function perfilDe(dias: number[]): PerfilCarga {
  const total = (dias ?? []).reduce((s, v) => s + v, 0);
  if (total <= 0) return "sin-datos";
  const mitad = Math.ceil(dias.length / 2);
  const primera = dias.slice(0, mitad).reduce((s, v) => s + v, 0);
  if (primera / total >= SESGO) return "temprano";
  if ((total - primera) / total >= SESGO) return "tardio";
  return "uniforme";
}

export function flujoMensual(snaps: Snapshot[], mes: string): FlujoPersona[] {
  if (!Array.isArray(snaps)) return [];
  const porOwner = new Map<string, number[]>();
  for (const s of snaps) {
    if (!s?.day || !s.owner || !s.day.startsWith(mes)) continue;
    const dia = Number(s.day.slice(8, 10));
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) continue;
    if (!porOwner.has(s.owner)) porOwner.set(s.owner, Array(31).fill(0));
    porOwner.get(s.owner)![dia - 1] += s.done_count ?? 0;
  }
  return [...porOwner.entries()]
    .map(([owner, dias]) => {
      const total = dias.reduce((s, v) => s + v, 0);
      let picoDia = 0, max = 0;
      dias.forEach((v, i) => { if (v > max) { max = v; picoDia = i + 1; } });
      return { owner, dias, total, picoDia, perfil: perfilDe(dias) };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Nivel de intensidad 0..4 para el mapa de calor. Se pinta en ESCALA DE GRISES: la
 * intensidad no es un estado, y en este proyecto el color sólo comunica estado.
 */
export function nivelCarga(valor: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(valor > 0) || !(max > 0)) return 0;
  const n = Math.ceil((valor / max) * 4);
  return Math.min(4, Math.max(1, n)) as 1 | 2 | 3 | 4;
}
