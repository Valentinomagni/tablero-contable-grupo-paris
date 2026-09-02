# Migraciones: cómo se escriben y cómo se aplican

**Desde el 02/09/2026 el dueño no copia migraciones al panel de Supabase.** Se aplican desde la
terminal, y antes se ensayan.

Este documento existe porque hay **dos carpetas** de migraciones y eso confunde. La explicación
está abajo, y la razón es buena.

---

## Las dos carpetas

| Carpeta | Qué es | ¿Se toca? |
|---|---|---|
| `db/migraciones/` | Las 46 migraciones históricas, de la 13 a la 57 | **NO. Congelada.** |
| `supabase/migrations/` | Todo lo nuevo, de acá en adelante | Sí |

### Por qué las 46 viejas NO se mueven, y esto es lo importante

`supabase db push` aplica los archivos de `supabase/migrations/` que **no** figuran en la tabla
`supabase_migrations.schema_migrations` de la base remota.

Esa tabla está **vacía**: el tablero nunca usó el CLI, las 46 se aplicaron a mano.

**Entonces, si alguien mueve las 46 a la carpeta nueva, el CLI va a intentar aplicarlas todas otra
vez.** Y varias son destructivas: el reinicio mensual, el archivado, el volcado de períodos.
Sería reproducir a mano el peor incidente que tuvo este proyecto — el del 05/08, donde volver a
correr el reinicio destruía el archivo del mes y dejaba 0% de cumplimiento para siempre.

Sí, tener dos carpetas es feo. La alternativa es reescribir la historia de una base en uso.

---

## Escribir una migración nueva

```bash
npx supabase migration new nombre_en_minusculas
```

Crea `supabase/migrations/<sello de tiempo>_nombre_en_minusculas.sql`. El sello lo pone el CLI y
**no se edita a mano**: es lo que define el orden de aplicación.

Las reglas de siempre siguen valiendo:

- **Idempotente**: `create table if not exists`, `drop policy if exists`, `create or replace`. Se
  tiene que poder correr dos veces.
- **RLS con `using` y `with check` idénticos.** Este proyecto rompió cuatro tablas por no hacerlo.
- **Nunca una subconsulta a `profiles` dentro de una policy de `profiles`** (error 42P17). Se usan
  los helpers `es_jefe()`, `es_encargado_de(uuid)`, `es_admin_sistema()`.
- **Comentarios en español que explican el POR QUÉ**, y las consultas de comprobación al final.

Lo que **ya no hace falta**: el `insert into public.schema_migrations` del final, y agregar el
número a `MIGRACIONES_ESPERADAS`. De eso se encarga el CLI. Ese mecanismo sigue existiendo sólo
para las 46 históricas.

---

## Aplicarla

```bash
npm run migrar
```

Hace cuatro cosas, en este orden:

1. Lista lo que está pendiente.
2. **Ensaya cada una** dentro de una transacción que se revierte.
3. Si **alguna** falla el ensayo, **no aplica ninguna** y sale con error.
4. Si todas pasan, las aplica y muestra qué quedó.

### El ensayo, y por qué no se puede saltear

```bash
npm run ensayo supabase/migrations/<archivo>.sql
```

Aplica la migración **dentro de una transacción**, corre sus comprobaciones, y termina en
`rollback`. Prueba contra el esquema real y los datos reales, y no deja nada.

**Por qué existe:** durante dos meses las migraciones fueron del editor de texto a producción sin
nada en el medio. Así entraron la que abortaba el reinicio mensual entero (la 53 chocando con la
51), la que se justificó con un comportamiento del front que no existía (la 40), y la que destruía
el archivo del mes (el hallazgo 1 del 05/08).

**No hay bandera para saltearlo.** Si existiera, se usaría el día que haya apuro — que es
exactamente el día en que no hay que usarla.

### Los límites del ensayo, para que nadie los descubra tarde

- **`CONCURRENTLY` no puede ir en una transacción.** Aplica a `create index`, a `drop index` y a
  `refresh materialized view`. El script detecta las tres y se niega, explicando por qué.

  De las 46 históricas **ninguna lo usa**, aunque un `grep` diga que sí: la migración 30 sólo lo
  NOMBRA en un comentario, explicando por qué no lo usa. El detector saca los comentarios antes de
  mirar, justamente para no rechazar migraciones que sí se pueden ensayar — un guardián que da
  falsos positivos se termina desactivando.
- **No prueba nada que dependa del paso del tiempo**: los crons, la acumulación entre meses. Para
  eso sigue haciendo falta pensar.
- **Toma bloqueos mientras corre.** Conviene ensayar cuando no hay nadie trabajando.

---

## La conexión, que se hace una sola vez

Los dos comandos los corre **el dueño**, porque escriben una credencial:

```bash
npx supabase login
npx supabase link --project-ref yyyrlopgwmuvfbzwxiwp
```

El primero abre el navegador. El segundo pide la contraseña de la base (Supabase → Settings →
Database), que **no es la de la cuenta** y que la app no usa para nada: cambiarla no rompe ni
desloguea a nadie.

Después de eso, `npm run migrar` funciona sin pedir nada.

**Si `npx supabase migration list` pide contraseña, el enlace no está hecho.** Ahí se para y se
avisa; no se inventan credenciales ni se busca la vuelta.
