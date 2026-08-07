-- ============================================================================
--  TABLERO CONTABLE — MIGRACIÓN 42
--  El encargado puede escribir lo que ve, y los adjuntos dejan de ser públicos.
--  Correr en Supabase -> SQL Editor. No toca ningún dato.
-- ============================================================================
--
--  ESTA ES LA CUARTA VEZ DEL MISMO PATRÓN, Y POR ESO SE CIERRA ENTERO
--
--  Ya pasó tres veces: la migración 36 (`task_occurrences`, `activity_log`), la 39
--  (`notifications`) y la 40 (`announcements`). Siempre igual: una tabla donde el encargado
--  PUEDE LEER lo de su equipo y NO PUEDE ESCRIBIRLO. La pantalla le ofrece el botón, la base lo
--  rechaza, y el error que recibe es el crudo de Postgres — cuando lo recibe, porque a veces se
--  descarta solo.
--
--  Se arreglaba de a una tabla por vez, cada vez que alguien se quejaba. Esta migración cierra
--  las CUATRO que quedaban, encontradas recorriendo la app rol por rol en vez de esperar el
--  reclamo.
--
--  ESTO NO TOCA NINGÚN DATO. Sólo cambia quién puede hacer qué.
-- ============================================================================


-- ============================================================================
--  1) `cards`: el encargado puede mover una tarea de su equipo pero no crearla
-- ============================================================================
--
--  QUÉ ESTABA MAL. Las policies de `cards` no dicen lo mismo entre sí:
--
--      SELECT  -> owner = uid  or es_jefe()  or es_encargado_de(owner)      (mig 22)
--      UPDATE  -> owner = uid  or es_jefe()  or es_encargado_de(owner)      (mig 14-FIX)
--      DELETE  -> owner = uid  or is_jefe()                                 (esquema v1)
--      INSERT  -> owner = uid  or is_jefe()                                 (esquema v1)
--
--  `es_encargado_de` nunca entró ni en el alta ni en el borrado.
--
--  QUÉ SE ROMPE, EN CONCRETO. Celeste abre el tablero de alguien de su equipo. Arrastra una
--  tarjeta de columna: anda. Le cambia el vencimiento: anda. Aprieta "+ Nueva tarea", carga
--  título y vencimiento, confirma -> "No tenés permiso para esto".
--
--  Y si usa el "+ Añadir tarea" de la columna en vez del modal, es peor: esa mutación no tiene
--  manejo de error, así que el campo se cierra, no aparece ningún cartel, y la tarea
--  simplemente no existe. Es el mismo modo de falla que la migración 39: el error se descarta
--  solo y nadie se entera.

drop policy if exists "encargado crea cards de su equipo" on public.cards;
create policy "encargado crea cards de su equipo" on public.cards for insert
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "encargado borra cards de su equipo" on public.cards;
create policy "encargado borra cards de su equipo" on public.cards for delete
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

-- OJO: las dos restrictivas de la migración 22 y la 39 (`not protected or es_jefe()`) siguen
-- vigentes y se combinan con AND. O sea: el encargado NO puede crear ni borrar tareas
-- protegidas. Eso es correcto y no se toca — el candado del jefe existe justamente para eso.


-- ============================================================================
--  2) `card_periodos`: nadie puede escribir en un mes que no es el vigente. Ni el jefe
-- ============================================================================
--
--  QUÉ ESTABA MAL. La migración 32 dejó:
--
--      SELECT  -> owner = uid  or es_jefe()  or es_encargado_de(owner)
--      INSERT  -> owner = uid
--      UPDATE  -> owner = uid  (using y with check)
--      DELETE  -> owner = uid
--
--  Ni siquiera el jefe está en la escritura.
--
--  QUÉ SE ROMPE. Es 20 de julio. El jefe abre el tablero de alguien del equipo, elige "agosto"
--  en el selector de período para adelantar trabajo del cierre, y arrastra una tarjeta a
--  Terminado. La tarjeta se mueve al instante — es la mutación optimista. La base rechaza el
--  guardado. El manejo de error **restaura la pantalla sin mostrar ningún cartel**, así que la
--  tarjeta vuelve sola a su columna.
--
--  Se ve exactamente como un bug de arrastre. Se intenta tres veces más. Nunca se guarda nada y
--  nunca se explica por qué.
--
--  NOTA SOBRE ESTA MIGRACIÓN. El plan de calidad especificaba este arreglo con el número 40, y
--  ese número se usó para otra cosa (la fuga del tablón). El arreglo quedó sin escribir y la
--  numeración tapó el olvido: como el 40 existía, parecía hecho. Por eso va acá, con el número
--  que le tocó, y con esta nota — para que se vea que fue un descuido y no un cambio de plan.

drop policy if exists "card_periodos_insert" on public.card_periodos;
create policy "card_periodos_insert" on public.card_periodos for insert
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "card_periodos_update" on public.card_periodos;
create policy "card_periodos_update" on public.card_periodos for update
  using      (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner))
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "card_periodos_delete" on public.card_periodos;
create policy "card_periodos_delete" on public.card_periodos for delete
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));


-- ============================================================================
--  3) `objectives`: el encargado no ve los objetivos de su equipo, y la pantalla le miente
-- ============================================================================
--
--  QUÉ ESTABA MAL. Esta tabla quedó con las cuatro policies de la versión 1 y **nunca se
--  tocó**: todas dicen `owner = auth.uid() or is_jefe()`. No existe `es_encargado_de` en
--  ninguna.
--
--  QUÉ SE ROMPE. El encargado abre el tablero de alguien de su equipo, pestaña Objetivos, y lee
--  "Sin objetivos cargados para Juan" y un cartel amarillo que dice "Suman 0% — falta asignar
--  100%". Los objetivos de Juan existen y suman 100%; simplemente no le llegan.
--
--  O sea que la pantalla no le oculta el dato: **le afirma lo contrario del dato**. Concluye que
--  Juan no cargó nada, intenta cargarlo él, y ahí sí recibe el error de permiso. Termina con dos
--  informaciones falsas y ninguna acción posible.

drop policy if exists "ver objetivos propios o ser jefe" on public.objectives;
create policy "ver objetivos propios o ser jefe" on public.objectives for select to authenticated
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "crear objetivos propios o ser jefe" on public.objectives;
create policy "crear objetivos propios o ser jefe" on public.objectives for insert to authenticated
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "editar objetivos propios o ser jefe" on public.objectives;
create policy "editar objetivos propios o ser jefe" on public.objectives for update to authenticated
  using      (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner))
  with check (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));

drop policy if exists "borrar objetivos propios o ser jefe" on public.objectives;
create policy "borrar objetivos propios o ser jefe" on public.objectives for delete to authenticated
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));


-- ============================================================================
--  4) `daily_snapshots`: la última tabla del modelo de equipo sin el encargado
-- ============================================================================
--
--  QUÉ ESTABA MAL. Conserva la policy de la v1. Es la única tabla del modelo de equipo a la que
--  nunca se le agregó `es_encargado_de` — la migración 36 se lo dio a `task_occurrences` y a
--  `activity_log`, y ésta quedó afuera.
--
--  QUÉ SE ROMPE, y es sutil. El panel de "Utilización del tiempo" del Reporte mira tres fuentes
--  para saber si alguien tuvo actividad un día: cierres de tareas, el registro de actividad, y
--  estas fotos diarias. Al encargado le llegan las dos primeras y de la tercera sólo las suyas.
--
--  Resultado: el panel **subestima sistemáticamente a todo su equipo menos a él**, y muestra
--  "X días sin actividad registrada" para gente que sí trabajó pero cuya señal de ese día
--  estaba únicamente en la foto diaria. En una pantalla que aclara que no mide presencia, es el
--  número más fácil de leer mal.

drop policy if exists "ver snapshots propios o ser jefe" on public.daily_snapshots;
create policy "ver snapshots propios o ser jefe" on public.daily_snapshots for select to authenticated
  using (owner = auth.uid() or public.es_jefe() or public.es_encargado_de(owner));


-- ============================================================================
--  5) Los adjuntos: cualquiera con sesión se puede bajar los de toda la empresa
-- ============================================================================
--
--  QUÉ ESTABA MAL. La policy del bucket era:
--
--      using (bucket_id = 'adjuntos' and auth.role() = 'authenticated')
--
--  y el comentario que tenía arriba lo admitía: "la app filtra por card en el path". Es
--  exactamente el patrón que la migración 40 acaba de condenar para el tablón: **el filtro está
--  del lado del navegador, y eso no es un permiso.**
--
--  QUÉ SE ROMPE. Un empleado, desde la consola del navegador y con su sesión normal:
--
--      const { data } = await supabase.storage.from('adjuntos').list('')
--
--  Cada carpeta que devuelve es el id de una tarea, incluidas las que no puede ni ver. Después
--  pide la URL firmada de cada archivo y se baja los extractos bancarios, las planillas de IVA y
--  las evidencias de arqueo de todas las concesionarias. Sin dejar rastro: las descargas no se
--  registran en ningún lado.
--
--  EL ARREGLO. Que el primer tramo del path tenga que ser una tarea que la persona puede leer.
--  No hace falta tocar el front: ya guarda todo como `<id-de-tarea>/<archivo>`.

drop policy if exists "adjuntos_select" on storage.objects;
create policy "adjuntos_select" on storage.objects for select using (
  bucket_id = 'adjuntos'
  and exists (
    select 1 from public.cards c
     where c.id::text = (storage.foldername(name))[1]
       and (c.owner = auth.uid() or public.es_jefe() or public.es_encargado_de(c.owner))
  )
);

drop policy if exists "adjuntos_insert" on storage.objects;
create policy "adjuntos_insert" on storage.objects for insert with check (
  bucket_id = 'adjuntos'
  and exists (
    select 1 from public.cards c
     where c.id::text = (storage.foldername(name))[1]
       and (c.owner = auth.uid() or public.es_jefe() or public.es_encargado_de(c.owner))
  )
);


-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
-- ============================================================================
--
--  1) Las policies de las cuatro tablas tienen que nombrar `es_encargado_de` en escritura:
--
--       select tablename, policyname, cmd
--         from pg_policies
--        where schemaname = 'public'
--          and tablename in ('cards','card_periodos','objectives','daily_snapshots')
--          and (qual like '%es_encargado_de%' or with_check like '%es_encargado_de%')
--        order by tablename, cmd;
--
--  2) Y en la app, pedile a un encargado que pruebe estas cuatro cosas, que antes fallaban:
--       - crear una tarea nueva en el tablero de alguien de su equipo
--       - abrir la pestaña Objetivos de esa persona (tiene que ver los que existen)
--       - elegir un mes que no sea el actual y mover una tarjeta
--       - abrir el Reporte y mirar el panel de utilización
--
--  3) Los adjuntos: pedile a alguien que abra una tarea con archivo adjunto y lo descargue.
--     Tiene que seguir funcionando. Si deja de andar, es que el path no tiene la forma
--     `<id-de-tarea>/<archivo>` en algún caso — revisar antes de dar por buena esta migración.

insert into public.schema_migrations (id, nombre)
  values (42, 'migracion-42-encargado-y-adjuntos.sql')
  on conflict (id) do nothing;
