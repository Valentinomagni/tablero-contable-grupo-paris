-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 40
--  El tablón vuelve a respetar a quién le mandaste cada aviso.
--  Correr en Supabase -> SQL Editor. No toca ningún dato.
-- ============================================================================
--
--  QUÉ ARREGLA, EN CRIOLLO
--
--  Cuando publicás un aviso podés elegir a quién se lo mandás. Esa lista de destinatarios
--  hoy NO SE RESPETA del lado de la base: cualquiera con sesión puede leer todos los avisos
--  del tablón por la API, incluidos los dirigidos a otra persona.
--
--  En la pantalla se ve bien, porque la app filtra antes de dibujar. Pero el filtro está del
--  lado del navegador, y eso no es un permiso: es una cortesía.
--
--  POR QUÉ PASABA, Y POR QUÉ NADIE LO VIO
--
--  La versión 1 del tablero creó esta policy:
--
--      create policy "tablon visible para todos" on public.announcements
--        for select to authenticated using (true);
--
--  Después, la migración 15 construyó el sistema de visibilidad de verdad —propios, los que
--  te compartieron, el jefe ve todo, el encargado ve a su equipo— en una policy nueva llamada
--  "ver eventos segun rol". Pero **nunca borró la vieja**.
--
--  Y acá está la trampa que hace esto tan difícil de ver: en Postgres, cuando hay varias
--  policies permisivas para la misma operación, se combinan con **OR**. No con AND. Alcanza
--  con que UNA diga que sí. Entonces la vieja, que dice `true`, gana siempre, y todo el
--  trabajo de la 15 quedó de adorno.
--
--  Es la misma clase de defecto que ya apareció tres veces en este proyecto: un mecanismo que
--  parece estar cuidando algo y no puede. Lo encontró la revisión del código de la v1, que
--  hasta ahora no estaba en el repositorio.
--
--  ESTO NO TOCA NINGÚN DATO. Sólo borra una policy que sobra. Es idempotente.
--
--  DESPUÉS DE CORRERLA: publicá un aviso dirigido a una sola persona y confirmá que otra que
--  no está en la lista no lo ve. Antes lo veía por la API aunque la pantalla se lo ocultara.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) Fuera la policy permisiva de la v1
--
--    `drop policy if exists` para que se pueda correr dos veces sin error.
-- ------------------------------------------------------------

drop policy if exists "tablon visible para todos" on public.announcements;

-- ------------------------------------------------------------
-- 2) Y garantizar que la buena esté puesta
--
--    Se recrea igual a como la dejó la migración 15, para que este archivo se pueda correr
--    solo, sin depender de que la 15 haya pasado antes. Mismo criterio que el resto.
-- ------------------------------------------------------------

drop policy if exists "ver eventos segun rol" on public.announcements;
create policy "ver eventos segun rol" on public.announcements for select using (
  owner_id = auth.uid()                                   -- propios
  or auth.uid() = any(visible_to)                         -- me lo compartieron
  or exists (select 1 from public.profiles p
              where p.id = auth.uid() and p.role = 'jefe')            -- jefe: todos
  or exists (select 1 from public.profiles e
              where e.id = auth.uid() and e.role = 'encargado'
                and exists (select 1 from public.profiles emp
                             where emp.id = public.announcements.owner_id
                               and emp.manager_id = e.id))            -- encargado: su equipo
  or owner_id is null                                     -- avisos generales de la v1
);

-- ------------------------------------------------------------
-- 3) Las otras dos policies `using (true)` de la v1 SE DEJAN, y conviene decir por qué
--
--    La revisión encontró tres en total. Las otras dos son deliberadas y sacarlas rompería
--    la app:
--
--      - `profiles`  -> "perfiles visibles para autenticados". El organigrama, los selectores
--        de responsable y la lista del equipo la necesitan. Efecto colateral a tener presente:
--        cualquiera con sesión puede leer el email y el puesto de todo el equipo. Para una
--        herramienta interna de 30 personas es aceptable; queda anotado para que sea una
--        decisión y no un descuido.
--
--      - `settings`  -> "config visible para autenticados". Son los parámetros del tablero
--        (tiempos máximos, pesos de prioridad, plantilla de cierre). Los lee toda la app.
--
--    Se dejan a propósito. Si algún día se quieren acotar, hay que mirar antes qué pantalla
--    depende de cada una — no es un cambio de una línea.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4) Verificación — corré esto y mirá el resultado
--
--    Tiene que devolver UNA sola fila para `announcements` en select: "ver eventos segun rol".
--    Si sigue apareciendo "tablon visible para todos", la migración no corrió.
-- ------------------------------------------------------------

-- select policyname, cmd, qual from pg_policies
--  where tablename = 'announcements' and cmd = 'SELECT';

insert into public.schema_migrations (id, nombre)
  values (40, 'migracion-40-cerrar-fuga-tablon.sql')
  on conflict (id) do nothing;
