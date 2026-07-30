-- ============================================================
-- MIGRACIÓN 36 — Un encargado puede VER y GUARDAR el trabajo de su equipo
--
-- Corrige dos cosas que reportó Celeste el 30/07/2026, y las dos son la misma falla de
-- fondo: los permisos de LECTURA y los de ESCRITURA no coinciden.
--
-- ------------------------------------------------------------
-- SÍNTOMA 1 — "si quiero editar alguna tarea me aparece ese cartel"
--     new row violates row-level security policy for table "task_occurrences"
-- ------------------------------------------------------------
-- La policy de la migración 16 dice, textual:
--
--     using       (dueño  OR jefe  OR encargado-de-esa-persona)   ← leer
--     with check  (dueño  OR jefe)                                ← escribir
--
-- O sea: un encargado PUEDE VER las ocurrencias de su equipo pero NO PUEDE CREARLAS.
-- Guardar una recurrencia genera ocurrencias con `owner` = la persona dueña de la tarea, y
-- ahí el `with check` corta. Por eso el error aparece justo al guardar la recurrencia de la
-- tarea de otra persona, y no al abrirla.
--
-- Es un descuido clásico: se pensó bien quién puede mirar y se olvidó el mismo caso al
-- escribir. La regla correcta es que quien puede gestionar el tablero de alguien pueda
-- también guardar en él — que es exactamente lo que ya hace la policy de `cards`
-- (migración 14-FIX): `owner = auth.uid() or es_jefe() or es_encargado_de(owner)`.
--
-- ------------------------------------------------------------
-- SÍNTOMA 2 — "acá en las operativas, no puedo ver lo que va registrando"
--             "si está registrando, porque en su compu sí lo veo"
-- ------------------------------------------------------------
-- Los contadores "hoy" y "7 días" de las tareas operativas salen de `activity_log`. Que la
-- persona vea sus propios registros y otra no los vea es la firma exacta de una policy de
-- lectura limitada a `owner = auth.uid()`.
--
-- HONESTIDAD SOBRE ESTE PUNTO: `activity_log` se creó antes de la migración 13, así que su
-- policy NO está en ningún archivo del repositorio y no la pude leer. Lo de arriba es una
-- deducción a partir del síntoma, no una lectura. Esta migración la deja definida como
-- corresponde sea cual sea su estado anterior — y de paso queda por fin escrita en el repo,
-- que es un problema aparte que también convenía cerrar.
--
-- ------------------------------------------------------------
-- EL MODELO DE PERMISOS, QUE NO CAMBIA
-- ------------------------------------------------------------
--   · empleado  → sólo lo suyo
--   · encargado → lo suyo y lo de las personas que le reportan
--   · jefe      → todo
--
-- Esto NO amplía el acceso de nadie: le da al encargado, para escribir, el mismo alcance que
-- ya tenía para leer. Un empleado sigue viendo y tocando únicamente lo propio.
--
-- Se usan los helpers `SECURITY DEFINER` `es_jefe()` y `es_encargado_de(uuid)` en vez de
-- subconsultas escritas a mano: es la convención del proyecto y evita la recursión de
-- policies (42P17) que ya costó una migración de urgencia, la 14-FIX.
--
-- Idempotente: se puede correr las veces que sea.
-- ============================================================

-- ------------------------------------------------------------
-- 1) task_occurrences — el `with check` pasa a igualar al `using`
-- ------------------------------------------------------------
drop policy if exists "occ propias o jefe" on public.task_occurrences;
drop policy if exists "occ del equipo" on public.task_occurrences;

create policy "occ del equipo" on public.task_occurrences for all
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  )
  with check (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

-- ------------------------------------------------------------
-- 2) activity_log — mismo alcance, para que los contadores de las operativas
--    se vean igual desde el tablero propio y desde el de quien lo gestiona
-- ------------------------------------------------------------
alter table public.activity_log enable row level security;

drop policy if exists "activity propias" on public.activity_log;
drop policy if exists "activity propias o jefe" on public.activity_log;
drop policy if exists "activity del equipo" on public.activity_log;

create policy "activity del equipo" on public.activity_log for all
  using (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  )
  with check (
    owner = auth.uid()
    or public.es_jefe()
    or public.es_encargado_de(owner)
  );

-- ------------------------------------------------------------
-- VERIFICACIÓN — vale la pena correrla, son dos consultas
-- ------------------------------------------------------------
-- 1) Ver que quedaron las dos policies nuevas y ninguna vieja suelta:
--
--      select tablename, policyname
--        from pg_policies
--       where tablename in ('task_occurrences','activity_log')
--       order by tablename;
--
--    Tiene que devolver exactamente dos filas: "occ del equipo" y "activity del equipo".
--
-- 2) Confirmar que la jerarquía está bien cargada, que es de lo que depende TODO esto.
--    `es_encargado_de()` mira `manager_id`: si la persona no tiene cargado a su encargado,
--    el encargado va a seguir sin ver ni poder guardar, y no es culpa de la policy.
--
--      select p.name as persona, m.name as le_reporta_a
--        from public.profiles p
--        left join public.profiles m on m.id = p.manager_id
--       where p.oculto is not true
--       order by 2 nulls first, 1;
--
--    Si en esa lista alguien de un equipo aparece con `le_reporta_a` vacío, el arreglo se
--    completa desde Administración asignándole su encargado.
-- ------------------------------------------------------------
