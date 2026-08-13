// Registro de transferencias de clientes, y el aviso de que una parece repetida.
//
// EL PROBLEMA, como lo reportó Patricia: hoy las transferencias de los clientes se controlan con
// PDFs sueltos en un grupo de mensajería. No hay lista, no hay orden y —sobre todo— no hay forma
// de darse cuenta de que un comprobante ya se cargó. Un mismo pago entra dos veces, la cuenta del
// cliente queda mal, y el error se descubre semanas después conciliando.
//
// QUÉ HACE ESTA LIB. Compara una transferencia que se está por cargar contra las que ya están y
// devuelve la que se le parece, si hay alguna. Nada más: no guarda, no borra y NO BLOQUEA.
//
// POR QUÉ NO BLOQUEA. Es la decisión de diseño más importante de acá. Si el sistema impidiera
// cargar algo que él cree repetido, la persona que sabe que no lo es —dos pagos iguales el mismo
// mes existen y son normales— tendría que falsear un dato para poder seguir trabajando: cambiar
// un peso el monto, inventar un número de comprobante. A partir de ahí los datos son mentira y
// el control no sirve para nada. El aviso muestra la transferencia parecida y pregunta si es la
// misma; quien está mirando el comprobante decide, que es quien puede saberlo.
//
// PURA: todo entra por parámetro. Sin `new Date()` adentro, sin consultar la base.

/** Una transferencia de cliente, tal como vive en la tabla `transferencias` (migración 49). */
export interface Transferencia {
  id: string;
  card_id: string;
  owner: string;
  /** `YYYY-MM-DD`. Es la fecha de la transferencia, no la de carga. */
  fecha: string;
  cliente: string;
  cuit: string | null;
  /** En la base es `numeric`: es plata y los centavos no se pueden perder. */
  monto: number;
  nro_comprobante: string | null;
  /** Ruta del comprobante en el bucket `adjuntos`, o null si se cargó sin PDF. */
  adjunto_path: string | null;
  created_at: string;
}

/** Migración que crea la tabla. Sin ella la sección avisa y no rompe nada. */
export const MIGRACION_TRANSFERENCIAS = 49;

// El gate NO vive en `src/lib/esquema.ts` a propósito: ese archivo saca COLUMNAS de un payload
// cuando la tabla existe pero le falta un campo. Acá lo que falta es la tabla entera, así que el
// gate no es "qué campos mando" sino "muestro la sección o muestro el aviso". Meterlo allá haría
// creer que hay un payload que gatear.

/** minúsculas, sin tildes y sin espacios de más: así se compara texto tipeado a mano. */
function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Nombre de cliente comparable. Además de normalizar, saca puntos y comas: "Peláez S.A." y
 * "pelaez sa" son el mismo cliente para quien controla, y quien tipea no escribe siempre igual.
 */
function clienteComparable(s: string): string {
  return normalizar(s).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Número de comprobante comparable: mayúsculas y sin NINGÚN espacio.
 *
 * Los guiones se respetan. Se podría sacar todo lo que no sea letra o número, pero ahí
 * "0001-1234" y "00011-234" pasarían a ser el mismo comprobante, y eso ya no es un aviso: es
 * un aviso equivocado. Un aviso que salta de más se empieza a cerrar sin leer.
 */
function comprobanteComparable(s: string): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "");
}

/** Mismo importe hasta el centavo. Es plata: 150.000,50 y 150.000,51 son transferencias distintas. */
function mismoMonto(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

/** `YYYY-MM` de una fecha `YYYY-MM-DD`, o "" si no tiene esa forma. */
function mesDe(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") ? fecha.slice(0, 7) : "";
}

/**
 * ¿Esta transferencia se parece a alguna de las que ya están cargadas?
 *
 * Devuelve LA TRANSFERENCIA parecida —no un booleano— porque el aviso tiene que poder mostrarla:
 * "el 10/08 ya se cargó Torres SA por $150.000". Sin verla, la pregunta "¿es la misma?" no se
 * puede contestar y el aviso se cierra a ciegas.
 *
 * Dos criterios, en este orden:
 *
 *  1. MISMO NÚMERO DE COMPROBANTE. Es el duplicado seguro: un comprobante identifica una
 *     operación. La base además lo impide con un índice único parcial, pero el aviso llega
 *     antes y explica, en vez de dejar que reviente el guardado.
 *
 *  2. MISMO CLIENTE, MISMO MONTO, MISMO MES. Es el duplicado probable, el que hoy se escapa:
 *     el comprobante que se reenvía por el grupo y alguien carga de nuevo. Se pide el MISMO MES
 *     a propósito: un abono mensual del mismo importe al mismo cliente es lo normal, y avisar
 *     todos los meses por eso convertiría el aviso en ruido.
 *
 * El CUIT no entra en la comparación aunque esté cargado: varias razones sociales distintas
 * comparten CUIT en los datos reales del estudio (sucursales, mismo grupo), y usarlo haría
 * saltar el aviso entre clientes que no tienen nada que ver.
 */
export function posibleDuplicado(nueva: Transferencia, existentes: Transferencia[]): Transferencia | null {
  if (!nueva || !Array.isArray(existentes) || existentes.length === 0) return null;

  // Editar una transferencia ya cargada no puede hacer que se avise a sí misma.
  const otras = existentes.filter((t) => t && (!nueva.id || t.id !== nueva.id));
  if (otras.length === 0) return null;

  const nroNuevo = comprobanteComparable(nueva.nro_comprobante ?? "");
  if (nroNuevo) {
    const porNro = otras.find((t) => comprobanteComparable(t.nro_comprobante ?? "") === nroNuevo);
    if (porNro) return porNro;
  }

  const clienteNuevo = clienteComparable(nueva.cliente ?? "");
  const mesNuevo = mesDe(nueva.fecha);
  // Sin cliente o sin fecha válida no hay con qué comparar: avisar ahí sería adivinar.
  if (!clienteNuevo || !mesNuevo) return null;

  return otras.find((t) =>
    clienteComparable(t.cliente ?? "") === clienteNuevo
    && mesDe(t.fecha) === mesNuevo
    && mismoMonto(t.monto, nueva.monto),
  ) ?? null;
}

/**
 * ¿Esta tarea lleva el registro de transferencias?
 *
 * Se decide por la CATEGORÍA de la tarea, que es texto libre que escribe el equipo. Por eso se
 * compara normalizado y por contenido: "Transferencias", "transferencias de clientes" y "Control
 * de transferencias" son la misma cosa escrita por tres personas distintas. Pedir una categoría
 * exacta habría hecho que la sección no aparezca justo en la tarea que la necesita, sin ningún
 * cartel que explique por qué.
 *
 * OJO CON LA PALABRA: en una concesionaria "transferencia" también es el trámite de dominio de
 * un vehículo. Una tarea con esa categoría va a mostrar esta sección aunque no sea de pagos. El
 * costo es una sección vacía y titulada "Transferencias de clientes", que se entiende sola; el
 * costo de afinar la regla adivinando cómo nombra el equipo sus categorías sería que la sección
 * no aparezca donde hace falta. Si aparece donde molesta, acá se agrega la excepción.
 */
export function esTareaDeTransferencias(categoria: string | null | undefined): boolean {
  return /transferencia/.test(normalizar(categoria ?? ""));
}

/**
 * El monto tipeado en el formulario, o null si no sirve.
 *
 * Acepta coma decimal porque es como se escribe acá ("150000,50"). El punto también, por si se
 * pega desde una planilla. NO se aceptan separadores de miles: "150.000" es ambiguo —¿ciento
 * cincuenta mil o ciento cincuenta pesos?— y adivinar mal el importe de una transferencia es
 * exactamente el error que este registro tiene que evitar.
 */
export function montoValido(txt: string): number | null {
  const limpio = (txt ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** `DD/MM/AAAA` desde `YYYY-MM-DD`, sin pasar por `new Date` (que corre un día por la zona horaria). */
export function fechaCorta(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")
    ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`
    : (fecha ?? "");
}

/** Importe en pesos, con separador de miles y dos decimales. */
export function montoTexto(monto: number): string {
  return Number.isFinite(monto)
    ? monto.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })
    : "—";
}

/**
 * El texto del aviso. Describe LA CARGA, nunca a quien la hizo: no dice "cargaste mal" ni "error"
 * ni de quién era la tarea. Es el encuadre no punitivo del proyecto, y acá importa el doble
 * porque este aviso va a saltar seguido y muchas veces sin que haya nada mal.
 */
export function textoAviso(previa: Transferencia): string {
  const nro = previa.nro_comprobante ? ` (comprobante ${previa.nro_comprobante})` : "";
  return `Ya hay una transferencia parecida: ${previa.cliente} por ${montoTexto(previa.monto)} del ${fechaCorta(previa.fecha)}${nro}.`;
}
