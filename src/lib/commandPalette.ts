// Agrupamiento/cupo de los resultados del Ctrl+K cuando no hay texto de búsqueda
// (preview al abrir o al navegar con flechas, antes de tipear nada).
//
// Los grupos en `sinCupo` (por defecto "Personas") NUNCA se cortan: la lista ya tiene
// scroll propio, así que agregar gente al equipo no puede volver invisible a nadie. Antes
// se aplicaba un cupo fijo (2, después 5) por grupo: como `team` llega ordenado por rol
// ("empleado" < "encargado" < "jefe"), con suficientes empleados los "primeros N" de
// Personas eran siempre empleados y los encargados/jefes quedaban afuera del preview.
// El resto de los grupos (Vistas, Acciones, Tareas, Tablón) sí mantienen un cupo — son
// listas fijas o acotadas por naturaleza y no crecen con el tamaño del equipo.
//
// El orden de los grupos se preserva por orden de primera aparición en `items` (Map
// itera en orden de inserción), no se reordena alfabéticamente ni por tamaño.
export function agruparItemsPalette<T extends { g: string }>(
  items: T[],
  cupo = 5,
  sinCupo: readonly string[] = ["Personas"],
): T[] {
  const porGrupo = new Map<string, T[]>();
  for (const i of items) {
    const arr = porGrupo.get(i.g) ?? [];
    arr.push(i);
    porGrupo.set(i.g, arr);
  }
  const out: T[] = [];
  for (const [g, arr] of porGrupo) out.push(...(sinCupo.includes(g) ? arr : arr.slice(0, cupo)));
  return out;
}
