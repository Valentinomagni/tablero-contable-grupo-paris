-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 52
--  Adjuntar una captura al reportar un problema.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  EL REPORTE DE MATHI: no se puede mandar evidencia visual, y eso hace que un error tarde tres
--  mensajes en entenderse. "No me deja guardar" puede ser diez cosas distintas; la captura las
--  distingue en un segundo.
--
--  POR QUÉ UN BUCKET NUEVO Y NO EL DE `adjuntos`
--
--  Ésta es la decisión importante de la migración, y no es de comodidad.
--
--  El bucket `adjuntos` lo puede leer cualquiera con sesión (migración 42): es para los papeles
--  de una tarea, que son trabajo compartido. Consultas es otra cosa. Es el canal por el que
--  alguien reporta un problema **contando con que su jefe no lo lee** — por eso la bandeja la
--  recibe la cuenta de administración (migración 33) y no el jefe.
--
--  Una captura de pantalla muestra más de lo que el texto dice: la pestaña de al lado, el
--  nombre del archivo abierto, una notificación que entró justo. Guardarla donde la ve todo el
--  equipo convierte una promesa de confidencialidad en una filtración, y una promesa de
--  confidencialidad que no se cumple es peor que no haberla hecho: la próxima vez esa persona
--  no reporta nada.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La columna
-- ------------------------------------------------------------

alter table public.consultas add column if not exists adjunto_path text;

comment on column public.consultas.adjunto_path is
  'Ruta dentro del bucket privado `consultas`. La lee solo el autor y la cuenta de administracion.';

-- ------------------------------------------------------------
-- 2) El bucket, PRIVADO
--
--    `public = false` es lo que hace que la URL no sirva sin firmar. Con `true`, cualquiera con
--    el enlace ve el archivo aunque las policies digan otra cosa: el enlace publico de Storage
--    no pasa por RLS. Es el error clasico y seria justo el peor lugar para cometerlo.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
  values ('consultas', 'consultas', false)
  on conflict (id) do update set public = false;

-- ------------------------------------------------------------
-- 3) Permisos del bucket
--
--    SUBIR: cualquiera con sesión, pero SÓLO a su propia carpeta. La ruta empieza con el uuid
--    de quien sube (`<uid>/archivo.png`), y la policy lo verifica: sin eso, alguien podría
--    escribir en la carpeta de otro y la captura quedaría atribuida a quien no la mandó.
--
--    LEER: la cuenta de administración —que es quien atiende la bandeja— y el autor, que tiene
--    que poder revisar lo que mandó. Nadie más. En particular, el jefe NO.
--
--    `using` y `with check` dicen lo mismo donde aplican los dos, que es la regla que este
--    proyecto aprendió rompiendo cuatro tablas.
-- ------------------------------------------------------------

drop policy if exists "consultas_adj_insert" on storage.objects;
create policy "consultas_adj_insert" on storage.objects for insert with check (
  bucket_id = 'consultas'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "consultas_adj_select" on storage.objects;
create policy "consultas_adj_select" on storage.objects for select using (
  bucket_id = 'consultas'
  and (
    public.es_admin_sistema()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- BORRAR: sólo la cuenta de administración. Que el autor no pueda borrar es deliberado — si
-- pudiera, un reporte incómodo se podría hacer desaparecer después de mandado, y la bandeja
-- dejaría de ser un registro.
drop policy if exists "consultas_adj_delete" on storage.objects;
create policy "consultas_adj_delete" on storage.objects for delete using (
  bucket_id = 'consultas' and public.es_admin_sistema()
);

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) La columna y el bucket existen, y el bucket NO es público:
--
--       select column_name from information_schema.columns
--        where table_name = 'consultas' and column_name = 'adjunto_path';
--
--       select id, public from storage.buckets where id = 'consultas';   -- public tiene que ser false
--
--  2) Las tres policies:
--
--       select policyname, cmd from pg_policies
--        where tablename = 'objects' and policyname like 'consultas_adj%' order by cmd;
--
--  3) La prueba que de verdad importa, y conviene hacerla: entrá con una cuenta de EMPLEADO,
--     mandá una consulta con captura, y despues entrá con la cuenta del JEFE y verificá que
--     NO puede abrirla. Si el jefe la ve, la promesa del canal es falsa y hay que parar todo.

insert into public.schema_migrations (id, nombre)
  values (52, 'migracion-52-consultas-adjunto.sql')
  on conflict (id) do nothing;
