import type { Card, ChecklistItem, TareaEstandar } from "./types";

// ============================================================
// CATÁLOGO DE TAREAS ESTÁNDAR (migración 55)
//
// EL PEDIDO, textual: "Juan hace las conciliaciones de Chevrolet, pero su descripción no es como
// la de Valentino. Si son las mismas tareas, diferente empresa o marca, deberíamos tenerlo igual
// para que mi jefe pueda comparar y además para que nos sirva de dato general."
//
// Esta lib es la que decide QUÉ SE COPIA de una definición a una tarea concreta. La pantalla del
// catálogo (features/admin/CatalogoTareas.tsx) administra las definiciones; la de crear tareas
// las instancia.
//
// NO REEMPLAZA A `plantilla.ts`. Esa es la plantilla del cierre mensual: una lista plana en
// `settings` que GENERA las tareas del mes de un click, y sigue haciendo exactamente eso. Acá se
// define QUÉ ES una tarea, que es otra pregunta.
//
// LA DEFINICIÓN ES UN PUNTO DE PARTIDA, NO UNA JAULA. Todo lo que sale de acá es un
// `Partial<Card>` que después se edita libremente antes y después de crear la tarea. Si una
// tarea creada desde el catálogo no se pudiera editar, el primer caso que no encaje se crearía
// por afuera y en dos semanas nadie usaría el catálogo.
// ============================================================

/** Un paso recién copiado: siempre sin tildar. Ver el comentario de `desdeEstandar`. */
function pasoNuevo(txt: string): ChecklistItem {
  return { txt, done: false, done_at: null };
}

/**
 * Los datos de una tarea nueva, salidos de una definición del catálogo.
 *
 * `owner`, `marca` y `sucursal` entran por parámetro porque la definición no los sabe: la gracia
 * es justamente que la MISMA definición sirva para Chevrolet y para Peugeot, y para quien sea
 * que la haga.
 *
 * LO QUE NO VIENE DE LA DEFINICIÓN, y es a propósito:
 *
 * - **La prioridad.** Qué es urgente depende del mes, de la marca y de lo que pase esa semana.
 *   La misma conciliación puede ser urgente en un cierre y no serlo en el siguiente. Fijarla en
 *   la definición pondría a todo el equipo a arrancar por lo mismo aunque no corresponda.
 * - **El estado y el vencimiento.** Son de cada instancia, no del tipo de trabajo.
 *
 * EL CHECKLIST SE COPIA, NO SE REFERENCIA — y esta es la decisión que sostiene todo el catálogo.
 * Si la tarea compartiera los ítems con la definición, editar la definición cambiaría las tareas
 * YA CERRADAS del mes pasado: la foto de junio se reescribiría sola y el histórico dejaría de
 * decir lo que se hizo de verdad.
 *
 * La trampa concreta: `[...e.checklist]` parece una copia y no lo es. El arreglo es nuevo pero
 * los ítems adentro son los mismos objetos, así que tildar un paso en la tarea lo tildaría en la
 * definición, para todos. Por eso se reconstruye ítem por ítem.
 */
export function desdeEstandar(
  e: TareaEstandar, owner: string, marca: string | null, sucursal: string | null,
): Partial<Card> {
  // `checklist` es jsonb: puede llegar null o cualquier cosa de una base vieja o de una edición
  // a mano. Que la pantalla de crear tareas se caiga por eso sería peor que perder los pasos.
  const pasos = Array.isArray(e?.checklist) ? e.checklist : [];
  return {
    owner,
    title: (e?.nombre ?? "").trim(),
    description: e?.descripcion ?? "",
    checklist: pasos
      .map((p) => (typeof p?.txt === "string" ? p.txt.trim() : ""))
      .filter((txt) => txt.length > 0)
      .map(pasoNuevo),
    categoria: e?.categoria ?? null,
    effort: e?.effort ?? 1,
    tiempo_max_horas: e?.tiempo_max_horas ?? null,
    marca,
    sucursal,
    estandar_id: e?.id,
  };
}

/**
 * El orden en que se muestra el catálogo: las activas primero, y adentro de cada grupo por
 * nombre.
 *
 * Las dadas de baja no se esconden —el histórico apunta a ellas y tienen que poder verse y
 * reactivarse— pero tampoco pueden estorbar el uso diario, que es leer y editar las vigentes.
 *
 * No muta la lista que recibe: llega de una query cacheada y ordenarla en el lugar cambiaría lo
 * que ve cualquier otra pantalla que la esté leyendo.
 */
export function ordenarEstandares(l: TareaEstandar[]): TareaEstandar[] {
  if (!Array.isArray(l)) return [];
  return [...l].sort(
    (a, b) => Number(b.activa) - Number(a.activa) || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
  );
}

/** Lo que se está por guardar en el catálogo, antes de tener id. */
export interface BorradorEstandar {
  nombre: string;
  descripcion: string;
  checklist: ChecklistItem[];
  categoria: string | null;
  effort: 1 | 2 | 3 | 5;
  tiempo_max_horas: number | null;
}

/**
 * Qué impide guardar una definición, en un mensaje que se pueda leer. `null` = se puede guardar.
 *
 * El nombre repetido se chequea ACÁ y no sólo en la base: la base tiene un índice único sobre
 * `lower(nombre)` y lo rechazaría igual, pero devolvería el error crudo de Postgres, que no le
 * dice a nadie qué hacer con eso.
 *
 * Sin distinguir mayúsculas, por el mismo motivo que el índice: "Conciliación bancaria" y
 * "conciliación bancaria" serían dos definiciones distintas del mismo trabajo, que es
 * exactamente el problema que el catálogo viene a resolver.
 *
 * `editandoId` es la definición que se está editando: su propio nombre no puede contar como
 * repetido de sí mismo.
 */
export function validarEstandar(
  b: BorradorEstandar, existentes: TareaEstandar[], editandoId?: string | null,
): string | null {
  const nombre = (b?.nombre ?? "").trim();
  if (!nombre) return "La tarea estándar necesita un nombre.";

  // `claveDeNombre` y no `trim().toLowerCase()` a mano: también saca los acentos. Antes,
  // "Conciliación" y "Conciliacion" entraban como dos definiciones distintas — o sea que el
  // catálogo permitía justo el problema que vino a resolver, con un paso de burocracia en el
  // medio. Y es el mismo criterio con el que el informe agrupa los títulos repetidos: si fueran
  // dos criterios, el informe marcaría como repetido algo que el catálogo dejó entrar como único.
  const clave = claveDeNombre(nombre);
  const choque = (existentes ?? []).find(
    (e) => e.id !== editandoId && claveDeNombre(e.nombre ?? "") === clave,
  );
  if (choque) return `Ya hay una tarea estándar que se llama "${choque.nombre}".`;

  // null es válido y significa "sin máximo propio": ahí manda el tiempo máximo de la categoría.
  // Un 0 o un negativo no significan nada y dejarían una tarea vencida desde que nace.
  if (b.tiempo_max_horas !== null && !(b.tiempo_max_horas > 0)) {
    return "El tiempo máximo tiene que ser mayor a cero, o quedar vacío.";
  }
  return null;
}

/**
 * Los pasos se editan como texto, un paso por renglón.
 *
 * POR QUÉ UN TEXTO Y NO UNA LISTA CON BOTONCITOS: escribir ocho pasos en un textarea es pegar y
 * listo; en una lista con "agregar ítem" son ocho clicks y ocho campos. La pantalla la usa el
 * jefe de vez en cuando, no todos los días — que sea rápida de llenar importa más que que sea
 * vistosa.
 */
export function checklistDesdeTexto(txt: string): ChecklistItem[] {
  return (txt ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(pasoNuevo);
}

/** La vuelta: los pasos guardados, listos para volver al textarea al editar. */
export function textoDeChecklist(items: ChecklistItem[]): string {
  if (!Array.isArray(items)) return "";
  return items.map((i) => i?.txt ?? "").filter((t) => t.trim().length > 0).join("\n");
}

/**
 * La clave con la que se decide si dos nombres son "el mismo". **Fuente única.**
 *
 * Sin mayúsculas, sin acentos y con los espacios colapsados. Los acentos importan de verdad acá:
 * en una oficina argentina media gente escribe "Conciliación" y la otra mitad "Conciliacion". Si
 * contaran como cosas distintas, el catálogo dejaría entrar las dos definiciones —y entonces el
 * catálogo tendría el mismo problema que vino a resolver, con un paso de burocracia en el medio.
 *
 * `normalize("NFD")` separa la letra de su tilde y el reemplazo borra las tildes sueltas. Es la
 * forma estándar en JavaScript y no necesita tabla de caracteres.
 */
export function claveDeNombre(nombre: string): string {
  if (typeof nombre !== "string") return "";
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Las definiciones que se pueden elegir al crear una tarea: sólo las activas, ya ordenadas.
 *
 * POR QUÉ NO ALCANZA CON `ordenarEstandares`. La pantalla del catálogo muestra también las dadas
 * de baja, y eso es deliberado: el histórico apunta a ellas, así que tienen que poder verse y
 * reactivarse. Pero elegir una definición retirada para una tarea NUEVA es exactamente lo que la
 * baja quiso evitar. Son dos listas distintas para dos preguntas distintas.
 */
export function estandaresElegibles(l: TareaEstandar[]): TareaEstandar[] {
  if (!Array.isArray(l)) return [];
  return ordenarEstandares(l.filter((e) => e?.activa === true));
}
