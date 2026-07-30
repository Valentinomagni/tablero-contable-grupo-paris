import type { Consulta } from "./types";

// Informe de la bandeja de consultas, para leerlo y analizarlo fuera de la app.
//
// PURA: no toca la red ni pregunta la hora. Recibe los datos ya bajados y devuelve texto.
// Toda la parte de red vive en `scripts/consultas.mjs`, que es solo entrada y salida.
//
// ENCUADRE: esto describe PEDIDOS Y PROBLEMAS DEL SISTEMA, no personas. El autor aparece
// para poder responderle, no para contabilizarlo: no hay conteo por persona ni ranking.
// Alguien que reporta diez errores está haciendo el trabajo bien, no mal.

export interface PerfilMinimo { id: string; name: string }

/** Los errores primero: son los que tienen a alguien trabado ahora mismo. */
const PESO_TIPO: Record<Consulta["tipo"], number> = { error: 0, consulta: 1, sugerencia: 2 };
/** Lo no visto primero: es lo que todavía espera una respuesta. */
const PESO_ESTADO: Record<Consulta["estado"], number> = { nueva: 0, leida: 1, archivada: 2 };

const TITULO_GRUPO: Record<Consulta["tipo"], string> = {
  error: "## Errores",
  consulta: "## Consultas",
  sugerencia: "## Sugerencias",
};
const ORDEN_GRUPOS: Consulta["tipo"][] = ["error", "consulta", "sugerencia"];

/** Copia ordenada: errores → consultas → sugerencias, nuevas primero, más reciente primero. */
export function ordenarConsultas(cs: Consulta[]): Consulta[] {
  if (!Array.isArray(cs)) return [];
  return [...cs].sort((a, b) => {
    const t = (PESO_TIPO[a.tipo] ?? 9) - (PESO_TIPO[b.tipo] ?? 9);
    if (t !== 0) return t;
    const e = (PESO_ESTADO[a.estado] ?? 9) - (PESO_ESTADO[b.estado] ?? 9);
    if (e !== 0) return e;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

/**
 * Cita un texto como blockquote de Markdown. NO es cosmético: el texto lo escribe una
 * persona y puede empezar con "#", "-" o "```". Pegado crudo, partiría el informe en dos
 * y una consulta podría tapar a las que vienen abajo.
 */
function citar(texto: string): string {
  return String(texto ?? "").split("\n").map((l) => "> " + l).join("\n");
}

function nombreDe(perfiles: PerfilMinimo[], id: string): string {
  if (!Array.isArray(perfiles)) return id;
  return perfiles.find((p) => p?.id === id)?.name ?? id;
}

/** YYYY-MM-DD de un instante ISO. Si no se puede leer, devuelve el original. */
function dia(iso: string): string {
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : String(iso ?? "");
}

function bloque(c: Consulta, perfiles: PerfilMinimo[]): string {
  const partes = [
    `### ${nombreDe(perfiles, c.autor)} · ${dia(c.created_at)} · ${c.estado}`,
    "",
    citar(c.texto),
    "",
  ];
  if (c.respuesta) {
    partes.push(`**Respondida** el ${dia(c.respondida_at ?? c.created_at)}:`, "", citar(c.respuesta), "");
  } else {
    partes.push("**Sin responder.**", "");
  }
  return partes.join("\n");
}

/**
 * El informe completo en Markdown. `generadoISO` entra por parámetro para que la función
 * sea pura y testeable: sin él, cada corrida daría un texto distinto.
 */
export function informeConsultas(cs: Consulta[], perfiles: PerfilMinimo[], generadoISO: string): string {
  const lista = ordenarConsultas(cs);
  const cabecera = `# Bandeja de consultas\n\nGenerado el ${dia(generadoISO)}.\n`;
  if (lista.length === 0) {
    return cabecera + "\nNo hay consultas para mostrar.\n";
  }

  const cuenta = (e: Consulta["estado"]) => lista.filter((c) => c.estado === e).length;
  const resumen =
    `\n${lista.length} en total · ${cuenta("nueva")} nuevas · ` +
    `${cuenta("leida")} leída${cuenta("leida") === 1 ? "" : "s"} · ${cuenta("archivada")} archivadas\n`;

  const grupos = ORDEN_GRUPOS.map((tipo) => {
    const delTipo = lista.filter((c) => c.tipo === tipo);
    if (delTipo.length === 0) return ""; // sin grupos vacíos: ruido puro
    return `\n${TITULO_GRUPO[tipo]} (${delTipo.length})\n\n` +
      delTipo.map((c) => bloque(c, perfiles)).join("\n");
  }).join("");

  return cabecera + resumen + grupos;
}
