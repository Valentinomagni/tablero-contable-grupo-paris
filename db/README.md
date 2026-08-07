# La base de datos, ordenada

Hasta el 07/08/2026 había **29 archivos `.sql` sueltos en la raíz del repositorio**, mezclados
con la configuración. Encontrar algo ahí era imposible y el orden importaba: son el único lugar
donde vive el esquema.

```
db/
  migraciones/    Las que están vigentes (13 a 41). Se corren en Supabase -> SQL Editor.
  historico/      La v1 (esquema base + 2 a 12) y el compilado viejo. NO se corren.
edge-functions/   Las tres funciones desplegadas en Supabase.
```

---

## `db/migraciones/` — lo vigente

Se corren **una vez cada una, en orden, pegándolas en Supabase → SQL Editor**. Todas son
idempotentes: correrlas dos veces no rompe nada.

**Cómo saber cuál falta:** el chip de Administración. Verde es que están todas; ámbar dice
exactamente cuáles. Ese chip lee la tabla `schema_migrations`, y cada migración de la 26 en
adelante se anota sola al final de su propio archivo.

Hay un test (`src/lib/migraciones.guard.test.ts`) que compara esta carpeta contra la lista de
`src/lib/migraciones.ts` y falla si alguna queda sin vigilar. Existe porque esa lista **se quedó
en la 28 mientras se escribían nueve migraciones más**, y el chip mostraba "Base de datos al día"
sin haber mirado ninguna.

## `db/historico/` — la v1, para consultar

**Nada de acá se corre.** Está por dos motivos, y los dos ya se pagaron solos:

1. **`supabase-schema.sql`** crea `profiles` y `cards`, y define las policies base. Durante meses
   nadie pudo responder "¿qué permite borrar una tarjeta?", porque esa policy no estaba en el
   repositorio. Está acá: `borrar tarjetas propias o ser jefe`.

2. **`migracion-2.sql` a `migracion-12.sql`** son las de la v1. Al leerlas apareció un defecto
   vivo: `migracion-7.sql` crea `"tablon visible para todos"` sobre `announcements` con
   `using (true)`, y la migración 15 construyó encima el sistema de visibilidad sin borrar la
   vieja. **Como las policies se combinan con OR, ganaba la permisiva** y el `visible_to` del
   tablón era decorativo. Lo cierra la migración 40.

`migraciones-pendientes.sql` también está acá: es un compilado de la 32 a la 35 que ya se
aplicaron. Su cabecera dice que es histórico.

## Qué NO está acá

**`migracion-1.sql` no existe** en ninguna parte. Lo que hace su trabajo es `supabase-schema.sql`.
Si alguna vez hay que reconstruir la base desde cero, el orden es: `supabase-schema.sql`, después
`historico/migracion-2` a `12`, después `migraciones/migracion-13` en adelante.

**Eso nunca se probó.** `docs/BACKUP-RESTORE.md` cierra diciendo *"un backup sin restore probado
es una esperanza"*, y sigue siendo cierto.

---

## Reglas al escribir una migración nueva

Todas salieron de romper algo:

- **Idempotente siempre.** `if not exists`, `drop policy if exists`, `on conflict do nothing`. Se
  tiene que poder correr dos veces.
- **Que se anote sola** al final: `insert into public.schema_migrations (id, nombre) values (N, '...') on conflict (id) do nothing;`
  Si te olvidás, el chip la va a dar por faltante **para siempre**, y volver a correrla no lo
  arregla. Pasó con la 35 y la 36.
- **Agregá su número** a `MIGRACIONES_ESPERADAS` en `src/lib/migraciones.ts`. El guardián te avisa
  si te olvidás de esto o de lo anterior.
- **Si agrega una columna a `cards` o a `profiles`**, tiene que aparecer en `src/lib/esquema.ts`
  con su gate. Sin eso, PostgREST falla el update **entero** con 42703 por una columna que falta.
- **`using` y `with check` de una tabla de trabajo dicen lo mismo**, salvo que haya un motivo
  escrito al lado. Ya pasó tres veces (migraciones 36, 39 y 40): alguien ve algo que no puede
  guardar, y el error que recibe es el crudo de Postgres.
- **Explicá en criollo, arriba de todo, qué arregla y a quién le pasa.** Estos archivos los lee
  una persona que no es programadora, meses después, cuando algo anda mal.
