# Ideas para lo que viene — agosto 2026

Cinco propuestas, ordenadas por lo que yo haría primero. Cada una dice qué problema ataca, cómo
funcionaría, qué reusa, cuánto cuesta y **cómo puede salir mal**. Ninguna está empezada: esto es
para que apruebes o descartes.

Al final está lo que **no** propongo y por qué, que suele ser la parte más útil.

---

## El hueco que encontré al mirar el sistema entero

El Tablero tiene mucho análisis: puntualidad, retrabajo, bus factor, estabilidad, flujo mensual,
confianza del dato, recomendaciones. Pero **todo mira el estado actual**: este mes, los últimos
30 días, la foto de hoy.

Nada mira hacia atrás buscando **lo que se repite**.

Y eso es justo lo que pide Kaizen. Mejorar de forma continua no es tener un tablero prolijo: es
detectar que algo falla siempre por el mismo motivo y cambiar el proceso. Hoy el sistema guarda
meses de historia y no le saca ni una conclusión. Es el hueco más grande que le veo, y las dos
primeras propuestas apuntan ahí.

---

## 1 — Lo que se repite todos los meses

**El problema.** Cada mes pasan las mismas cosas: la misma tarea se cierra tarde, el mismo
trámite se traba esperando lo mismo, la misma semana se junta todo. Nadie lo nota porque cada mes
se vive como un caso aislado — "este mes fue complicado". Cuando lo mismo pasa cuatro meses
seguidos, dejó de ser un mes complicado y pasó a ser **un proceso mal armado**.

**Cómo funcionaría.** Un panel en el Reporte, "Lo que se repite", que cruza los últimos 4 a 6
meses y muestra únicamente los patrones que **se repitieron al menos 3 veces**:

- *"IVA se cerró después del vencimiento en 4 de los últimos 5 meses."*
- *"Conciliación bancaria estuvo trabada esperando otra tarea en 3 de los últimos 4 meses."*
- *"La segunda semana del mes concentra el 40% de los vencimientos."*

Cada línea con la opción de anotar **qué se va a cambiar** — y el mes siguiente el sistema
recuerda si el patrón siguió o se cortó. Ese ida y vuelta es el ciclo Kaizen entero: detectar,
cambiar, verificar.

**Por qué esto vale más que todo lo demás.** Es lo único de esta lista que le dice a tu jefe algo
que **no puede saber de ninguna otra forma**. Una planilla nunca le va a decir "el IVA llega
tarde todos los meses porque depende de que Ventas mande el listado el día 8". Un tablero
prolijo muestra el presente; esto muestra la causa.

**Qué reusa.** `cards_archive` (el histórico mensual), `card_periodos`, `analisis.ts`,
`retrabajo.ts`. Una tabla nueva chica sólo para las anotaciones de mejora.

**Esfuerzo.** Medio-alto. La detección de patrones es una lib pura y muy testeable; lo que lleva
tiempo es elegir **qué** patrones vale la pena buscar sin llenar la pantalla de ruido.

**Riesgo: MEDIO, y es de encuadre.** Un patrón se puede escribir de dos formas:

> "Las tareas de IVA se cierran tarde de forma sistemática." ← proceso
> "Juan cierra tarde el IVA todos los meses." ← persona

La primera abre una conversación sobre cómo está armado el trabajo. La segunda es una carpeta de
antecedentes con otro nombre, y se lleva puesto todo el encuadre del proyecto. **Regla dura: los
patrones se detectan por tarea, categoría o momento del mes — nunca por persona.** El guardián
de encuadre que ya existe ayuda, pero acá hay que tener cuidado con el diseño, no sólo con las
palabras.

Segundo riesgo, más chico: con pocos meses de historia, tres coincidencias pueden ser azar. Hay
que exigir una muestra mínima y decir sobre cuántos meses se está mirando, igual que hace el ICR.

---

## 2 — El instructivo de cada tarea

**El problema.** El cómo se hace cada cosa vive en la cabeza de quien la hace. Cuando esa persona
se toma licencia, se enferma o se va, el trabajo se hace peor o no se hace. El Reporte ya
**detecta** esto —el bus factor marca las categorías que hace una sola persona— pero detectarlo
no lo arregla: te avisa del problema y te deja igual de solo.

**Cómo funcionaría.** Un instructivo por **tipo de tarea** (la categoría), no por tarea suelta:
los pasos, dónde están los archivos, a quién pedirle qué, los errores típicos. Se escribe una
vez y aparece solo en cada tarea de esa categoría, incluidas las que se generan el mes que viene.

Cuando alguien cubre a otra persona por vacaciones, el instructivo viaja con la tarea. Hoy la
función de cobertura pasa la tarea pero no el conocimiento.

**Qué reusa.** Las categorías ya existen y ya se usan para filtrar y agrupar. La cobertura por
vacaciones ya existe. `settings` ya guarda estructuras parecidas (plantillas, plantilla de
cierre). El bus factor ya te dice **por cuál empezar**.

**Esfuerzo.** Bajo-medio. Es un editor de texto por categoría y mostrarlo en la tarea. Sin
migración si va en `settings`; con una tabla chica si querés historial de cambios.

**Riesgo: BAJO.** El único modo de falla real es que se escriba una vez y quede viejo, y entonces
el instructivo mienta — que es peor que no tenerlo. Se mitiga mostrando cuándo se actualizó por
última vez y quién, sin alarmas ni recordatorios molestos.

Es la propuesta más alineada con **Seiketsu** de todo lo que se hizo hasta ahora: estandarizar
para que las cosas no se ensucien de nuevo.

---

## 3 — La retrospectiva del cierre

**El problema.** El mes se cierra y no queda nada escrito sobre **cómo estuvo**. El mes
siguiente empieza de cero y se repiten los mismos tropiezos. Es el bucle de Kaizen abierto: se
hace, se mide, y no se aprende.

**Cómo funcionaría.** Al cerrar el mes, tres preguntas —cortas, opcionales, saltables:

1. ¿Qué salió mejor que el mes pasado?
2. ¿Qué nos trabó?
3. ¿Qué vamos a probar distinto el mes que viene?

Se guarda con el cierre. Al mes siguiente, al abrir el cierre, aparece **lo que se había
propuesto** y una sola pregunta: ¿pasó? Nada más.

**Qué reusa.** El cierre mensual ya existe y ya tiene su pantalla. El histórico ya guarda por mes.

**Esfuerzo.** Bajo. Tres campos de texto y traerlos del mes anterior.

**Riesgo: MEDIO, y va en pareja con la #1.** Dos formas de arruinarla:

- **Que sea obligatoria.** El día del cierre nadie tiene ganas de escribir. Si bloquea el cierre,
  se completa con cualquier cosa y el registro pasa a ser basura. **Tiene que poder saltarse
  siempre.**
- **Que la lea el jefe como evaluación.** Si "qué nos trabó" se convierte en insumo para juzgar,
  nadie va a escribir nunca nada incómodo — y lo incómodo es exactamente lo único que sirve.
  Habría que decidir de entrada si es del equipo o de cada persona. **Mi recomendación: del
  equipo, en primera persona del plural, y sin nombres.**

---

## 4 — Plan de cobertura

**El problema.** El bus factor dice "esta categoría la hace una sola persona" y ahí termina. No
hay dónde anotar quién es el reemplazo ni si esa persona alguna vez la hizo. Cuando llega la
licencia, se improvisa.

**Cómo funcionaría.** Por cada categoría crítica, un segundo responsable anotado. El Director
muestra una señal simple: cuántas categorías críticas tienen reemplazo asignado y cuántas no. Y
si el reemplazo nunca hizo una tarea de esa categoría, lo dice — tener un nombre anotado no es lo
mismo que tener a alguien que sepa.

Se enlaza con la #2: el reemplazo asignado más el instructivo escrito es cobertura de verdad; el
nombre solo es un papel.

**Qué reusa.** `busfactor.ts` ya calcula las categorías críticas. Las vacaciones ya existen. El
Director ya tiene un panel de continuidad.

**Esfuerzo.** Bajo. Un campo por categoría y una señal en el Director.

**Riesgo: BAJO.** Habla de cobertura de procesos, no de rendimiento. El único cuidado: que la
señal no se lea como "esta persona es un riesgo". Se redacta sobre la categoría — *"Conciliación
bancaria no tiene reemplazo asignado"*—, nunca sobre quien la hace.

---

## 5 — Qué cambió desde que no entrás

**El problema.** Volvés de dos días de licencia y no sabés qué pasó. Hay que revisar tarea por
tarea. Las notificaciones muestran eventos sueltos, no un panorama.

**Cómo funcionaría.** Una línea al entrar, sólo si estuviste más de un día sin entrar: qué se
cerró de lo tuyo, qué te delegaron, qué venció mientras no estabas. Se lee en diez segundos y
desaparece.

**Qué reusa.** `last_seen` ya existe (presencia). El historial de cada tarea ya guarda quién y
cuándo.

**Esfuerzo.** Bajo.

**Riesgo: BAJO, con la misma condición que "Retomar donde quedaste".** Es una ayuda, no un
resumen de lo que te perdiste. Si empieza a decir "tenés 7 vencidas desde que no entrás", se
convierte en un reproche apenas abrís la app, que es el peor momento posible para una mala
noticia. Sin números de lo negativo.

---

## Lo que NO propongo, y por qué

Esto vale tanto como la lista de arriba: hay ideas que suenan bien y empeoran el sistema.

- **Notificaciones por mail o WhatsApp.** Suena a "más presencia" y es en realidad más ruido. El
  equipo ya tiene la app y el tablón; agregar un canal que interrumpe fuera del trabajo cambia la
  relación con la herramienta, y no para mejor.
- **Metas o cuotas por persona.** Es un ranking con otro nombre. Ya se descartó el ranking por
  buenas razones y esto vuelve por la ventana.
- **Medir tiempo real por tarea (cronómetro).** Ya está analizado y desaconsejado en
  `docs/PROPUESTA-ICR.md`. La conclusión no cambió.
- **Inteligencia artificial que sugiera prioridades.** El motor de recomendaciones actual es un
  conjunto de reglas explicables: cuando dice algo, se puede ver por qué. Una sugerencia que nadie
  puede explicar, en un tablero contable, se ignora la segunda vez que se equivoca — y con razón.
- **Una app móvil nativa.** Ya es PWA y se instala. Una app nativa es otro proyecto entero para
  resolver algo que ya está resuelto.

---

## Si tuviera que elegir una sola

**La 1, "Lo que se repite".**

Las otras cuatro mejoran la experiencia de quien usa el Tablero. Ésa cambia lo que el Tablero
**es**: de un lugar donde se anotan tareas a un lugar que dice por qué el trabajo sale como sale.

Es también la que mejor responde a lo que buscás. Un tablero prolijo se elogia y se olvida. Un
sistema que te dice "esto viene fallando hace cuatro meses y es por acá" es un sistema del que
cuesta prescindir — y esa diferencia es la que se nota cuando alguien evalúa cuánto vale el
trabajo que hay atrás.

**La 2 es la que menos cuesta por lo que devuelve**, y arregla algo que hoy el sistema sólo sabe
señalar.

Decime cuáles te cierran y te armo el plan con el detalle de siempre.
