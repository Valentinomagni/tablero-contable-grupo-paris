// Qué días se trabaja, y cuántos hay entre dos fechas.
//
// EL PROBLEMA QUE RESUELVE, como lo reportó Valentino: los fines de semana y los feriados entran
// en el cálculo de tiempos como si fueran demora operativa. Una tarea entregada el viernes y
// revisada el lunes figura con cuatro días de espera; dos de esos días la oficina estaba cerrada.
//
// El efecto no es cosmético: hace que el equipo aparezca más lento de lo que trabajó, en una
// pantalla que el jefe usa para decidir. Es la clase de número que, cuando alguien lo nota, se
// deja de creer todo el resto.
//
// PURA: las fechas entran por parámetro y los feriados también. Sin `new Date()` adentro, sin
// consultar la base. Eso la hace testeable sin congelar el reloj ni levantar Postgres.
//
// LOS FERIADOS NO SE ADIVINAN. Argentina tiene feriados móviles, puentes que se deciden por
// decreto cada año, y días no laborables propios de la empresa (un inventario, una capacitación).
// Ninguna tabla fija los cubre. Por eso los carga el jefe a mano, y esta lib sólo los aplica.

/**
 * Parte una fecha `YYYY-MM-DD` en números, o `null` si no tiene esa forma o no existe.
 *
 * POR QUÉ A MANO Y NO CON `new Date(iso)`. Porque `new Date("2026-08-08")` se parsea como
 * medianoche UTC y `.getDay()` devuelve el día en la zona LOCAL: en Argentina (UTC-3) eso corre
 * todo un día, y un sábado pasaría por viernes hábil.
 *
 * El costo de ese error acá es directo: agosto tendría 22 días hábiles en vez de 21, y el avance
 * del arqueo daría siempre por debajo de lo real.
 */
function partes(iso: string): { y: number; m: number; d: number } | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mes = Number(m[2]), d = Number(m[3]);
  // `Date.UTC` normaliza de más: el 45 de diciembre se convierte en una fecha de enero sin
  // quejarse. Se comprueba que lo que salió sea lo que entró, o la fecha no existía.
  const v = new Date(Date.UTC(y, mes - 1, d));
  if (v.getUTCFullYear() !== y || v.getUTCMonth() !== mes - 1 || v.getUTCDate() !== d) return null;
  return { y, m: mes, d };
}

/** `YYYY-MM-DD` desde un instante UTC. */
function aISO(t: number): string {
  const v = new Date(t);
  const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(v.getUTCDate()).padStart(2, "0");
  return `${v.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * ¿Se trabaja este día?
 *
 * No es hábil si cae sábado o domingo, o si está en la lista de días cargados a mano.
 * Ante una fecha que no se puede interpretar, `false`: contar como hábil un día que no existe
 * infla el denominador y hunde el porcentaje de todos.
 */
export function esHabil(fechaISO: string, noLaborables: Set<string>): boolean {
  const p = partes(fechaISO);
  if (!p) return false;
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  if (dow === 0 || dow === 6) return false;          // domingo o sábado
  return !(noLaborables instanceof Set && noLaborables.has(fechaISO));
}

/**
 * Todos los días hábiles de un mes `YYYY-MM`, en orden.
 *
 * Es el denominador del avance mensual: "6 de 24 arqueos". Que salga de acá y no de una cuenta
 * a ojo es lo que hace que el número signifique algo.
 */
export function habilesDelMes(mes: string, noLaborables: Set<string>): string[] {
  if (typeof mes !== "string") return [];
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return [];
  const y = Number(m[1]), mm = Number(m[2]);
  if (mm < 1 || mm > 12) return [];
  // El día 0 del mes siguiente es el último del actual.
  const ultimo = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const iso = aISO(Date.UTC(y, mm - 1, d));
    if (esHabil(iso, noLaborables)) out.push(iso);
  }
  return out;
}

/**
 * Cuántos días hábiles hay entre dos fechas, contando las dos puntas.
 *
 * Del lunes al viernes son 5. **Del viernes al lunes son 2, no 4** — ése es el caso que motivó
 * toda esta lib.
 *
 * Si las fechas vienen al revés devuelve 0 y no un negativo. Un negativo se propagaría a un
 * promedio y produciría un tiempo de ciclo imposible: el cero se nota, el negativo se promedia
 * en silencio.
 */
export function diasHabilesEntre(desdeISO: string, hastaISO: string, noLaborables: Set<string>): number {
  const a = partes(desdeISO), b = partes(hastaISO);
  if (!a || !b) return 0;
  const desde = Date.UTC(a.y, a.m - 1, a.d);
  const hasta = Date.UTC(b.y, b.m - 1, b.d);
  if (hasta < desde) return 0;
  const UN_DIA = 86_400_000;
  let n = 0;
  for (let t = desde; t <= hasta; t += UN_DIA) {
    if (esHabil(aISO(t), noLaborables)) n++;
  }
  return n;
}
