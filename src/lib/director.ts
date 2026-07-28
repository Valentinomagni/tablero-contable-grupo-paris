// Modo Director: el estado del área en una sola pantalla.
//
// POR QUÉ EXISTE: las señales ya están todas en el sistema (vencidas, bloqueadas, radar
// fiscal, bus factor, previsibilidad), pero repartidas en seis pantallas. Un director no va a
// recorrerlas: quiere saber si hay que preocuparse por algo, y recién ahí entrar.
//
// ESTA FUNCIÓN NO CALCULA NADA NUEVO: recibe números ya calculados por las libs existentes y
// sólo decide semáforo y titular. Así el criterio de "cuándo es rojo" vive en UN lugar
// testeable, en vez de repetido en el JSX.
//
// ENCUADRE: los titulares hablan de TAREAS y del PROCESO. Nunca nombran a una persona ni
// atribuyen culpa — mismo criterio que busfactor.ts y delegaciones.ts.

export type Semaforo = "ok" | "atencion" | "riesgo";

export interface PanelDirector { area: string; semaforo: Semaforo; titular: string; detalle: string }

export interface EntradaDirector {
  /** Tareas abiertas cuyo vencimiento ya pasó. */
  vencidas: number;
  /** Tareas que no pueden avanzar porque esperan a otra. */
  bloqueadas: number;
  /** Días hasta el próximo vencimiento fiscal; null si no hay ninguno a la vista. */
  venceEnDias: number | null;
  /** Categorías que hoy dependen de una sola persona (bus factor). */
  concentracion: number;
  /** % del trabajo del mes que estaba planificado (ver previsibilidad.ts). */
  pctPlanificado: number;
}

const n = (v: unknown, def = 0) => (typeof v === "number" && isFinite(v) ? v : def);

export function panelesDirector(e: EntradaDirector): PanelDirector[] {
  const vencidas = n(e?.vencidas);
  const bloqueadas = n(e?.bloqueadas);
  const concentracion = n(e?.concentracion);
  const pctPlanificado = n(e?.pctPlanificado, 100);
  const venceEnDias = typeof e?.venceEnDias === "number" ? e.venceEnDias : null;

  return [
    {
      area: "Riesgos",
      semaforo: vencidas > 0 ? "riesgo" : "ok",
      titular: vencidas > 0 ? `${vencidas} ${vencidas === 1 ? "tarea vencida" : "tareas vencidas"}` : "Sin tareas vencidas",
      detalle: "Tareas abiertas cuya fecha de entrega ya pasó.",
    },
    {
      area: "Dependencias",
      semaforo: bloqueadas >= 5 ? "riesgo" : bloqueadas > 0 ? "atencion" : "ok",
      titular: bloqueadas > 0 ? `${bloqueadas} ${bloqueadas === 1 ? "tarea detenida" : "tareas detenidas"}` : "Nada detenido",
      detalle: "No pueden avanzar hasta que se libere otra tarea.",
    },
    {
      area: "Calendario",
      semaforo: venceEnDias === null ? "ok" : venceEnDias <= 2 ? "riesgo" : venceEnDias <= 7 ? "atencion" : "ok",
      titular: venceEnDias === null ? "Sin vencimientos próximos"
        : venceEnDias <= 0 ? "Vence hoy" : `Próximo vencimiento en ${venceEnDias} días`,
      detalle: "Vencimientos fiscales del período.",
    },
    {
      area: "Continuidad",
      semaforo: concentracion >= 3 ? "riesgo" : concentracion > 0 ? "atencion" : "ok",
      titular: concentracion > 0 ? `${concentracion} ${concentracion === 1 ? "proceso depende" : "procesos dependen"} de una sola persona` : "Conocimiento repartido",
      detalle: "Riesgo de continuidad si esa persona no está. Se resuelve formando un respaldo.",
    },
    {
      area: "Planificación",
      semaforo: pctPlanificado < 50 ? "riesgo" : pctPlanificado < 75 ? "atencion" : "ok",
      titular: `${pctPlanificado}% del trabajo estaba previsto`,
      detalle: "El resto entró como urgencia dentro del mes.",
    },
  ];
}
