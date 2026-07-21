# Propuestas para generar el hábito de uso diario

**Spec 28 — Fase A, Task 9. Documento de análisis. Nada de esto está implementado.**

## El problema real

El sistema pasa de 4-5 usuarios a ~30 personas del área contable. El riesgo no es que
la gente no entre: es que **entre y no actualice**. Una tarea que se terminó el martes y
sigue figurando "en proceso" el viernes no es un dato faltante, es un dato falso. Con 30
personas, un puñado de tareas zombis por semana alcanza para que el porcentaje de
cumplimiento, la puntualidad y el semáforo del cierre dejen de significar algo. Si el jefe
toma una decisión con esos números y la realidad lo desmiente una vez, el tablero se
convierte en "esa planilla que nadie mira".

Contra eso hay dos caminos: control o hábito. El control (recordatorios agresivos,
rankings, tableros de quién actualiza menos) funciona rápido y se pudre rápido: la gente
actualiza para que el sistema se calle, no para que el dato sea cierto — y ahí el dato es
igual de falso, con el agregado de que ahora además hay bronca. Este documento apunta al
otro camino: bajar la fricción de decir la verdad y hacer que actualizar tenga una
devolución para quien actualiza.

---

## 1. Qué señales ya existen (relevamiento)

Antes de proponer, lo que ya está construido:

| Archivo | Qué hace hoy |
|---|---|
| `src/lib/alertas.ts` | Señales de riesgo **para el gestor** en el Resumen: persona con 3+ vencidas, tareas sin responsable, prioridad alta sin movimiento 5+ días. Umbrales conservadores, máximo 8 alertas. Nadie se las muestra al empleado. |
| `src/lib/midia.ts` | "Mi día": arma la agenda personal del día con las cards no terminadas del owner clasificadas en vencida / vence-hoy / alta prioridad. Es una **lista de lectura**, no pide ninguna acción salvo abrir la card. |
| `src/lib/ociosidad.ts` | Utilización agregada: por día hábil, si hubo *alguna* señal de actividad (cierre de card, activity log, snapshot). Explícitamente no mide presencia ni productividad; existe para planificar reparto de carga. |
| `src/lib/notificaciones.ts` | Reglas puras de qué notificar y a quién, con filtro anti-ruido: delegación/asignación/dependencia liberada van siempre; finalizaciones y vencidas solo a encargado/jefe y solo con impacto (alta prioridad o con vencimiento). |
| `src/lib/tiempos.ts` | Tiempo máximo de ejecución (SLA) desde `proc_at` hasta `done_at` o ahora; marca excedido y deja constancia en el historial al terminar. Es **retrospectivo**: avisa cuando ya se pasó, no antes. |
| `src/features/hoy/MiDia.tsx` | La pantalla de Mi día. Único lugar con acción en un toque: el arqueo del día ("Sin diferencias" / "Con diferencias") resuelto sin entrar al kanban. El resto de los ítems solo abren la card. |

**Conclusión del relevamiento.** Ya existe buena capacidad de *detección* (alertas,
tiempos, ociosidad) y un canal de *aviso* con filtro anti-ruido (notificaciones). Lo que
falta es casi todo del lado del empleado: las señales que el sistema calcula van casi
todas hacia arriba (al jefe), y la única acción de un toque que existe es el arqueo. Las
propuestas de abajo son en su mayoría "usar la detección que ya tenemos, pero devolvérsela
a quien puede corregir el dato, con el botón para corregirlo al lado".

---

## 2. Propuestas

### P1 — Confirmación de tarea estancada ("¿seguimos con esto?")

- **Problema que ataca:** la tarea terminada que nadie marcó terminada. Es el modo de falla
  número uno: el trabajo se hizo, el estado quedó viejo, la métrica miente.
- **Cómo funcionaría:** una tarea en "En proceso" sin ningún movimiento hace más de 2 días
  hábiles aparece arriba de Mi día con la pregunta "¿Seguimos con esta tarea o ya la
  terminaste?" y tres botones: *Ya la terminé* (la cierra ahí mismo, con `done_at` de hoy),
  *Sigo con esto* (registra el toque y no vuelve a preguntar por 2 días) y *Está frenada*
  (la marca bloqueada y pide una línea de motivo). Máximo una pregunta por sesión, siempre
  la más vieja; nunca modal, nunca bloquea la pantalla.
- **Esfuerzo:** bajo-medio. La detección es la misma lógica de `ultimoMovimientoMs` de
  `alertas.ts` con otro umbral; el cierre reusa la mutación de finalizar; el snooze necesita
  guardar un timestamp por card.
- **Datos que reusa:** `history` / `created_at` (último movimiento), `proc_at`, `status`,
  la vista de Mi día.
- **Riesgo de resultar invasiva o molesta: MEDIO.** La pregunta en sí es útil y honesta,
  pero es el mecanismo con más chance de degradar a "molestia" si se calibra mal. Dos
  formas de arruinarla: preguntar todos los días por la misma tarea (se vuelve ruido y la
  gente aprende a apretar "sigo" sin leer, que es exactamente el dato podrido que
  queríamos evitar), o preguntar por tareas que legítimamente duran semanas — en contable
  hay conciliaciones y cierres largos, y que el sistema insinúe cada 48 h que algo está
  atrasado se lee como desconfianza. Mitigaciones obligatorias: contar días hábiles (no
  corridos), respetar vacaciones, snooze real de 2 días, tope de una pregunta por sesión,
  y no preguntar nunca por tareas cuyo `tiempo_max_horas` o vencimiento indica que son
  largas por diseño. El botón *Está frenada* es clave: le da al empleado una respuesta
  honesta que no es "estoy atrasado".

### P2 — Cierre de jornada (ritual de fin del día)

- **Problema que ataca:** la actualización se pospone al final del día y ahí ya nadie entra
  al sistema. No hay ningún momento definido donde el estado se sincroniza con la realidad.
- **Cómo funcionaría:** a partir de determinada hora, Mi día muestra un bloque "Cerrá tu
  día": las tareas que estuviste tocando hoy, cada una con un toggle *terminada / sigue*, y
  el arqueo si corresponde. Se resuelve en 15 segundos sin abrir ninguna card y termina con
  una confirmación seca ("Día cerrado"). Es opcional: si no lo hacés no pasa nada y nadie
  se entera.
- **Esfuerzo:** medio. Requiere UI nueva y una consulta de "cards tocadas hoy", pero toda
  la data está.
- **Datos que reusa:** `activity_log`, `history` del día, `task_occurrences` del arqueo, la
  lógica de `MiDia`.
- **Riesgo: BAJO.** Es la propuesta con mejor relación valor/molestia: aparece una sola vez,
  al final, en un momento en que la persona ya está cerrando; no pregunta nada que la
  persona no sepa de memoria; y no deja rastro si se ignora. El único riesgo es que se
  perciba como "parte de fichar la salida" — se evita no registrando en ningún lado quién
  cerró el día y quién no, y sobre todo no mostrándoselo al jefe. En el momento en que
  exista un reporte de "quiénes cerraron su día", esta propuesta pasa de baja a alta.

### P3 — Retomar donde quedaste (ritual de inicio)

- **Problema que ataca:** el arranque frío. La persona entra, ve una lista larga, no sabe
  por dónde empezar y termina trabajando desde su cuaderno en vez de desde el sistema.
- **Cómo funcionaría:** al abrir la app, arriba de Mi día, una línea sola: "Ayer estabas con
  *Conciliación Banco Nación*" y un botón para abrirla. Sin números, sin resumen, sin
  saludo. Si no hay nada claro que retomar, no se muestra nada.
- **Esfuerzo:** bajo. Es una consulta a la última entrada de historial propia.
- **Datos que reusa:** `history` / `activity_log` por owner.
- **Riesgo: BAJO.** Es puramente servicial y desaparece sola cuando no aplica. El riesgo
  aparece si se le agrega contenido: si esa línea empieza a decir "hace 3 días que no
  entrás" o "tenés 7 vencidas", pasa a ser un reproche apenas la persona abre la app, que
  es el peor momento posible para dar una mala noticia.

### P4 — Tu semana (resumen personal de logros)

- **Problema que ataca:** el trabajo contable es invisible: se terminan 20 cosas y a fin de
  semana no queda registro de nada. Sin devolución, actualizar el sistema es puro costo.
- **Cómo funcionaría:** los viernes a la tarde, una tarjeta personal en Mi día: qué
  terminaste esta semana (lista concreta de títulos, no un número), cuántas cerraste en
  fecha, y si hubo alguna racha (semanas seguidas sin vencidas). Solo lo positivo, sin
  comparación con nadie, visible únicamente para uno mismo. Si la semana fue floja,
  la tarjeta muestra lo que hubo sin comentarios ni caritas.
- **Esfuerzo:** bajo-medio. Ya existe la función de resumen semanal (migración 28) y los
  `daily_snapshots`; hay que darle una versión personal y una UI.
- **Datos que reusa:** `cards` con `done_at`, `daily_snapshots`, `cards_archive`.
- **Riesgo: BAJO, con una condición.** Un resumen personal privado y solo-positivo no
  molesta a nadie. Se vuelve MEDIO-ALTO en el instante en que incluya lo negativo
  ("terminaste 4, te quedaron 9 vencidas") o en que exista una versión que el jefe pueda
  ver por persona: ahí deja de ser un espejo y pasa a ser una evaluación semanal
  automática, y la reacción previsible es cerrar tareas de mentira los viernes a la tarde.
  Regla dura: si la semana estuvo mal, la tarjeta se calla, no reta.

### P5 — Valores por defecto inteligentes al actualizar

- **Problema que ataca:** actualizar cuesta demasiados toques. Marcar terminada una tarea
  hoy implica abrir la card, cambiar el estado, y si el sistema pide datos (resultado,
  observación, fecha) la persona posterga.
- **Cómo funcionaría:** todo campo que el sistema puede inferir viene precargado y editable:
  `done_at` = ahora, resultado = "sin diferencias", responsable = uno mismo, fecha de
  vencimiento sugerida según la categoría. Además, acción de un toque desde la lista
  (marcar terminada sin abrir la card, con deshacer de unos segundos en el toast), que es
  lo que hoy existe solo para el arqueo.
- **Esfuerzo:** medio. Toca varios formularios y requiere mutación optimista con rollback.
- **Datos que reusa:** categorías, `tiempos.ts` para sugerir plazos, patrones existentes de
  `ArqueoHoyCard`.
- **Riesgo: BAJO en lo molesto, MEDIO en calidad de dato.** Nadie se queja de que el sistema
  le ahorre toques. El riesgo es otro: un default demasiado cómodo se acepta sin mirar, y
  "sin diferencias" precargado puede terminar registrando arqueos que nadie revisó. Regla:
  precargar lo que es verdad casi siempre y **no** precargar nada que implique una
  afirmación de control (un resultado de arqueo debería seguir siendo una elección
  explícita, aunque el resto del formulario venga hecho).

### P6 — Recordatorio contextual, no genérico

- **Problema que ataca:** los recordatorios genéricos ("tenés tareas pendientes") se
  ignoran a la semana y encima entrenan a la gente a ignorar toda notificación del sistema,
  incluidas las que importan.
- **Cómo funcionaría:** el recordatorio nace de un hecho concreto y trae la acción al lado:
  "El arqueo de hoy de Sucursal Centro no está cargado" con los dos botones; "Vence hoy
  *F931 Mayo* y sigue en proceso" con el botón de cerrarla. Nunca se dispara por tiempo
  transcurrido, siempre por una condición verificable. Techo duro: como máximo dos por
  persona por día, y cero si no hay hechos que reportar.
- **Esfuerzo:** medio. Reusa el motor de `notificaciones.ts` extendiendo `Evento` y
  agregando el filtro de tope diario.
- **Datos que reusa:** `notificaciones.ts` completo, `midia.ts`, `task_occurrences`,
  `due_date`.
- **Riesgo: MEDIO.** Es el mecanismo que más rápido se puede volver insoportable, porque
  las notificaciones se acumulan y el costo marginal de agregar una regla nueva parece
  cero. Con 30 personas y varios módulos activos, sin tope explícito esto llega a 8-10
  avisos diarios en tres meses y la campana muere. El tope diario no es una mejora
  deseable: es parte del diseño. Segunda condición: cada notificación debe traer el botón
  que la resuelve, porque una notificación que solo informa es puro costo para el receptor.

### P7 — Costo colectivo visible (el dato que otro está esperando)

- **Problema que ataca:** actualizar se siente como burocracia para el jefe. Casi nunca se
  ve que del otro lado hay un compañero esperando.
- **Cómo funcionaría:** cuando una tarea sin actualizar bloquea a otra persona (dependencia,
  delegación pendiente, un cierre que no puede avanzar), la card lo dice en una línea:
  "Marcela no puede seguir con el cierre hasta que esta se cierre". Es información sobre el
  trabajo, no sobre la persona, y aparece solo cuando la dependencia existe de verdad.
- **Esfuerzo:** medio. Depende de que las dependencias estén bien cargadas; hoy existe el
  evento `dep_liberada` en notificaciones, o sea que el grafo ya está.
- **Datos que reusa:** dependencias entre cards, delegaciones, cierre mensual.
- **Riesgo: MEDIO-ALTO, y depende enteramente de la redacción.** Nombrar a un compañero
  real convierte un aviso del sistema en presión social, y la presión social entre pares es
  mucho más incómoda que la de un jefe: la gente se cruza en el pasillo. Bien hecho ("el
  cierre de junio espera esta tarea") informa; mal hecho ("Marcela está trabada por vos")
  genera roce y termina en gente evitando cargar dependencias para no quedar expuesta. Si
  se implementa, debe hablar del trabajo bloqueado, no de la persona que espera, y no debe
  existir ninguna vista agregada de "quién trabó a cuántos".

### P8 — Reconocimiento entre pares

- **Problema que ataca:** el sistema solo registra lo que falta. Nada de lo que pasa adentro
  es agradable, y eso hace que la gente entre lo mínimo indispensable.
- **Cómo funcionaría:** en una tarea terminada, cualquiera puede dejar un "gracias" o un
  reconocimiento corto, que le llega a la persona como notificación y le queda en su
  resumen semanal. Sin puntajes, sin ranking, sin contador público, sin límite ni cuota.
- **Esfuerzo:** medio. Tabla nueva chica más UI, aunque el canal de notificación existe.
- **Datos que reusa:** `notifications`, cards terminadas, resumen semanal de P4.
- **Riesgo: MEDIO.** No molesta a quien lo recibe, pero puede fallar de dos maneras. Una:
  nadie lo usa y queda una función muerta que hace ver al sistema como algo que se
  intentó y no prendió. Dos, peor: si se le agrega cualquier métrica ("María recibió 12
  reconocimientos"), se vuelve un concurso de popularidad que castiga a los perfiles
  callados y a quien trabaja en tareas que nadie ve. En un equipo de 30 con jerarquías
  reales, un contador público de reconocimientos es una mala idea aunque técnicamente sea
  trivial. Recomendación: si se hace, sin números y sin agregados, nunca.

### P9 — Aviso preventivo de tiempo máximo

- **Problema que ataca:** `tiempos.ts` avisa que se excedió el SLA cuando ya se excedió.
  Para el empleado eso no es información accionable, es un reproche.
- **Cómo funcionaría:** cuando una tarea en proceso llega al 80% de su `tiempo_max_horas`,
  aparece en Mi día como "te queda poco tiempo" con dos salidas: cerrarla si ya está, o
  pedir más tiempo dejando el motivo (que queda en el historial y le llega al encargado).
  El pedido de prórroga es la parte importante: convierte un incumplimiento silencioso en
  una conversación.
- **Esfuerzo:** bajo. `estadoTiempo` ya devuelve `restanteHoras`; falta el umbral, la UI y
  la acción de prórroga.
- **Datos que reusa:** `tiempos.ts` entero, `history`, notificaciones al encargado.
- **Riesgo: MEDIO.** Un contador de tiempo corriendo sobre el trabajo propio se siente
  como vigilancia, sobre todo si el SLA lo definió otro y no refleja la realidad de la
  tarea. La única razón por la que esto es viable es que el SLA **ya existe y ya se
  registra**: el aviso preventivo no agrega control, le da a la persona la chance de
  reaccionar antes de que quede el incumplimiento escrito. Si se implementa sin la vía de
  prórroga, el riesgo sube a alto: sería solo un reloj que juzga.

### P10 — Sincronizar antes de la reunión (ritual de equipo)

- **Problema que ataca:** el momento donde el dato podrido hace más daño es la reunión de
  equipo, y es justo donde se descubre. Además, cada área tiene su ritmo, no todos los días
  son iguales.
- **Cómo funcionaría:** el encargado marca cuándo es su reunión semanal (por ejemplo lunes
  10 h). Un rato antes, cada integrante de ese equipo ve en Mi día un bloque compacto con
  sus tareas abiertas y toggles para dejarlas al día en dos minutos. Sirve al empleado
  (llega a la reunión sin quedar mal parado) y al encargado (llega con datos frescos).
- **Esfuerzo:** medio. Configuración por equipo más la UI del cierre de jornada reusada.
- **Datos que reusa:** P2 casi entero, jerarquía de equipos, cards abiertas por owner.
- **Riesgo: BAJO-MEDIO.** El incentivo está alineado: nadie quiere llegar a la reunión con
  el tablero desactualizado, así que la ayuda se recibe bien. El riesgo es que el
  encargado lo use como control de asistencia ("veo quién sincronizó antes de la reunión")
  y de paso lo convierta en obligatorio; ahí se transforma en un trámite semanal y la
  gente lo despacha apretando botones sin mirar. Debe ser sugerencia para el empleado y
  nunca reporte para el encargado.

---

## 3. Recomendaciones

### (a) Las tres para empezar

1. **P1 — Confirmación de tarea estancada.** Ataca directamente el modo de falla que hace
   mentir a las métricas, y es el caso que planteó el usuario. Convierte la detección que
   ya existe en `alertas.ts` (hoy solo visible para el jefe) en una acción de un toque para
   quien puede arreglar el dato. Es la única propuesta que corrige datos viejos de forma
   retroactiva; todas las demás previenen hacia adelante.
2. **P2 — Cierre de jornada.** Es la que mejor construye hábito por costo: aparece una vez
   por día, en el momento natural, se resuelve en 15 segundos y su riesgo de molestar es el
   más bajo de la lista. Si prende, baja el volumen de trabajo de P1 solo (menos tareas
   llegan a estar 2 días sin tocar).
3. **P5 — Valores por defecto inteligentes.** No es vistosa pero es la que más mueve la
   aguja en el largo plazo: mientras actualizar cueste cuatro toques y un formulario, todo
   recordatorio pelea contra la fricción. Bajar el costo de decir la verdad es más efectivo
   que insistir en que la digan. Además, es el sustrato de P1 y P2 (ambas dependen de que
   cerrar una tarea sea un toque).

Estas tres se refuerzan entre sí: P5 hace barato actualizar, P2 crea el momento, P1
rescata lo que igual se escapó. Y ninguna necesita datos nuevos ni tablas nuevas.

### (b) Advertencia honesta: qué puede generar rechazo

Con 30 personas, el modo de falla más probable de todo este proyecto no es técnico: es que
el equipo lo perciba como una herramienta de control y lo empiece a trabajar "para la
foto". Cuando eso pasa, el sistema sigue funcionando, se llena de datos, y todos los datos
son mentira — que es exactamente el problema que este spec quiere evitar, agravado.
Lo digo sin vueltas, propuesta por propuesta:

- **P7 (costo colectivo)** es la más peligrosa de la lista. Es técnicamente fácil y suena
  bien en una reunión, pero nombrar compañeros que están esperando introduce presión social
  entre pares en un equipo que se ve las caras todos los días. La reacción natural no es
  actualizar más rápido, es dejar de cargar dependencias para no quedar señalado — y eso
  degrada un dato que hoy es bueno. **Recomiendo posponerla** y, si algún día se hace,
  hablar solo del trabajo bloqueado, jamás de la persona que espera.
- **P9 (tiempo máximo)** es un reloj corriendo sobre el trabajo de cada uno. Se sostiene
  únicamente porque el SLA ya existe y ya se registra, y solo si viene con la vía de pedir
  prórroga. Sin esa salida, no la haría.
- **P8 (reconocimiento)** es inofensiva mientras no tenga números. Con un contador público
  se vuelve un concurso de popularidad que perjudica a los perfiles callados y a quien hace
  el trabajo invisible. Si se implementa con ranking, mejor no implementarla.
- **P4 (resumen semanal)** y **P2 (cierre de jornada)** son de bajo riesgo *hoy*, y ambas
  se dan vuelta con un solo cambio de producto: el día que exista una vista de jefe con
  "quién cerró su día" o "el resumen semanal de cada uno", dejan de ser espejos personales
  y pasan a ser evaluación automática. Ese cambio va a parecer barato e inocente cuando lo
  pidan. No lo es.
- **P1 (tarea estancada)**, la recomendada número uno, tiene su propia trampa: mal
  calibrada, pregunta todos los días y la gente aprende a apretar "sigo con esto" sin leer.
  En ese escenario el sistema se siente al día y el dato es igual de falso que antes, con
  la molestia agregada. La calibración (días hábiles, snooze real, una por sesión, respetar
  vacaciones y tareas largas por diseño) no es refinamiento: es la diferencia entre que
  funcione y que sea contraproducente.
- Transversal: **ninguna de estas señales debería alimentar una evaluación de desempeño**,
  y conviene decirlo en voz alta al equipo cuando se lance. `ociosidad.ts` ya tiene esa
  disciplina escrita en su encabezado ("NO mide presencia ni productividad"). Esa línea es
  el estándar del proyecto y estas propuestas deberían poder pasarla todas.

### (c) Principio rector

**Si la función no le sirve a la persona que tiene que apretar el botón, no genera hábito:
genera resentimiento y datos falsos.**
