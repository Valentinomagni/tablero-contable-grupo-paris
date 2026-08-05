# Auditoría del 05/08/2026 — lo que falta arreglar

Tres auditorías en paralelo: seguridad y RLS, corrección de datos contables, y encuadre y
textos. Cada hallazgo de esta lista lo verifiqué contra el código real antes de anotarlo; los
que no sobrevivieron a esa verificación no están acá.

**Ya arreglado y commiteado** (ver el commit "el aviso de la base mentía y quedaban tres podios
vivos"): el chip de migraciones ciego, las migraciones 38 y 39, y los cuatro podios de Resumen,
ociosidad, flujo-mensual y arqueo.

Esto es lo que queda, ordenado por daño real y no por dimensión.

---

## 1. Volver a correr el reinicio mensual DESTRUYE el archivo del mes

**Dónde:** `migracion-37-reinicio-mensual-manual.sql:150-171`, y el botón que lo dispara en
`src/features/board/AvisoReinicio.tsx:38`.

**Qué pasa.** La función hace `delete from cards_archive where mes = X` y después
`insert ... select from cards`. Pero el paso siguiente de esa misma función *muta* `cards`: pone
todo en pendiente y borra los `done_at`. Entonces la segunda corrida borra la foto buena y la
reemplaza por la foto ya reiniciada.

El archivo dice de sí mismo "idempotente: se puede correr las veces que sea". No lo es, porque
la fuente de la foto no es inmutable.

**El escenario que importa, y es probable.** El cron corre el 1/9 y archiva agosto bien. Pero
`reinicios_mensuales` arranca vacía a propósito, así que el cartel "el mes pasado no se
reinició" aparece igual. Vos ves el cartel y apretás "Reiniciar mes". Ahí se pierde agosto:
queda archivado con todas las tareas en pendiente, o sea 0% de cumplimiento para siempre, en el
historial, en el promedio, en la comparativa entre meses y en el bus factor.

**El arreglo.** Una guarda al principio de `reset_mes_manual` y de `reset_recurrentes_seguro`:
si ya hay fila en `reinicios_mensuales` para ese mes, devolver "ya se cerró el …" y no hacer
nada. Y cambiar el `delete` + `insert` por un `insert ... on conflict do nothing`, para que una
corrida tardía no pueda pisar la foto buena aunque se saltee la guarda.

---

## 2. El semáforo del Cierre da luz verde justo en el caso del incidente del 04/08

**Dónde:** `src/features/cierre/Cierre.tsx:62-67`.

**Qué pasa.** Dos defectos en seis líneas:

- Filtra por `c.recur_rule != null`, pero el reinicio de la base usa
  `(recurring = true OR recur_rule is not null)`. Una tarea creada desde el modal con "se repite
  cada mes" queda con `recurring: true` y **sin** `recur_rule`, así que el chequeo no la ve.
- Compara `done_at.slice(0, 7)`, que es el mes **UTC**. Una tarea cerrada el 31/07 a las 21:30
  hora argentina tiene `done_at` del 1 de agosto y se lee como de agosto.

**Por qué duele.** Es exactamente lo que pasó el 04/08: veinte recurrentes seguían en
"Terminado" de julio. La única pantalla diseñada para detectar eso mostraba el paso en verde,
con el texto "Las tareas recurrentes arrancaron el mes en cero".

**El arreglo.** Extraer el criterio a una función única en `src/lib/` con el mismo nombre que
usa la base, y usar `toARTDate(c.done_at)`. Que el predicado esté escrito dos veces es lo que
permitió que divergieran.

---

## 3. "Cumplimiento del mes" no filtra por mes y sube solo con el paso del tiempo

**Dónde:** `src/lib/analisis.ts:27-32` y `:49`, se muestra en `AnalisisMensual.tsx:77`.

**Qué pasa.** `analizarMes` recibe año y mes pero los usa **sólo** para calcular el mes
anterior. El cumplimiento es `terminadas / total` sobre **todas** las tareas vivas, sin ninguna
cota temporal. Y las tareas se acumulan para siempre: las "una sola vez" no se reinician nunca
(correcto), y las que genera la plantilla de cierre se crean nuevas cada mes.

**El escenario.** 2 de agosto, el reinicio corrió bien, las 10 recurrentes están en pendiente y
nadie hizo nada todavía. Pero hay 40 tareas puntuales de meses anteriores en "Terminado". El
medidor muestra **80% de cumplimiento del mes**. A los seis meses de uso no baja de 90% aunque
no se haga nada.

**El arreglo.** Acotar por mes antes de calcular, igual que hace `closingCards` en `cierre.ts`.
Si se prefiere no cambiar la semántica, el rótulo no puede decir "del mes".

---

## 4. El trabajo adelantado desaparece cuando llega el mes

**Dónde:** `src/lib/periodo-instancias.ts:87`.

**Qué pasa.** `cardsDelPeriodo` devuelve las tarjetas crudas cuando el período que mirás es el
vigente. Las filas de `card_periodos` de ese mes —que son justamente las que se escribieron
mientras el mes era futuro— quedan huérfanas y no se leen nunca más.

**El escenario.** El 20 de julio alguien adelanta agosto y marca 10 tareas como terminadas. El 1
de agosto, agosto pasa a ser el mes vigente, el cron reinicia las tarjetas, y el tablero lee las
tarjetas crudas: las 10 vuelven a aparecer pendientes. El trabajo adelantado no está en ninguna
pantalla ni en ninguna métrica.

Y adelantar trabajo era el motivo declarado de todo el diseño de períodos.

---

## 5. Una pestaña abierta cuando cambia el mes vacía el tablero y escribe en el mes viejo

**Dónde:** `src/App.tsx:87`.

**Qué pasa.** El período seleccionado se fija una sola vez, al montar. El vigente se recalcula
en cada render. No hay nada que los re-sincronice.

**El escenario.** Alguien deja la app abierta el 31/08 y vuelve el 01/09. Cualquier re-render
deja el vigente en septiembre y la selección en agosto. Como agosto escribía en las tarjetas y
no tiene filas de período, el tablero aparece **entero en pendiente, sin checklist y sin
historial**. La persona cree que perdió todo. Y si vuelve a marcar las tareas, esas ediciones se
escriben ahora en el período de agosto en vez de en las tarjetas: quedan dos verdades distintas
para el mismo mes.

**El arreglo.** Un efecto que reencuadre la selección cuando cambia el vigente.

---

## 6. Errores crudos de la base en la cara del usuario

**Dónde:** `src/features/admin/UserModal.tsx:86-88` y `:114`; `src/lib/deshacer.ts:11` y `:21`.

**Qué pasa.** Son los dos únicos lugares de la app que no pasan por `mensajeUsuario`. El
comentario de UserModal describe un filtro que **no existe en el código**.

**Lo que se ve.** Al poner dos usuarios con el mismo nombre:
`duplicate key value violates unique constraint "profiles_username_key"`. Al apretar Ctrl+Z
sobre un mes cerrado: `new row violates row-level security policy for table "cards"`.

**Ojo:** el test `deshacer.test.ts:31` hoy está bendiciendo la fuga, así que hay que cambiarlo
con el arreglo — es el mismo patrón de los dos tests que exigían el podio.

---

## 7. Sólo el tablero espera a que carguen las tareas; el resto muestra ceros

**Dónde:** `src/App.tsx:311`.

**Qué pasa.** La guarda de carga está en el anteúltimo lugar de la cadena. Todas las vistas que
se evalúan antes —Resumen, Reporte, Director, Cierre, Mi día— se renderizan con la lista vacía
mientras la consulta está en vuelo.

**Lo que se ve** con conexión lenta: Salud del equipo 0%, Avance 0%, Vencidas 0, "Nada trabado",
"Nada urgente para hoy". No es un vacío mudo: es un tablero que **afirma con seguridad que no
pasa nada**.

---

## 8. Dos definiciones distintas de "entregado a tiempo", y dos ventanas distintas de 30 días

**Dónde:** `puntualidad.ts:29`, `metrics.ts:46/70/87` y `cierre.ts:31` usan
`new Date(due_date + "T23:59:59")` —medianoche del navegador—, mientras `tu-semana.ts:88` usa el
día calendario argentino. Y `Reporte.tsx:40` cuenta 30 días por instante mientras
`puntualidad.ts` cuenta 31 días de calendario.

**Lo que se ve.** En el mismo bloque de indicadores: "Cerradas (30 días): 42" y "Puntualidad: 30
de 45 con vencimiento". Cuarenta y cinco con vencimiento sobre cuarenta y dos cerradas es
imposible de explicar, y el PDF lo deja escrito.

---

## 9. Cosas más chicas, todas verificadas

- **Modo Director** calcula el mes con `toISOString()` (`Director.tsx:66` y `:77`): entre las 21
  y las 24 hora argentina del último día del mes, previsibilidad y flujo salen vacíos y los
  horizontes "vence mañana" se corren un día.
- **`mesesAbiertos`** (`periodos.ts:45`) usa el mes UTC por defecto: a esa misma hora, un mes sin
  cerrar desaparece del aviso.
- **El cron de `materializar_mes_recurrentes`** está documentado como `5 0 1 * *`, que en UTC son
  las 21:05 del último día del mes anterior — materializa el mes que termina, no el que empieza.
  La migración 37 hace bien lo mismo con `5 3 1 * *`. Verificable con
  `select jobid, schedule, command from cron.job;`.
- **La clave temporal del blanqueo** se genera con `Math.random()` (`clave-temporal.ts:20`), que
  no es un generador criptográfico. El arreglo es una línea y no cambia el alfabeto ni el largo,
  así que la clave se sigue pudiendo dictar por teléfono.
- **La Edge Function de blanqueo no se niega a blanquear la cuenta de administración.** Con la
  migración 39 el jefe ya no puede darse `admin_sistema`, pero sí podría blanquearle la clave a
  la cuenta que lo tiene y entrar como ella. Falta traer `admin_sistema` en el select del destino
  y devolver 403.
- **El workflow `Dependencias`** interpola el input directo en un `run:`
  (`dependencias.yml:47`): es el patrón de inyección que GitHub documenta. Requiere ya tener
  permiso de escritura, por eso es bajo, pero convierte "puedo abrir un PR" en "ejecuto lo que
  quiera con el token del repo".
- **"Cargando historial…"** (`HistorialMes.tsx:22`) es la única pantalla que usa la palabra
  prohibida — y el aviso de novedades de la v2.9.0, que sigue visible, promete que ya no existe.
- **Siete pantallas nombran un número de migración** al usuario ("Se habilita tras la migración
  31"). En Administración es defendible; en una tarjeta abierta por un empleado, no. Peor: como
  la consulta de migraciones devuelve `undefined` mientras carga y el criterio es "ante la duda,
  false", ese texto aparece **aunque la migración esté aplicada**, en el primer render y ante
  cualquier corte de red.
- **La ficha de empleado** (`UserModal.tsx:191`) muestra ocho indicadores individuales sin una
  sola línea de encuadre, en el mismo modal donde se edita el rol y se elimina a la persona. Es
  el único panel por persona de toda la app sin su aclaración.
- **El Excel del análisis** sale sin el encuadre que sí lleva el PDF, y encima quien lo abre
  puede ordenar la columna "Cerradas %" con un clic.
- **"Mi día" dice "Mi día"** cuando estás mirando el día de otra persona, con el consejo en
  segunda persona incluido. La pestaña de al lado ya lo resuelve bien ("Su mes").
- **"Productividad (esfuerzo, 14 días)"** (`Resumen.tsx:262`) es el único lugar donde la palabra
  aparece como título afirmativo. El dato es por día, no por persona, así que no viola la regla
  — pero está a treinta píxeles del panel que sí la violaba.

---

## Lo que se revisó y salió limpio

Vale tanto como lo roto, porque dice dónde no hay que gastar tiempo.

- **Escalada de privilegios de un empleado común: cerrada.** El trigger cubre las ocho columnas
  sensibles que existen hoy.
- **Recursión en policies (42P17): no hay.** Ninguna policy de `profiles` subconsulta `profiles`.
- **Las 14 funciones `SECURITY DEFINER` fijan `search_path`.** Verificadas una por una.
- **Secretos: limpio.** No hay `service_role` ni ningún `.env` versionado. La clave pública de
  Supabase es pública por diseño.
- **La validación de la Edge Function de blanqueo es real**: lee el rol de la base, no confía en
  nada del cliente. Un empleado no puede blanquearle la clave a su jefe.
- **Cero emojis** en texto de usuario, verificado sobre todo el código con búsqueda de
  pictogramas.
- **El orden de ramas de `fallas.ts` es correcto**: sin conexión se evalúa antes que versión
  vieja.
- **Los estados vacíos están bien redactados** en las veinte pantallas que los tienen. El agujero
  es el de carga, no el de vacío.
- **Ninguna lib de cálculo puede devolver `NaN` ni `Infinity`.** Todas las divisiones están
  guardadas contra cero.
- **`guardarPeriodo` es efectivamente el único lugar** que escribe en `card_periodos`.
- **"Tu semana" es realmente privado**, como promete el changelog.

---

## Un hueco que hay que nombrar

**Las migraciones 1 a 12 no están en el repo.** No sé qué policies tienen `settings`,
`objectives` ni `daily_snapshots`, ni cuáles son las policies base de `cards` y `announcements`.
Y hay evidencia de que existe al menos una que no puedo leer: la app borra tarjetas y funciona,
pero en el repo no hay ninguna policy permisiva de borrado sobre `cards`.

Si alguna de esas policies heredadas fuera `using (true)`, anularía por OR buena parte de lo que
las migraciones 14 a 39 construyeron con cuidado. **Esta es la verificación de mayor valor que
podés correr hoy**, en Supabase → SQL Editor:

```sql
select tablename, policyname, cmd, permissive, qual, with_check
  from pg_policies where schemaname in ('public','storage') order by tablename, cmd;

select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
```

La segunda es la importante: dice si alguna tabla quedó **sin RLS**. En Supabase, una tabla sin
RLS es una filtración — cualquiera con la clave pública la lee entera.

Pegame el resultado y lo revisamos juntos.
