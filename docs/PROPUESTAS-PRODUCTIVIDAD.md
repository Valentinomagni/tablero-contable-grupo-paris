# Propuestas de productividad para el empleado — 14/08/2026

**El pedido, textual:** *"ayudarle a organizarse aún más, más allá de poder asignar puntos, peso
y un objetivo para las tareas"* y *"marcar una ruta en el mes"*.

**Este documento no trae código, a propósito.** Es la única parte del pedido donde no hay una
respuesta deducible del código: depende de cómo trabaja el equipo, y eso lo sabe el dueño.
Escribir código antes de decidir es cómo se construyen funciones que nadie usa — el proyecto ya
tiene una vista materializada que nadie mira y un cronómetro que su propio análisis desaconsejó.

**Cada propuesta trae tres cosas, y sin las tres no entra** (regla del paso 3 de `CLAUDE.md` §2):
qué mide, a quién ayuda, y **cuándo se descarta si no sirvió**. Una propuesta sin fecha de
revisión es un compromiso permanente disfrazado de experimento.

---

## Lo que YA existe, para no volver a construirlo

Antes de proponer nada fui a mirar. Buena parte del terreno está cubierto:

| Qué | Dónde | Qué hace |
|---|---|---|
| Orden sugerido del día | `src/lib/prioridad-calculada.ts` + Mi día | Ordena por vencimiento, prioridad, tareas que esperan por ésta y lo rápido de sacar. **El jefe configura qué pesa más.** |
| "Al ritmo actual, ¿llegás?" | `src/lib/cierre-unificado.ts:82` (`proyeccionCierre`) | Proyecta si el cierre llega a fin de mes según lo cerrado por día hábil en los últimos 7 días. **Sólo para el cierre y sólo sobre lo propio.** |
| Espejo semanal privado | `src/lib/tu-semana.ts` | Viernes a la tarde: lo terminado y la racha. Sólo lo positivo, sin comparación con nadie. |
| Cierre del día | `src/lib/cierre-dia.ts` | Los pasos para cerrar la jornada. |
| Avance del mes de una tarea diaria | `src/lib/arqueo-mensual.ts` | "6 de 21 días hábiles", contando feriados. |
| Días hábiles | `src/lib/dias-habiles.ts` | Con los feriados que carga el jefe. |

**La conclusión que sale de esto y cambia la propuesta principal:** *la ruta del mes* **no hay que
construirla, hay que sacarla de donde está encerrada.** `proyeccionCierre` ya hace exactamente el
cálculo que se pide. Lo hace sólo para las tareas del cierre, y sólo se ve entrando a la pantalla
de Cierre.

---

## P1 — La ruta del mes, sacando `proyeccionCierre` de donde está

**Qué es.** Una línea arriba de Mi día: *"Día 8 de 21 hábiles. Cerraste 12 de 30. A este ritmo,
terminás el 27."*

**Por qué es la más fuerte de las cuatro:** los tres insumos existen y están testeados
(`dias-habiles`, `proyeccionCierre`, los vencimientos). No es una función nueva: es generalizar
una que hoy sólo mira las tareas del cierre, y mostrarla donde la persona ya entra todos los días.

**Qué mide.** Avance del mes contra días hábiles transcurridos, y fecha estimada de terminar al
ritmo propio de los últimos días.

**A quién ayuda.** Al empleado, y sólo a él: es su mes contra su ritmo, sin comparación con nadie.
**Nunca al jefe** — si esta línea aparece en el resumen del jefe deja de ser una brújula y pasa a
ser una fecha prometida, y a partir de ahí la gente cierra tareas para mover la línea.

**Cuándo se descarta.** A los dos meses. Si en la reunión siguiente nadie la menciona ni la usa
para pedir ayuda, sale. Un cartel que se ignora enseña a ignorar los carteles de al lado.

**Riesgo, escrito para que no sorprenda.** Una proyección que dice "terminás el 27" cuando el
vencimiento es el 25 puede leerse como reproche. La redacción tiene que ser descriptiva —*"a este
ritmo, el 27"*— y nunca imperativa. Y sólo se muestra si hay ritmo medible: con dos días de datos,
callarse.

---

## P2 — Por qué esa tarea está primera

**Qué es.** Mi día ya ordena, pero no dice por qué. Agregar el motivo en una línea: *"Primero
porque vence mañana y hay 2 tareas esperando por ésta."*

**Por qué importa más de lo que parece.** Un orden que no se explica se obedece o se ignora, y en
un equipo de contadores adultos se ignora. Explicado se puede discutir — y una discusión sobre el
orden es información que hoy se pierde entera.

**Qué mide.** Nada. Es transparencia sobre un cálculo que ya se hace.

**A quién ayuda.** Al empleado para decidir; y al jefe indirectamente, porque cuando alguien dice
"esto no debería ir primero" aparece un criterio que estaba mal configurado.

**Cuándo se descarta.** No se descarta: es texto sobre un cálculo existente, no una función. Si
molesta, se pliega.

---

## P3 — Bloques de trabajo parecido

**Qué es.** Agrupar tareas del mismo tipo para hacerlas juntas —todas las conciliaciones un
martes— en vez de saltar de conciliación a arqueo a IVA. El tablero ya tiene carriles y agrupación
por categoría; lo que falta es la **sugerencia**: *"tenés 5 conciliaciones pendientes, 3 vencen
esta semana."*

**Por qué depende de la Fase B del plan.** Hoy "Conciliación Chevrolet" y "Conciliacion Peugeot"
pueden estar escritas distinto y el sistema no sabe que son lo mismo. Con `estandar_id`, sí. **Esta
propuesta no se puede construir antes que el catálogo**, y eso es un orden, no una excusa.

**Qué mide.** Cuántas tareas de la misma definición hay pendientes y cuándo vencen.

**A quién ayuda.** Al empleado: cambiar de contexto entre tipos de tarea distintos es donde se
pierde tiempo sin que nadie lo note, porque no aparece en ninguna métrica.

**Cuándo se descarta.** Tres meses después del catálogo. Si el equipo sigue trabajando por
vencimiento en vez de por bloque, la sugerencia no sirve y sale.

---

## P4 — El pedido a otra área, con su fecha

**No es una propuesta nueva: es la Fase C del plan.** Se anota acá porque es la que más
directamente le devuelve tiempo al empleado.

Hoy, cuando alguien queda esperando a Ventas, **la demora aparece como demora suya**. No tiene
forma de mostrar que la pelota está afuera, así que o la persigue a mano o carga con un número que
no le corresponde.

**Qué mide.** Cuántas tareas espera cada área, y hace cuántos días hábiles la más vieja.

**A quién ayuda.** Al empleado, que deja de cargar con una demora ajena. Y al jefe, que puede ir a
hablar con la otra área con un dato en la mano en vez de una impresión.

**Cuándo se descarta.** A los dos meses. Si nadie marcó ninguna tarea como bloqueada, el problema
no era ése.

---

## Lo que NO recomiendo, y por qué conviene que quede escrito

**Cronómetros y medición de tiempo por persona.** Ya está desaconsejado en
`docs/PROPUESTA-ICR.md`, y la tabla `card_pausas` está creada y vacía a propósito. Choca de frente
con la regla más dura del producto.

El razonamiento, para no tener que rediscutirlo cada vez: el modo de falla más probable de este
proyecto no es técnico. Si el equipo percibe la app como control, van a trabajar para la foto —
cerrar tareas a las apuradas los viernes, abrir tareas de más para mostrar volumen, no registrar
lo que se demoró. **Y ahí todos los datos del tablero se vuelven mentira, incluidos los que el jefe
necesita de verdad.** Un cronómetro es la señal más clara posible de que se mide a la persona y no
al proceso.

**Metas individuales visibles para el resto.** Misma razón. Los objetivos con peso ya existen y son
privados; hacerlos comparables los convierte en un ranking.

---

## Orden sugerido

1. **P2** — texto sobre un cálculo que ya existe. Barato y sin riesgo.
2. **P1** — la ruta del mes. Es lo que se pidió, y los insumos están.
3. **P4** — ya está planificada como Fase C.
4. **P3** — después del catálogo, no antes.

---

## Cómo saber si esto sirvió

No por si "se usa", que siempre se puede maquillar. La pregunta honesta es más chica:

> **¿Alguien pidió ayuda antes de que fuera tarde?**

Ésa es la conducta que estas cuatro propuestas buscan producir. Si dentro de dos meses alguien
dice *"vi que a este ritmo no llegaba y avisé"*, funcionaron. Si el único cambio es que hay más
pantallas, no.
