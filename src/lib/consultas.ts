import type { Consulta } from "./types";

// Validación del texto de una consulta antes de enviarla (Task 3, canal interno de feedback).
export function validarConsulta(texto: string): string | null {
  if (!texto.trim()) return "Escribí tu consulta.";
  if (texto.length > 2000) return "Máximo 2000 caracteres.";
  return null;
}

// Etiquetas en lenguaje de usuario. Viven ACÁ y no en cada pantalla: antes estaban
// duplicadas en la bandeja de la app y el informe imprimía el valor crudo en minúscula,
// así que la misma consulta se llamaba "Leída" en un lado y "leida" en el otro.
export const TIPO_LBL: Record<Consulta["tipo"], string> = { consulta: "Consulta", sugerencia: "Sugerencia", error: "Error" };
export const ESTADO_LBL: Record<Consulta["estado"], string> = { nueva: "Nueva", leida: "Leída", archivada: "Archivada" };

const PESO_ESTADO: Record<Consulta["estado"], number> = { nueva: 0, leida: 1, archivada: 2 };

// Nuevas primero, luego leídas, archivadas al final; dentro de cada grupo por fecha desc.
// Tolera nulos y estados desconocidos: la ordenación nunca puede ser el motivo por el que
// no se ve una consulta.
export function ordenarConsultas(cs: Consulta[]): Consulta[] {
  if (!Array.isArray(cs)) return [];
  return cs.filter(Boolean).sort((a, b) => {
    const pa = PESO_ESTADO[a.estado] ?? 9, pb = PESO_ESTADO[b.estado] ?? 9;
    if (pa !== pb) return pa - pb;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

export function contarNuevas(cs: Consulta[]): number {
  if (!Array.isArray(cs)) return 0;
  return cs.filter((c) => c?.estado === "nueva").length;
}
