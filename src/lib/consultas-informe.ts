import type { Consulta } from "./types";
// Con extensión `.ts` explícita, a diferencia del resto del proyecto, y a propósito:
// `scripts/consultas.mjs` importa este archivo con Node, cuyo resolver exige la extensión.
// Sin ella el script muere con ERR_MODULE_NOT_FOUND. Vite y `tsc` lo aceptan igual porque
// el tsconfig ya tiene `allowImportingTsExtensions`. Las dos libs de abajo sólo importan
// tipos, así que la cadena termina acá y no hay que tocar nada más.
import { ordenarConsultas, contarNuevas, ESTADO_LBL } from "./consultas.ts";
import { toARTDate } from "./metrics.ts";

// Informe de la bandeja de consultas, para leerlo y analizarlo fuera de la app.
//
// PURA: no toca la red ni pregunta la hora. Recibe los datos ya bajados y devuelve texto.
// Toda la parte de red vive en `scripts/consultas.mjs`, que es solo entrada y salida.
//
// ENCUADRE: esto describe PEDIDOS Y PROBLEMAS DEL SISTEMA, no personas. El autor aparece
// para poder responderle, no para contabilizarlo: no hay conteo por persona ni ranking.
// Alguien que reporta diez errores está haciendo el trabajo bien, no mal.
//
// Reusa `ordenarConsultas`, `contarNuevas` y las etiquetas de `./consultas`, que son las
// mismas que usa la bandeja dentro de la app. Este archivo agrega UNA sola cosa que la
// bandeja no necesita: el agrupado por tipo. Antes tenía su propia copia del ordenamiento
// y de las etiquetas, y la misma consulta aparecía como "Leída" en la app y "leida" acá.

export interface PerfilMinimo { id: string; name: string }

/** Los errores primero: son los que tienen a alguien trabado ahora mismo. */
const ORDEN_GRUPOS: Consulta["tipo"][] = ["error", "consulta", "sugerencia"];
const TITULO_GRUPO: Record<Consulta["tipo"], string> = {
  error: "Errores",
  consulta: "Consultas",
  sugerencia: "Sugerencias",
};
/** Grupo de descarte. Su razón de ser está explicada en `agruparPorTipo`. */
const TITULO_OTROS = "Otros";

/**
 * Agrupa por tipo, en orden de urgencia, y mete en "Otros" cualquier tipo desconocido.
 *
 * El grupo "Otros" NO es paranoia. Si el informe iterara sólo los tres tipos conocidos, el
 * día que se agregue uno nuevo esas consultas desaparecerían del archivo mientras el total
 * del resumen las seguiría contando. Un informe que se contradice solo es peor que uno
 * incompleto: quien lo lee no tiene forma de darse cuenta. Que algo aparezca en un grupo
 * raro se nota; que se esfume, no.
 */
export function agruparPorTipo(cs: Consulta[]): { titulo: string; consultas: Consulta[] }[] {
  const lista = ordenarConsultas(cs);
  const grupos: { titulo: string; consultas: Consulta[] }[] = [];
  for (const tipo of ORDEN_GRUPOS) {
    const delTipo = lista.filter((c) => c.tipo === tipo);
    if (delTipo.length > 0) grupos.push({ titulo: TITULO_GRUPO[tipo], consultas: delTipo });
  }
  const sobrantes = lista.filter((c) => !ORDEN_GRUPOS.includes(c.tipo));
  if (sobrantes.length > 0) grupos.push({ titulo: TITULO_OTROS, consultas: sobrantes });
  return grupos;
}

/**
 * Cita un texto como blockquote de Markdown. NO es cosmético: el texto lo escribe una
 * persona y puede empezar con "#", "-" o "```". Pegado crudo, partiría el informe en dos
 * y una consulta podría tapar a las que vienen abajo.
 */
function citar(texto: string | null): string {
  const t = String(texto ?? "").trim();
  // Decirlo explícito en vez de dejar un "> " pelado, que se lee como una falla de formato.
  if (!t) return "> (sin texto)";
  return t.split("\n").map((l) => "> " + l).join("\n");
}

function nombreDe(perfiles: PerfilMinimo[], id: string): string {
  if (!Array.isArray(perfiles)) return id;
  return perfiles.find((p) => p?.id === id)?.name ?? id;
}

/**
 * Día calendario ARGENTINO de un instante. `toARTDate` y no `toISOString()`: estamos en
 * UTC-3, así que todo lo mandado después de las 21 se fecharía al día siguiente, y el
 * propio "Generado el" del informe saldría con fecha futura si se corre de noche.
 */
function dia(iso: string | null): string {
  if (!iso) return "fecha desconocida";
  const d = new Date(iso);
  return isFinite(d.getTime()) ? toARTDate(iso) : String(iso);
}

function bloque(c: Consulta, perfiles: PerfilMinimo[]): string {
  const estado = ESTADO_LBL[c.estado] ?? c.estado;
  const partes = [
    `### ${nombreDe(perfiles, c.autor)} · ${dia(c.created_at)} · ${estado}`,
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
  const grupos = agruparPorTipo(cs);
  const cabecera = `# Bandeja de consultas\n\nGenerado el ${dia(generadoISO)}.\n`;
  const total = grupos.reduce((n, g) => n + g.consultas.length, 0);
  if (total === 0) return cabecera + "\nNo hay consultas para mostrar.\n";

  // El resumen se calcula sobre lo que el informe REALMENTE muestra, no sobre la entrada:
  // así no puede decir "12 en total" y listar 11.
  const todas = grupos.flatMap((g) => g.consultas);
  const detalle = grupos.map((g) => `${g.titulo.toLowerCase()} ${g.consultas.length}`).join(" · ");
  const resumen = `\n${total} en total · ${contarNuevas(todas)} sin ver · ${detalle}\n`;

  const cuerpo = grupos
    .map((g) => `\n## ${g.titulo} (${g.consultas.length})\n\n` + g.consultas.map((c) => bloque(c, perfiles)).join("\n"))
    .join("");

  return cabecera + resumen + cuerpo;
}
