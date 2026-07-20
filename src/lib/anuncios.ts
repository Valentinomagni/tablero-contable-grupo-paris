import type { Announcement } from "./types";

// Quién puede editar/eliminar un aviso: el autor o un jefe.
// Eventos legacy (owner_id null, previos a la migración de ownership): solo jefe.
export function puedeEditarAnuncio(a: Pick<Announcement, "owner_id">, meId: string, isJefe: boolean): boolean {
  if (isJefe) return true;
  return !!a.owner_id && a.owner_id === meId;
}

// Alias semántico: hoy la regla de borrado es idéntica a la de edición (misma policy DELETE
// de la migración 27), pero se mantiene como función separada por si el negocio la diferencia
// en el futuro (ej. borrado solo por jefe, edición también por autor).
export const puedeEliminarAnuncio = puedeEditarAnuncio;
