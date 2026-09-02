# Períodos: lo que falta, y por qué agosto se vio vacío — 02/09/2026

**El disparador.** El 2/9 Valentino abrió el período de agosto y vio 51 pendientes y 0
terminadas. Una compañera vio lo mismo y llegó a la misma conclusión: que se había perdido el
trabajo del mes. Todo el equipo lo interpretó igual.

**No se perdió nada.** Verificado con la consulta, ese mismo día:

```
mes      | tarjetas | terminadas
2026-07  |   132    |    93
2026-08  |   157    |   119
```

Agosto está entero en `cards_archive`. Lo que falló fue la pantalla, no los datos.

---

## Los dos problemas de fondo

Los cuatro puntos que reportó el equipo se reducen a dos causas.

### PROBLEMA 1 — Un mes pasado se dibuja en blanco en vez de leerse del archivo

`cardsDelPeriodo` (`src/lib/periodo-instancias.ts:117`) resuelve así un período que no es el
vigente: busca su estado en `card_periodos` y, si no encuentra fila, llama a
`instanciaEnBlanco`, que devuelve la tarjeta con `status: "pend"`, el checklist destildado y
**`comments: []` e `history: []`**.

Agosto no tiene filas en `card_periodos` **y no puede tenerlas**: durante agosto, agosto era el
mes vigente, así que todo lo que se hizo se guardó en `cards`. Las filas de `card_periodos` sólo
las escribe quien adelanta trabajo de un mes que todavía no llegó.

O sea que **todo mes ya trabajado se ve vacío apenas deja de ser el vigente.** No es un caso de
borde: le pasa a todos los meses y a todo el equipo, siempre.

**La instancia en blanco tiene sentido para un mes FUTURO** —septiembre no debe verse como una
copia de agosto— **y ninguno para un mes pasado**, donde la respuesta correcta existe y está en
`cards_archive`.

**Es el reflejo del hallazgo 4 de la auditoría del 05/08.** Ese hallazgo decía que el trabajo
adelantado desaparecía al llegar el mes, y se arregló (migraciones 51 y 56). El caso simétrico
—mirar hacia atrás un mes que se trabajó *siendo* el vigente— quedó abierto, y es el que más
duele porque afecta a todos los meses en vez de a uno.

### PROBLEMA 2 — Los comentarios se arrastran de mes a mes

Con las palabras del reporte:

> *"si yo puse por ejemplo en el banco de agosto 'cerrado con salvedad, revisar X movimiento', no
> debería ser algo que se arrastre mes a mes, debería quedar sólo como constancia del mes."*

El reinicio mensual (`reset_recurrentes_seguro`) toca `status`, `done_at`, `proc_at`, `checklist`
e `history`. **No toca `comments`.** Así que una observación escrita en agosto sigue pegada a la
tarjeta en septiembre, octubre y para siempre.

Es el problema opuesto al 1 y por eso conviene verlos juntos: **el estado se borra cuando debería
conservarse, y los comentarios se conservan cuando deberían quedar en su mes.**

---

## Lo que el equipo espera, en sus palabras

Vale copiarlo textual, porque es el criterio contra el que hay que diseñar:

> *"si bien debe arrancar un período nuevo, no debería borrar lo del pasado, porque está bueno
> saber que podés volver para atrás 2 meses después, reabrir determinada tarea porque estaba mal
> y dejar asentado que se terminó correctamente."*

> *"lo mismo con tareas que no dependen del ciclo. Por ejemplo, yo estoy haciendo una evaluación
> de un pasivo hace 2 meses: debería aparecer como creada el día que se inicia e ir
> completándose a lo largo del tiempo."*

De ahí salen tres requisitos:

1. **Un mes pasado se consulta y muestra lo que realmente pasó**, con su checklist, sus
   comentarios y su historial.
2. **Un mes pasado se puede REABRIR**: corregir una tarea dos meses después y que quede asentado
   que se terminó bien. Hoy no hay forma — y si la hubiera sobre la vista en blanco, escribiría
   sobre una ficción.
3. **Una tarea que no sigue el ciclo mensual no se reinicia ni se fragmenta.** Una evaluación de
   pasivo que arrancó en julio tiene que verse como una sola tarea, con su fecha de inicio real y
   su avance acumulado, no como tres tareas vacías en tres meses.

### Sobre el punto 3, la mitad ya existe y conviene saberlo

- La **base** ya respeta esas tareas: el reinicio filtra por
  `coalesce(reset_policy,'mensual') = 'mensual'`, y una tarea de "una sola vez" se guarda con
  `reset_policy: 'manual'`. El cron no la toca. **Ese lado está bien.**
- La **vista** no: `instanciaEnBlanco` sólo respeta `reset_policy === "mantener"`, no `"manual"`.
  Así que la evaluación de pasivo se ve bien en el mes en curso y **en blanco en cualquier otro**.

O sea que el punto 3 no necesita un mecanismo nuevo: necesita que la vista deje de blanquear lo
que la base decidió no reiniciar.

---

## Lo que NO hay que hacer, y conviene dejarlo escrito

**No mergear `card_periodos` sobre el mes vigente.** Ya está analizado en la auditoría del 05/08:
mostraría el estado adelantado por encima del trabajo real, para siempre. Cambia un bug por otro
peor.

**No "arreglarlo" copiando el estado del mes anterior al nuevo.** Es lo que evita
`instanciaEnBlanco` y por eso existe: un mes nuevo que arranca con todo tildado hace que el
tablero mienta en la otra dirección, y encima nadie lo nota porque se ve prolijo.

---

## Tres caminos, con lo que cuesta cada uno

| Camino | Qué implica | Riesgo |
|---|---|---|
| **A. Leer el archivo para los meses pasados.** `cardsDelPeriodo` distingue tres casos —futuro, vigente y pasado— y el pasado sale de `cards_archive`. | Es el arreglo más chico y ataca la causa. No necesita migración. | Bajo. El archivo ya existe, ya se lee en Historial y ya tiene RLS. |
| **B. Escribir `card_periodos` también para el mes vigente**, al cerrarlo. | Unifica el modelo: todo mes pasado tiene su fila. | Medio: cambia el reinicio, que ya se rompió dos veces este mes. |
| **C. Dejar de reiniciar y usar una tarea por mes.** | El modelo más simple de entender. | Alto: rediseño completo, y multiplica las tarjetas. |

**A resuelve el problema 1 y el 3.** El problema 2 —los comentarios que se arrastran— es
independiente y se resuelve limpiando `comments` en el reinicio, **después** de que la foto del
archivo se haya tomado. El orden importa: al revés, la constancia del mes se perdería de verdad.

---

## Lo que hay que decirle al equipo, hoy

Antes de arreglar nada, porque tres personas ya creen que perdieron un mes de trabajo:

> **No se perdió nada.** Agosto está completo: 157 tareas, 119 terminadas. Se ve en
> **Historial**, no en el selector de período. Esa pantalla, para un mes que ya pasó, muestra las
> tareas en blanco — es un error nuestro y lo estamos arreglando.

El aviso vale más que el arreglo y va primero. Un equipo que cree que el sistema le borró un mes
de trabajo deja de cargar cosas en el sistema.
