import type { Note } from "./types";

// Filtra por búsqueda (título/cuerpo), excluye archivadas salvo toggle, y ordena desc.
export function filtrarOrdenar(
  notas: Note[],
  q: string,
  orden: "creado" | "modificado",
  verArchivadas = false,
): Note[] {
  const needle = q.trim().toLowerCase();
  const campo = orden === "modificado" ? "updated_at" : "created_at";
  return notas
    .filter((nt) => verArchivadas || !nt.archived)
    .filter((nt) => !needle || nt.title.toLowerCase().includes(needle) || nt.body.toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => (a[campo] < b[campo] ? 1 : a[campo] > b[campo] ? -1 : 0));
}

// Mapea una nota a una fila de card para el tablero (convertir en tarea).
export function notaATarea(note: Note, ownerId: string) {
  const title = note.title.trim() || note.body.trim().split(/\s+/).slice(0, 8).join(" ") || "Anotación";
  return { owner: ownerId, title, description: note.body, status: "pend" as const, card_type: "normal" as const };
}
