import { describe, it, expect } from "vitest";
import { esEnsayable, sinComentarios, armarEnsayo } from "./ensayar-migracion.mjs";

// Qué migración se puede ensayar dentro de una transacción que se revierte.
//
// POR QUÉ IMPORTA ESTE DETALLE. Postgres aplica los cambios de esquema transaccionalmente, así
// que una migración entera más sus comprobaciones pueden correr con `begin` y terminar en
// `rollback`. Eso es lo que reemplaza al banco de pruebas sin necesitar un segundo proyecto.
//
// La excepción es `CREATE INDEX CONCURRENTLY`: Postgres lo prohíbe explícitamente dentro de una
// transacción. Sin esta comprobación, el ensayo fallaría con un error crudo de Postgres y
// parecería que la migración está mal, cuando el que no sirve es el ensayo.

describe("qué migración se puede ensayar", () => {
  it("una migración normal, sí", () => {
    expect(esEnsayable("create table if not exists x (id int);")).toEqual({ ok: true });
  });

  it("con CREATE INDEX CONCURRENTLY, no, y dice por qué", () => {
    const r = esEnsayable("create index concurrently foo on bar (baz);");
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("CONCURRENTLY");
  });

  it("lo detecta sin importar mayúsculas ni espacios de más", () => {
    expect(esEnsayable("CREATE  INDEX   CONCURRENTLY x on y (z);").ok).toBe(false);
    expect(esEnsayable("create\nindex\nconcurrently x on y (z);").ok).toBe(false);
  });

  it("también detecta DROP INDEX CONCURRENTLY", () => {
    // Menos frecuente, pero tiene la misma restricción y el mismo síntoma si se escapa.
    expect(esEnsayable("drop index concurrently if exists x;").ok).toBe(false);
  });

  // UN GUARDIÁN QUE DA FALSOS POSITIVOS SE TERMINA DESACTIVANDO. Varias migraciones de este
  // proyecto explican EN COMENTARIOS por qué no usan `concurrently`. Si el detector mirara los
  // comentarios, se negaría a ensayar migraciones perfectamente ensayables, y a la tercera vez
  // alguien saltearía el ensayo entero.
  it("la palabra dentro de un comentario NO cuenta", () => {
    expect(esEnsayable("-- ojo: no usar concurrently acá\ncreate table x (id int);").ok).toBe(true);
    expect(esEnsayable("/* create index concurrently seria un error */\ncreate table x (id int);").ok).toBe(true);
  });

  it("un archivo vacío no es ensayable: no hay nada que probar", () => {
    expect(esEnsayable("").ok).toBe(false);
    expect(esEnsayable("   \n-- solo comentarios\n").ok).toBe(false);
  });
});

describe("sacar los comentarios", () => {
  it("saca los de línea", () => {
    expect(sinComentarios("select 1; -- esto no cuenta").trim()).toBe("select 1;");
  });

  it("saca los de bloque, incluso en varias líneas", () => {
    expect(sinComentarios("/* a\nb\nc */select 1;").trim()).toBe("select 1;");
  });

  it("no se come el SQL que hay entre dos comentarios", () => {
    const r = sinComentarios("-- uno\nselect 1;\n-- dos\nselect 2;");
    expect(r).toContain("select 1;");
    expect(r).toContain("select 2;");
  });
});

describe("cómo se arma el ensayo", () => {
  const sql = "create table x (id int);";

  it("envuelve la migración entre begin y rollback", () => {
    const t = armarEnsayo(sql);
    expect(t.startsWith("begin;")).toBe(true);
    expect(t.trimEnd().endsWith("rollback;")).toBe(true);
    expect(t).toContain(sql);
  });

  // SIN ESTO EL ENSAYO SERÍA PEOR QUE NO TENERLO. Si la migración falla a la mitad, la
  // transacción queda abortada y el `rollback` del final igual la cierra — pero si alguien
  // sacara el `rollback` "porque ya falló", los cambios de una corrida exitosa quedarían
  // aplicados sin que nadie lo pidiera.
  it("el rollback va SIEMPRE, haya fallado o no", () => {
    expect(armarEnsayo("select 1/0;")).toContain("rollback;");
  });

  it("no agrega un commit por ningún lado", () => {
    // Un `commit` perdido en el texto convertiría el ensayo en una aplicación real.
    expect(armarEnsayo(sql).toLowerCase()).not.toContain("commit;");
  });
});

// REFRESH MATERIALIZED VIEW CONCURRENTLY tiene la MISMA restricción y el detector no lo veía.
//
// Salió de correr el detector contra las 46 migraciones reales: dio 46 ensayables y 0 rechazos,
// cuando un `grep` anterior había marcado la 30. El grep tenía razón sobre el texto y estaba
// equivocado sobre el hecho — ahí `concurrently` está dentro de un comentario. Pero revisando
// ESE archivo apareció que la instrucción `refresh materialized view` sí admite la variante
// concurrente, y ésa tampoco puede ir en una transacción.
describe("refresh materialized view concurrently", () => {
  it("tampoco se puede ensayar", () => {
    const r = esEnsayable("refresh materialized view concurrently public.mv_x;");
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("CONCURRENTLY");
  });

  it("sin concurrently, sí se puede", () => {
    // Es lo que hace la migración 30 de verdad, y por eso es ensayable.
    expect(esEnsayable("refresh materialized view public.mv_x;").ok).toBe(true);
  });

  it("y el comentario que sólo la NOMBRA sigue sin contar", () => {
    // La migración 30 explica en un comentario por qué NO usa concurrently. Si esto diera
    // false, el detector rechazaría una migración perfectamente ensayable.
    const sql = "-- NO concurrently: falla sobre una matview sin refrescar\nrefresh materialized view public.mv_x;";
    expect(esEnsayable(sql).ok).toBe(true);
  });
});
