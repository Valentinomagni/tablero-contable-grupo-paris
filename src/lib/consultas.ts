import type { Consulta } from "./types";

// Validación del texto de una consulta antes de enviarla (Task 3, canal interno de feedback).
export function validarConsulta(texto: string): string | null {
  if (!texto.trim()) return "Escribí tu consulta.";
  if (texto.length > 2000) return "Máximo 2000 caracteres.";
  return null;
}

const PESO_ESTADO: Record<Consulta["estado"], number> = { nueva: 0, leida: 1, archivada: 2 };

// Nuevas primero, luego leídas, archivadas al final; dentro de cada grupo por fecha desc.
export function ordenarConsultas(cs: Consulta[]): Consulta[] {
  return [...cs].sort((a, b) => {
    const pa = PESO_ESTADO[a.estado], pb = PESO_ESTADO[b.estado];
    if (pa !== pb) return pa - pb;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function contarNuevas(cs: Consulta[]): number {
  return cs.filter((c) => c.estado === "nueva").length;
}
