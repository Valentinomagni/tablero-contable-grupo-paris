// Analítica de tareas operativas (spec 28, Fase D, Task 9). Función PURA.
//
// ENCUADRE (igual que retrabajo.ts / busfactor.ts): el objetivo es detectar tareas que
// consumen una cantidad excesiva de tiempo y encontrar oportunidades de mejora del
// PROCESO, no comparar personas entre sí. El cruce empleado x tipo se arma para ver
// carga de trabajo, no como ranking — por eso `porEmpleado` se ordena por NOMBRE y nunca
// por cantidad ejecutada.
//
// "TIPO DE TAREA": se usa el `title` de la card operativa, no `categoria`. Una categoría
// agrupa varias tareas operativas distintas (ej. "Cierre" puede incluir "Arqueo de caja" y
// "Carga de remitos"), y mezclarlas bajo el mismo tipo ocultaría justamente la tarea puntual
// que consume tiempo de más. El title es el nombre concreto de la tarea recurrente.
//
// TIEMPO: NO se calcula ni se expone. La única estimación posible sería `done_at - proc_at`
// de la card, y en tareas recurrentes eso no representa trabajo efectivo: mide cuánto
// estuvo ABIERTA la tarjeta (incluye noches, fines de semana y el tiempo entre que alguien
// la movió a "en proceso" y se acordó de cerrarla), no cuánto tiempo llevó hacerla. No hay
// cronómetro por tarea operativa (`ActivityLog` sólo registra una cantidad `qty` en un
// instante `at`, no un rango horario). Publicar ese número como "minutos promedio" sería
// inventar una métrica de productividad sobre un dato que no la mide, así que se decidió
// no mostrarlo. Si algún día hay registro real de tiempo, se agrega acá.
//
// VISIBILIDAD: se usa el filtro POSITIVO `enAlcanceDeMetricas` (visibilidad.ts), no
// `cardsVisibles`. `profiles` acá es la lista YA acotada por rol/segmento que arma el
// llamador; el administrador fantasma nunca está en ella, así que un filtro por "Set de
// ocultos" jamás lo excluiría y sus cards y su ActivityLog seguirían contando. El filtro
// positivo además hace que la analítica respete el segmento que le pasaron.
import type { Card, ActivityLog, Profile } from "./types";
import { enAlcanceDeMetricas } from "./visibilidad";

function enRango(iso: string | null | undefined, desdeISO: string, hastaISO: string): boolean {
  if (!iso) return false;
  const f = iso.slice(0, 10);
  return f >= desdeISO && f <= hastaISO;
}

export interface AnaliticaPorEmpleado {
  id: string;
  nombre: string;
  cantidadEjecutada: number;
}

export interface AnaliticaPorTipo {
  titulo: string;
  frecuencia: number; // cantidad de registros de ActivityLog para ese tipo
  pctDelTotal: number; // % de la frecuencia total que representa este tipo
}

export interface CargaCruzada {
  empleadoId: string;
  empleadoNombre: string;
  titulo: string;
  cantidad: number;
}

export interface AnaliticaOperativas {
  porEmpleado: AnaliticaPorEmpleado[];
  porTipo: AnaliticaPorTipo[];
  cargaCruzada: CargaCruzada[];
}

export function analiticaOperativas(
  cards: Card[],
  activity: ActivityLog[],
  profiles: Profile[],
  desdeISO: string,
  hastaISO: string,
): AnaliticaOperativas {
  const operativas = enAlcanceDeMetricas((cards ?? []).filter((c) => c.card_type === "operativa"), profiles ?? []);
  const idsOperativas = new Set(operativas.map((c) => c.id));
  const porId = new Map(operativas.map((c) => [c.id, c]));
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Sólo actividad de cards operativas visibles, dentro del rango.
  const act = enAlcanceDeMetricas((activity ?? []).filter((a) => idsOperativas.has(a.card_id) && enRango(a.at, desdeISO, hastaISO)), profiles ?? []);

  // Cards operativas completadas en el rango (sirven para que alguien que cerró tareas
  // pero no registró actividad igual aparezca en el listado por empleado).
  const completadasEnRango = operativas.filter((c) => enRango(c.done_at, desdeISO, hastaISO));

  // --- Por empleado ---
  // Orden por NOMBRE, no por cantidad: ordenar personas por volumen convierte una vista de
  // carga en un ranking de productividad, que es justo lo que este panel no quiere ser.
  const empleadosIds = new Set<string>([...act.map((a) => a.owner), ...completadasEnRango.map((c) => c.owner)]);
  const porEmpleado: AnaliticaPorEmpleado[] = [...empleadosIds].map((id) => {
    const suya = act.filter((a) => a.owner === id);
    const cantidadEjecutada = suya.reduce((s, a) => s + a.qty, 0);
    return { id, nombre: byId.get(id)?.name ?? id, cantidadEjecutada };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // --- Por tipo de tarea (title) ---
  const totalFrecuencia = act.length;
  const titulos = new Set<string>([...act.map((a) => porId.get(a.card_id)?.title).filter((t): t is string => !!t)]);
  const porTipo: AnaliticaPorTipo[] = [...titulos].map((titulo) => {
    const deEsteTipo = act.filter((a) => porId.get(a.card_id)?.title === titulo);
    const frecuencia = deEsteTipo.length;
    return {
      titulo,
      frecuencia,
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

  return { porEmpleado, porTipo, cargaCruzada };
}
