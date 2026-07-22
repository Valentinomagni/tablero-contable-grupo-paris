# Propuesta — Índice de Calidad del Registro (ICR)

> **Estado:** propuesta. No hay código escrito. Este documento es el **gate** del item 10 de la
> Fase D (cronómetro con pausas): si no se aprueba, el cronómetro no se implementa.
>
> **Restricción que gobierna todo el documento (palabras del usuario):**
> *"El objetivo no es controlar personas, sino obtener información útil y representativa para
> mejorar los procesos de trabajo."*
> Cada mecanismo de acá se evalúa contra esa frase, y los que la crucen se desaconsejan aunque
> sean fáciles de hacer.

---

## 1. El problema, dicho corto

Todas las métricas de tiempo del tablero (SLA, duración promedio, puntualidad, analítica de
operativas) se calculan sobre marcas que pone una persona a mano: `proc_at` cuando arrastra la
tarea a "En proceso", `done_at` cuando la cierra. Si alguien marca "En proceso" y "Terminado" en
el mismo minuto, al terminar un trabajo de tres días, el sistema registra una tarea de un minuto.
No es fraude: es lo que pasa naturalmente cuando actualizar cuesta más que trabajar.

La consecuencia no es que "haya gente que hace trampa". Es que **hoy no sabemos qué métricas
mirar y cuáles descartar**, porque el promedio mezcla registros fieles con registros de relleno.
El ICR existe para separar esas dos poblaciones: no para retar a nadie, sino para saber sobre qué
datos se puede decidir.

---

## 2. Qué ya existe (relevamiento — no proponer lo hecho)

| Archivo | Qué hace hoy |
|---|---|
| `src/lib/tiempos.ts` | SLA por tarea: horas entre `proc_at` y `done_at`/ahora, contra un tiempo máximo por tarea o categoría; marca excedido y registra el incumplimiento en el historial. |
| `src/lib/retrabajo.ts` | Índice de retrabajo: cuenta reaperturas (`TXT_REAPERTURA`) por persona y las tareas más reabiertas; unifica el texto de transición para que las tres vías de UI sean detectables. |
| `src/lib/puntualidad.ts` | % de tareas cerradas en fecha sobre las cerradas en los últimos 30 días que tenían vencimiento, con marca de muestra chica. |
| `src/lib/cierre-dia.ts` | Semáforo personal de fin de jornada (arqueo, vencen hoy, operativas); explícitamente una ayuda para el propio empleado, no una auditoría. |
| `src/lib/alertas.ts` | Señales de riesgo para el gestor: ≥3 vencidas por persona, prioridad alta quieta ≥5 días; usa la última entrada de `history` como señal de movimiento. |
| `src/lib/analitica-operativas.ts` | Analítica de operativas por empleado/tipo/cruce; ya documenta que la duración sólo se puede estimar con `proc_at`+`done_at` y devuelve `null` en vez de inventar un promedio. |
| `src/lib/ociosidad.ts` | Utilización agregada por día hábil, con la disciplina escrita en el encabezado: "NO mide presencia ni productividad individual". |
| `docs/PROPUESTAS-ADOPCION.md` | Ya advierte que el modo de falla más probable del proyecto es que se perciba como control y el equipo trabaje "para la foto"; principio rector: si la función no le sirve a quien aprieta el botón, genera resentimiento y datos falsos. |

Infraestructura relevante ya disponible: `history` con `{who, at, txt}` por card, `proc_at`,
`done_at`, `created_at`, `due_date`, `ActivityLog` (cantidad + instante), `last_seen` en
`profiles`, `vacaciones` y la tabla `card_pausas` **creada vacía** en la migración 31 a la espera
de esta decisión.

**Nada de lo anterior mide fidelidad del registro.** Todo mide resultado (tiempo, puntualidad,
retrabajo) asumiendo que las marcas son verdaderas. Ese es el hueco que llena el ICR.

---

## 3. El ICR, concreto

### 3.1 Qué es y qué no es

- **Es** un indicador de **cobertura y coherencia del dato**: qué porción del trabajo quedó
  registrada de forma que se pueda analizar.
- **No es** una nota de desempeño. Un ICR bajo no dice "esta persona trabaja mal", dice "sobre
  estas tareas el sistema no puede decir nada confiable".
- Se calcula **sobre tareas cerradas en una ventana de 30 días**, y siempre acompañado del
  tamaño de la muestra. Con menos de 8 tareas cerradas en la ventana, no se muestra número: se
  muestra "muestra insuficiente". Esto evita que un encargado con 3 tareas largas aparezca con
  un 40 %.

### 3.2 Fórmula propuesta

ICR = suma ponderada de cinco factores, cada uno normalizado a 0..1, redondeado a 0..100.

| # | Factor | Peso | Qué mide | Por qué ese peso |
|---|---|---|---|---|
| F1 | **Trazabilidad de estados** | 30 | % de tareas cerradas que tienen `proc_at` no nulo y anterior a `done_at` (es decir, pasaron efectivamente por "En proceso"). | Es el factor fundacional: sin `proc_at` verdadero, ninguna métrica de tiempo existe. Es también el más fácil de corregir por el usuario. |
| F2 | **Registro no colapsado** | 25 | 1 − (% de tareas cerradas donde `done_at − proc_at` < 10 minutos **y** la tarea vivió más de 1 día hábil desde `created_at`). | Detecta el caso exacto que planteó el usuario: marcar "En proceso" recién al terminar. La segunda condición es la que evita castigar tareas que legítimamente duran 5 minutos. |
| F3 | **Actualización oportuna** | 20 | % de tareas cerradas cuyo `done_at` cae dentro de 1 día hábil de la última señal real de trabajo (última entrada de `history`, comentario, checklist tildado o `ActivityLog`). | Mide cierres tardíos: la tarea se terminó el martes y se marcó el viernes. Distorsiona todas las series temporales. |
| F4 | **Ausencia de tareas huérfanas** | 15 | 1 − (% de tareas **abiertas** de la persona con más de 10 días hábiles sin ninguna entrada de historial, excluyendo vacaciones y pausas declaradas). | Tareas abiertas eternamente son ruido puro: inflan el WIP y ensucian los promedios de tiempo. Peso bajo porque hay motivos legítimos frecuentes (esperar a un tercero). |
| F5 | **Coherencia del cierre** | 10 | % de tareas cerradas sin reapertura posterior dentro de la ventana (reusa `retrabajo.ts`) y con los campos obligatorios de su tipo completos (ej. resultado de arqueo si `requiere_resultado`). | Un cierre que se deshace a los dos días no era un cierre. Peso bajo porque `retrabajo.ts` ya lo reporta aparte y no conviene contarlo dos veces con fuerza. |

Los factores que el usuario mencionó y **no** entraron como factor propio, con motivo:

- *% cerradas el mismo día que se marcaron "En proceso"*: no es un defecto por sí mismo — muchas
  tareas se empiezan y terminan el mismo día, y eso es bueno. Lo problemático es el subcaso de
  duración imposible, que ya está capturado en F2 con la salvaguarda de antigüedad. Como factor
  suelto castigaría al que trabaja rápido.
- *Frecuencia de actualización del tablero* (sesiones, `last_seen`): **queda afuera a propósito**.
  Es una métrica de presencia, no de calidad del dato; alguien puede entrar una vez por día y
  registrar impecablemente. Incluirla convierte el ICR en control de asistencia y quema toda la
  credibilidad del indicador.
- *Cumplimiento de recordatorios*: hoy no hay un registro de recordatorios entregados/atendidos.
  Si se implementa alguna vez, entra como factor opcional con peso ≤10, nunca antes.

### 3.3 Qué datos requiere

| Dato | ¿Existe hoy? |
|---|---|
| `proc_at`, `done_at`, `created_at`, `status`, `due_date` | Sí (migración 29 y anteriores). |
| `history[]` con `who`/`at`/`txt` | Sí. |
| Reaperturas | Sí, vía `retrabajo.ts` — **fiable sólo desde la unificación de la Fase B en adelante**. |
| Comentarios, checklist con `done_at`, `ActivityLog` | Sí. |
| Vacaciones para excluir períodos | Sí (`vacaciones.ts`). |
| Días hábiles / feriados | Parcial: `ociosidad.esDiaHabil` cubre lun-vie, no feriados. Suficiente para empezar; con feriados sería más justo. |
| Pausas declaradas por tarea | Tabla `card_pausas` creada y vacía. Sin UI. Es el único dato nuevo que F4 aprovecharía. |

Conclusión: **el ICR se puede calcular hoy, con función pura, sin tabla nueva ni tracking nuevo.**
Eso es deliberado: si para medir la calidad del dato hay que instalar vigilancia, el remedio es
peor que la enfermedad.

### 3.4 Valores de referencia

Son hipótesis a recalibrar con la primera corrida real, no verdades:

- **85–100** — el dato es apto para analizar procesos sin reservas.
- **70–84** — usable con criterio; conviene mirar qué factor tira abajo antes de concluir nada.
- **50–69** — las métricas de tiempo de ese conjunto **no deberían usarse** para decidir.
- **< 50** — el sistema no está representando ese trabajo. La conversación correcta es sobre la
  herramienta y el proceso, no sobre la persona.

La regla de lectura que debería estar impresa en la pantalla: **un ICR bajo invalida las métricas,
no a la persona.**

### 3.5 Cómo no castigar a quien tiene tareas legítimamente largas

Cinco salvaguardas, todas necesarias:

1. F2 sólo penaliza duración corta **combinada** con antigüedad alta. Una tarea de 3 semanas
   registrada con `proc_at` real da F2 perfecto.
2. Ningún factor mide duración absoluta. El ICR nunca premia terminar rápido.
3. Vacaciones, licencias y pausas declaradas se descuentan de los relojes de F3 y F4.
4. Umbral de muestra mínima (8 tareas cerradas en 30 días) y muestra siempre visible junto al
   número, como ya hace `puntualidad.ts` con `muestraChica`.
5. Las tareas operativas recurrentes, que por diseño no pasan por "En proceso", se **excluyen**
   de F1 y F2 en vez de contar como fallas.

---

## 4. Evaluación de los 7 mecanismos complementarios

| # | Mecanismo | Qué aporta | Esfuerzo | Datos que necesita | Riesgo de leerse como vigilancia |
|---|---|---|---|---|---|
| 1 | **Índice de confiabilidad por métrica** (marcar cada indicador con el ICR del conjunto que lo sustenta) | Alto. Es lo que convierte al ICR en algo útil: cada gráfico dice de qué se puede fiar. Sin esto, el ICR es un número suelto. | Bajo (reusa el cálculo, agrega un badge) | Ninguno nuevo | **Bajo** — califica al dato, no a la persona; no aparece ningún nombre. |
| 2 | **Antigüedad de los cambios de estado** (cuánto pasó entre el trabajo real y su registro) | Medio-alto. Es la evidencia concreta detrás de F3 y sirve para detectar el patrón "cargo todo el viernes". | Bajo-medio | `history`, `done_at` | **Medio** — agregado por proceso es sano; desglosado por persona y por día se lee como planilla de horarios. Sólo agregado. |
| 3 | **Alertas de hábitos (sugerir, no bloquear)** | Alto si están bien calibradas: "esta tarea está abierta hace 10 días, ¿seguís con esto?" corrige el dato en el momento y de forma retroactiva. Es P1 de `PROPUESTAS-ADOPCION.md`. | Medio | Ninguno nuevo | **Bajo**, con dos condiciones: que la vea sólo la persona y que nunca bloquee una acción. Si aparece en la vista del jefe pasa a **alto** de inmediato. |
| 4 | **Separar productividad de calidad del registro** | Alto, y es conceptual antes que técnico: son dos pantallas distintas que jamás se combinan en un score único. | Bajo (decisión de diseño) | Ninguno | **Bajo** — es precisamente la medida que baja el riesgo de todo lo demás. |
| 5 | **Tiempo activo real (cronómetro con pausas)** | Bajo respecto de su costo. Ver sección 6. | Alto (UI, tabla, edge cases, capacitación) | `card_pausas` + eventos start/stop | **Alto** — un reloj corriendo sobre el trabajo de cada uno es la funcionalidad más invasiva del proyecto. |
| 6 | **Confirmación de fin del día** | Medio-alto. Crea el momento natural de actualizar; baja el volumen de trabajo del mecanismo 3. Es P2, ya diseñado en `cierre-dia.ts`. | Bajo (ya existe la lógica) | Ninguno nuevo | **Bajo hoy, alto el día que exista una vista de jefe "quién cerró su día"**. Esa vista convierte un espejo personal en control de asistencia. No hacerla nunca. |
| 7 | **Tareas olvidadas** (continuar / finalizar / delegar / posponer con motivo) | Alto. Es el mecanismo 3 con salidas reales; sin salidas, la alerta se aprende a ignorar. | Medio | Ninguno nuevo (motivo va al `history`) | **Medio** — depende enteramente del campo "motivo". Si el motivo es libre y privado de la tarea, bajo. Si se convierte en un reporte de excusas por persona, alto. Nunca listar motivos por empleado. |

### Los que desaconsejo explícitamente

- **Mecanismo 5 (cronómetro)** — ver sección 6. No, salvo condiciones que hoy no se cumplen.
- **"Frecuencia de actualización del tablero" como factor del ICR** — es control de asistencia
  disfrazado de calidad de dato. Es de lo más fácil de implementar (`last_seen` ya está) y por
  eso mismo hay que decir que no ahora.
- **Cualquier ranking de ICR entre personas** — ordenar 30 nombres por un número los convierte en
  competidores. Con ranking, este indicador se optimiza en vez de informar, y en tres meses todos
  tienen 95 y ninguna métrica de tiempo es más verdadera que hoy.
- **Vista de jefe con "quién cerró su día"** — la trampa más barata y más dañina de la lista. Ya
  está advertida en `PROPUESTAS-ADOPCION.md`; la repito acá porque va a parecer inocente cuando
  la pidan.

---

## 5. La pregunta difícil: ¿a quién se le muestra el ICR?

### Las tres opciones

**(a) Sólo a cada uno el suyo.** Máxima aceptación, cero resistencia. Costo: el jefe no tiene
forma de saber si los datos con los que decide sirven, que es el problema que originó todo esto.
Insuficiente sola.

**(b) Al jefe agregado y sin nombres; a cada uno el suyo.** El jefe ve "ICR del equipo: 72; el
factor más bajo es trazabilidad de estados (F1)" y, si acaso, cortes por proceso, categoría o
tipo de tarea. Cada persona ve su propio ICR y sus propios factores. Nadie ve el de otro.

**(c) Al jefe con nombres.** Máxima información nominal, y el ICR deja de ser un indicador de
calidad de dato para convertirse, en la práctica, en una nota. No importa lo que diga la pantalla:
un número por persona visible para el jefe se lee como evaluación. Siempre.

### Recomendación: (b), agregado y sin nombres

Y la defiendo por tres motivos, no por cortesía:

1. **Responde la pregunta real.** Lo que el jefe necesita decidir es "¿puedo confiar en el tiempo
   promedio de esta categoría?" y "¿dónde está fallando el registro?". Las dos se responden con
   agregados por proceso. El nombre no agrega poder de decisión, agrega poder disciplinario —
   que es explícitamente lo que la restricción del usuario descarta.
2. **Los nombres destruyen el indicador que quieren medir.** Con 30 personas y ICR nominal, la
   respuesta racional de cada empleado es maximizar su ICR: marcar "En proceso" siempre, aunque
   sea mecánico, tocar tareas para que no queden huérfanas. El ICR sube, el dato no mejora, y se
   pierde el único instrumento que quedaba para detectar registros de relleno. Es Goodhart en su
   forma más pura: la medida se vuelve objetivo y deja de ser medida.
3. **Es reversible en la dirección correcta.** Empezar sin nombres y agregarlos después, si algún
   día hace falta, es una conversación posible. Empezar con nombres y sacarlos después no
   recupera la confianza: la gente ya aprendió qué clase de herramienta es esta.

Salvaguardas que la opción (b) necesita para no derivar sola hacia (c):

- El corte de agregación mínimo es 5 personas. Con menos, no se muestra desglose: un ICR de un
  grupo de 2 es un ICR nominal con otro nombre.
- Ningún corte combinable que permita despejar a una persona (marca + sucursal + categoría).
- La pantalla dice, en texto, para qué sirve y para qué no. La misma disciplina que
  `ociosidad.ts` tiene en su encabezado, pero visible para el usuario final.
- Se anuncia al equipo antes de encenderlo, junto con la frase de que no alimenta evaluación de
  desempeño. Un indicador de calidad de dato que aparece sin aviso se lee como auditoría sorpresa.

---

## 6. El cronómetro con pausas (item 10)

**Veredicto: no implementarlo ahora.** No es una postergación diplomática; creo que no conviene.

Los argumentos, en orden de peso:

1. **Aporta poco sobre lo que ya hay.** Hoy, con `proc_at` + `done_at`, se estima duración de
   tarea. El cronómetro mejora eso en precisión — minutos netos en vez de horas de calendario —
   pero la decisión que habilita es la misma: "esta tarea consume demasiado, revisemos el
   proceso". Para eso, saber que una tarea lleva "unas 6 horas" o "5 h 20 min netos" no cambia
   ninguna acción. Se paga precisión que nadie va a usar.
2. **Depende de la misma disciplina que dice arreglar.** Un cronómetro que hay que arrancar,
   pausar y frenar a mano es *más* dependiente del comportamiento del usuario que `proc_at`, no
   menos. Quien hoy marca "En proceso" al final va a arrancar el cronómetro al final. Un
   trabajador contable se interrumpe diez veces por día: teléfono, consulta de un compañero,
   otra tarea urgente. Nadie pausa diez veces. El resultado previsible es un dato peor, con
   apariencia de precisión — que es la peor combinación posible.
3. **Es la funcionalidad más invasiva del proyecto, y se ve.** Todo lo demás del tablero registra
   hechos discretos que la persona ya iba a registrar. Un reloj corriendo en pantalla mientras
   alguien trabaja es una experiencia cualitativamente distinta y se percibe como tal desde el
   primer día. Con 30 personas entrando ahora, es el candidato número uno a convertirse en la
   anécdota que define cómo se habla del sistema en los pasillos.
4. **Costo real no trivial.** Tabla, RLS, UI de start/pause/stop, resolución de cronómetros
   olvidados abiertos toda la noche, edición manual de tiempos (que hay que permitir, y que
   reintroduce exactamente la subjetividad que se quería eliminar), y capacitación de 30 personas.

Las condiciones bajo las cuales lo reconsideraría, todas simultáneas:

- Que el ICR esté en producción y muestre que F1/F2 ya están altos, es decir que el registro
  básico funciona. Un cronómetro sobre un registro que no funciona sólo agrega una capa de ruido.
- Que exista un caso de decisión concreto que hoy no se puede tomar por falta de precisión de
  minutos — no una intuición de que "sería bueno saberlo".
- Que sea **opcional y por tarea**, activado por la persona para su propio uso, sin agregación
  hacia arriba en la primera versión.
- Que nunca alimente comparación entre personas.

Nota práctica: la tabla `card_pausas` ya existe vacía (migración 31). No molesta y no hay que
borrarla. Que la tabla esté no es motivo para usarla.

---

## 7. Cierre

### Las tres que recomiendo implementar

1. **El ICR como función pura, con la fórmula de la sección 3, mostrado en modo (b)** — agregado
   sin nombres para el jefe, propio para cada uno. Es el núcleo de todo esto y no requiere ningún
   dato nuevo.
2. **Índice de confiabilidad por métrica (mecanismo 1)** — cada indicador de tiempo del tablero
   acompañado del ICR del conjunto que lo sustenta. Es barato, y es lo que hace que el ICR sirva
   para algo en vez de ser un número más. Sin esto, el punto 1 es decorativo.
3. **Tareas olvidadas con salidas reales (mecanismos 3 + 7 juntos)** — la alerta personal de tarea
   estancada con las cuatro opciones (continuar / finalizar / delegar / posponer con motivo). Es
   el único mecanismo que **corrige datos viejos** en vez de sólo prevenir hacia adelante, y ataca
   directamente el factor F4. Requiere calibración seria: días hábiles, respetar vacaciones,
   snooze real, una sola por sesión. Mal calibrado es contraproducente.

Las tres se sostienen entre sí: el ICR mide, el badge de confiabilidad hace que la medición tenga
consecuencia práctica, y las tareas olvidadas dan la vía para mejorar el número trabajando de
verdad y no fingiendo.

### Las que desaconsejo, y por qué

- **Cronómetro con pausas** — sección 6. Costo de percepción alto, aporte marginal bajo, y depende
  de la misma disciplina que pretende sustituir.
- **Frecuencia de actualización del tablero como factor del ICR** — mide presencia, no calidad de
  dato. Contamina el indicador con algo que se lee como control horario.
- **ICR nominal para el jefe (opción c) y cualquier ranking entre personas** — convierte la medida
  en objetivo y destruye justamente la señal que buscábamos.
- **Vista de jefe de "quién cerró su día"** y cualquier reporte de motivos de postergación por
  empleado — barato de hacer, caro de deshacer.

### Principio rector

**Si un indicador de calidad del dato puede leerse como una nota sobre una persona, deja de medir
la realidad y empieza a fabricarla.**
