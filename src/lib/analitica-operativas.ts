// Analítica de tareas operativas (spec 28, Fase D, Task 9). Función PURA.
//
// ENCUADRE (igual que retrabajo.ts / busfactor.ts): el objetivo es detectar tareas que
// consumen una cantidad excesiva de tiempo y encontrar oportunidades de mejora del
// PROCESO, no comparar personas entre sí. El cruce empleado x tipo se arma para ver
// carga de trabajo, no como ranking — la UI no debe ordenarlo por "quién hizo más".
//
// "TIPO DE TAREA": se usa el `title` de la card operativa, no `categoria`. Una categoría
// agrupa varias tareas operativas distintas (ej. "Cierre" puede incluir "Arqueo de caja" y
// "Carga de remitos"), y mezclarlas bajo el mismo tipo ocultaría justamente la tarea puntual
// que consume tiempo de más. El title es el nombre concreto de la tarea recurrente.
//
// "TIEMPO INVERTIDO": ADVERTENCIA — hoy no existe un registro de tiempo por tarea
// operativa (no hay cronómetro; ver Task 12, condicionada a aprobación del usuario y que
// puede no implementarse nunca). `ActivityLog` sólo registra una cantidad (`qty`) en un
// instante (`at`), no un rango horario. Lo único que permite ESTIMAR una duración es la
// card misma, cuando tiene `proc_at` (pasó a "en proceso") Y `done_at` (se completó) — en
// ese caso, `done_at - proc_at` es una estimación razonable del tiempo que estuvo abierta.
// Para la mayoría de las operativas (las que no tienen ambas marcas, o son recurrentes sin
// paso explícito por "en proceso") NO hay dato. En ese caso esta función devuelve `null` en
// vez de inventar un número — la UI debe mostrar "sin datos de tiempo", nunca un falso cero
// ni un promedio calculado sobre datos ausentes.
import type { Card, ActivityLog, Profile } from "./types";
import { cardsVisibles } from "./visibilidad";

function enRango(iso: string | null | undefined, desdeISO: string, hastaISO: string): boolean {
  if (!iso) return false;
  const f = iso.slice(0, 10);
  return f >= desdeISO && f <= hastaISO;
}

// Minutos entre proc_at y done_at si ambos existen y son coherentes (proc_at < done_at).
// null si falta el dato o es incoherente (defensivo: nunca un número negativo o inventado).
function minutosDuracion(c: Pick<Card, "proc_at" | "done_at">): number | null {
  if (!c.proc_at || !c.done_at) return null;
  const desde = new Date(c.proc_at).getTime();
  const hasta = new Date(c.done_at).getTime();
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return null;
  return Math.round((hasta - desde) / 60000);
}

function promedio(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

export interface AnaliticaPorEmpleado {
  id: string;
  nombre: string;
  cantidadEjecutada: number;
  minutosPromedio: number | null; // estimado, sólo con cards con proc_at y done_at
  muestraTiempo: number; // cuántas cards con dato de tiempo (0 = "sin datos de tiempo")
}

export interface AnaliticaPorTipo {
  titulo: string;
  frecuencia: number; // cantidad de registros de ActivityLog para ese tipo
  minutosPromedio: number | null;
  muestraTiempo: number;
  pctDelTotal: number; // % de la frecuencia total que representa este tipo
}

export interface CargaCruzada {
  empleadoId: string;
  empleadoNombre: string;
  titulo: string;
  cantidad: number;
}

export interface EvolucionCruzada {
  mes: string; // YYYY-MM
  empleadoId: string;
  empleadoNombre: string;
  titulo: string;
  cantidad: number;
}

export interface AnaliticaOperativas {
  porEmpleado: AnaliticaPorEmpleado[];
  porTipo: AnaliticaPorTipo[];
  cargaCruzada: CargaCruzada[];
  evolucionCruzada: EvolucionCruzada[];
}

export function analiticaOperativas(
  cards: Card[],
  activity: ActivityLog[],
  profiles: Profile[],
  desdeISO: string,
  hastaISO: string,
): AnaliticaOperativas {
  const operativas = cardsVisibles((cards ?? []).filter((c) => c.card_type === "operativa"), profiles ?? []);
  const idsOperativas = new Set(operativas.map((c) => c.id));
  const porId = new Map(operativas.map((c) => [c.id, c]));
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Sólo actividad de cards operativas visibles, dentro del rango.
  const act = cardsVisibles((activity ?? []).filter((a) => idsOperativas.has(a.card_id) && enRango(a.at, desdeISO, hastaISO)), profiles ?? []);

  // Cards operativas completadas en el rango, con estimación de duración disponible.
  const completadasEnRango = operativas.filter((c) => enRango(c.done_at, desdeISO, hastaISO));

  // --- Por empleado ---
  const empleadosIds = new Set<string>([...act.map((a) => a.owner), ...completadasEnRango.map((c) => c.owner)]);
  const porEmpleado: AnaliticaPorEmpleado[] = [...empleadosIds].map((id) => {
    const suya = act.filter((a) => a.owner === id);
    const cantidadEjecutada = suya.reduce((s, a) => s + a.qty, 0);
    const duraciones = completadasEnRango.filter((c) => c.owner === id).map(minutosDuracion).filter((n): n is number => n !== null);
    return {
      id,
      nombre: byId.get(id)?.name ?? id,
      cantidadEjecutada,
      minutosPromedio: promedio(duraciones),
      muestraTiempo: duraciones.length,
    };
  }).sort((a, b) => b.cantidadEjecutada - a.cantidadEjecutada);

  // --- Por tipo de tarea (title) ---
  const totalFrecuencia = act.length;
  const titulos = new Set<string>([...act.map((a) => porId.get(a.card_id)?.title).filter((t): t is string => !!t)]);
  const porTipo: AnaliticaPorTipo[] = [...titulos].map((titulo) => {
    const deEsteTipo = act.filter((a) => porId.get(a.card_id)?.title === titulo);
    const frecuencia = deEsteTipo.length;
    const duraciones = completadasEnRango.filter((c) => c.title === titulo).map(minutosDuracion).filter((n): n is number => n !== null);
    return {
      titulo,
      frecuencia,
      minutosPromedio: promedio(duraciones),
      muestraTiempo: duraciones.length,
      pctDelTotal: totalFrecuencia === 0 ? 0 : Math.round((frecuencia / totalFrecuencia) * 100),
    };
  }).sort((a, b) => b.frecuencia - a.frecuencia);

  // --- Cruzado empleado x tipo: carga operativa (no es ranking, es un mapa de carga) ---
  const cargaMap = new Map<string, CargaCruzada>();
  for (const a of act) {
    const titulo = porId.get(a.card_id)?.title;
    if (!titulo) continue;
    const key = `${a.owner}::${titulo}`;
    const prev = cargaMap.get(key);
    if (prev) prev.cantidad += a.qty;
    else cargaMap.set(key, { empleadoId: a.owner, empleadoNombre: byId.get(a.owner)?.name ?? a.owner, titulo, cantidad: a.qty });
  }
  const cargaCruzada = [...cargaMap.values()].sort((a, b) => a.titulo.localeCompare(b.titulo) || a.empleadoNombre.localeCompare(b.empleadoNombre));

  // --- Evolución mes a mes del cruce (para ver si un tipo empieza a consumir más carga) ---
  const evolMap = new Map<string, EvolucionCruzada>();
  for (const a of act) {
    const titulo = porId.get(a.card_id)?.title;
    if (!titulo) continue;
    const mes = a.at.slice(0, 7);
    const key = `${mes}::${a.owner}::${titulo}`;
    const prev = evolMap.get(key);
    if (prev) prev.cantidad += a.qty;
    else evolMap.set(key, { mes, empleadoId: a.owner, empleadoNombre: byId.get(a.owner)?.name ?? a.owner, titulo, cantidad: a.qty });
  }
  const evolucionCruzada = [...evolMap.values()].sort((a, b) => a.mes.localeCompare(b.mes) || a.titulo.localeCompare(b.titulo));

  return { porEmpleado, porTipo, cargaCruzada, evolucionCruzada };
}
