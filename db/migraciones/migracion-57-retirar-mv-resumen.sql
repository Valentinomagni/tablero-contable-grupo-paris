-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 57
--  Retirar `mv_resumen_mensual` y su función de lectura.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  QUÉ SE SACA Y POR QUÉ. Esto no es limpieza cosmética: es sacar algo que, si alguien lo
--  llegara a usar, daría números equivocados.
--
--  La migración 30 creó una vista materializada con KPIs por mes/persona/marca, pensada para que
--  el análisis histórico no tuviera que recorrer `cards_archive` en cada carga. Nunca la usó
--  nadie. Cuatro razones, y las cuatro se comprobaron leyendo el código y las migraciones:
--
--  1. ESTÁ MAL DESDE EL PRIMER DÍA. Agrega TODAS las filas de `cards_archive` sin excluir las
--     tareas operativas. Todos los consumidores del histórico —`analizarMes`,
--     `comparativaMensual`, `curvaPersona`, `concentracion`— las excluyen antes de calcular
--     porcentajes. O sea que `total` y `terminadas` no coinciden con ninguna pantalla.
--
--  2. ESTÁ CONGELADA. No hay ningún cron que la refresque: `select jobname from cron.job` no la
--     nombra. El único `refresh` está en la propia migración 30, de una sola vez. Lo que
--     contiene es la foto del día que se corrió esa migración, hace meses.
--
--     Esto es lo que cambia la decisión. Una vista sin usar es infraestructura ociosa; una vista
--     sin usar Y sin refrescar es una trampa: el día que alguien la conecte, va a mostrar datos
--     viejos con toda la confianza de un número precalculado.
--
--  3. LE FALTAN COLUMNAS QUE SUS CONSUMIDORES NECESITAN. `comparador.ts` necesita `sucursal` y
--     `busfactor.ts` necesita `categoria`. Ninguna de las dos está.
--
--  4. Y AUNQUE SE ARREGLARAN LAS TRES ANTERIORES, SEGUIRÍA SIN SERVIR PARA UNA. `busfactor.ts`
--     deduplica por tarjeta individual, y eso es imposible de reconstruir a partir de conteos ya
--     agregados. No es que falte una columna: se perdió la granularidad.
--
--  POR QUÉ RETIRAR Y NO ARREGLAR
--
--  Arreglarla sería: agregar dos columnas, agregar el filtro de operativas, y programar un cron
--  de refresco. Tres cosas, para que después siga sin servirle a `busfactor` por el punto 4.
--
--  Y del otro lado: las pantallas que la habrían usado ya calculan bien desde los datos crudos y
--  responden sin demora perceptible. No hay un problema de rendimiento esperando esta solución.
--
--  NO SE PIERDE NINGÚN DATO. Una vista materializada es una copia derivada: todo lo que contiene
--  sale de `cards_archive`, que no se toca. Si algún día hace falta, se vuelve a crear con el
--  filtro y las columnas correctas — y esta vez con su cron.
-- ============================================================================

-- El orden importa: primero la función, que depende de la vista.
drop function if exists public.resumen_mensual(text);

drop materialized view if exists public.mv_resumen_mensual;

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Ya no existen:
--
--       select matviewname from pg_matviews where matviewname = 'mv_resumen_mensual';
--       select proname from pg_proc where proname = 'resumen_mensual';
--
--     Las dos tienen que devolver CERO filas.
--
--  2) El archivo histórico sigue intacto, que es lo único que importaba:
--
--       select count(*) as filas, count(distinct mes) as meses from public.cards_archive;
--
--     Tiene que dar lo mismo que antes de correr esto. Si da cero, algo salió muy mal y hay que
--     parar — pero no debería: esta migración no toca esa tabla.

insert into public.schema_migrations (id, nombre)
  values (57, 'migracion-57-retirar-mv-resumen.sql')
  on conflict (id) do nothing;
