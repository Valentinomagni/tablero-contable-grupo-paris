import type { Card } from "./types";

// "¿Qué pasa si no hago nada?" — la exposición del área por horizonte.
//
// POR QUÉ EXISTE: una lista de vencimientos es un dato; una consecuencia es una decisión.
// "Tenés 12 tareas con fecha" no mueve a nadie; "si hoy nadie trabaja, mañana vencen 4 de IVA"
// sí. Es el mismo dato leído al revés: en vez de mostrar lo que hay, muestra lo que pasa si
// se deja correr.
//
// ENCUADRE: habla del ÁREA y de las tareas, nunca de personas. Acá no aparece ningún nombre:
// un vencimiento es responsabilidad del proceso, no de quien lo tiene asignado.
//
// PURA: la fecha entra por `hoyISO`; sin `new Date()` adentro (tests estables).

export interface Exposicion {
  horizonte: 1 | 3 | 7;
  titulo: string;
  total: number;
  porCategoria: { categoria: string; n: number }[];
}

const SIN_CATEGORIA = "Sin categoría";

// Acumulativos a propósito: "en 3 días" incluye lo de mañana, que es como se lee en castellano.
const HORIZONTES: { horizonte: 1 | 3 | 7; titulo: string }[] = [
  { horizonte: 1, titulo: "Mañana" },
  { horizonte: 3, titulo: "En 3 días" },
  { horizonte: 7, titulo: "En 7 días" },
];

/** Suma `dias` a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD'. */
function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`); // mediodía: evita corrimientos de zona
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function exposicion(cards: Card[], hoyISO: string): Exposicion[] {
  const lista = Array.isArray(cards) ? cards : [];
  const hoy = (hoyISO ?? "").slice(0, 10);

  // Sólo lo que sigue sin hacerse y tiene fecha comprometida.
  const pendientes = lista.filter((c) => c?.status !== "term" && !!c?.due_date);

  return HORIZONTES.map(({ horizonte, titulo }) => {
    const limite = sumarDias(hoy, horizonte);
    // `<=` incluye lo YA VENCIDO a propósito: una tarea que venció ayer y sigue abierta es
    // exposición viva, no historia. Sacarla del conteo escondería lo más urgente que hay.
    const expuestas = pendientes.filter((c) => (c.due_date as string).slice(0, 10) <= limite);

    const porCat = new Map<string, number>();
    for (const c of expuestas) {
      const cat = c.categoria || SIN_CATEGORIA;
      porCat.set(cat, (porCat.get(cat) ?? 0) + 1);
    }

    return {
      horizonte,
      titulo,
      total: expuestas.length,
      porCategoria: [...porCat.entries()]
        .map(([categoria, n]) => ({ categoria, n }))
        .sort((a, b) => b.n - a.n || a.categoria.localeCompare(b.categoria, "es")),
    };
  });
}
