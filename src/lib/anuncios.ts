import type { Announcement } from "./types";

// Quién puede editar/eliminar un aviso: el autor o un jefe.
// Eventos legacy (owner_id null, previos a la migración de ownership): solo jefe.
export function puedeEditarAnuncio(a: Pick<Announcement, "owner_id">, meId: string, isJefe: boolean): boolean {
  if (isJefe) return true;
  return !!a.owner_id && a.owner_id === meId;
}
