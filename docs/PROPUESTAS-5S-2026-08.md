# Ocho propuestas — 5S y Kaizen aplicados de verdad

Análisis de mejora continua, 07/08/2026.

Cada propuesta está anclada en un principio concreto, en un problema con evidencia en el código, y
tiene su criterio para descartarla. **Una propuesta sin criterio de descarte es un compromiso
permanente disfrazado de experimento.**

---

## Advertencia previa: no construir ninguna todavía

**No se construye nada de acá antes de cerrar los puntos 1 a 5 de `docs/AUDITORIA-2026-08-05.md`.**

Tres de esos defectos corrompen justo el dato que estas propuestas medirían: el "cumplimiento del
mes" que sube solo con el paso del tiempo, el trabajo adelantado que desaparece cuando llega el
mes, y el archivo del mes que se destruye si se corre dos veces el reinicio.

Mejorar la medición encima de una medición rota es sobreprocesamiento puro: se paga trabajo para
producir números que ya sabemos falsos. En Toyota esto es doctrina y no gusto: **no se mejora un
proceso inestable, primero se lo estabiliza.**

---

## Lo que ya existe y no hay que volver a proponer

| Si a alguien se le ocurre… | Ya está en |
|---|---|
| Agenda del día, retomar, tarea estancada, resumen semanal privado, cierre del día | `MiDia.tsx` + `midia.ts`, `retomar.ts`, `estancadas.ts`, `tu-semana.ts`, `cierre-dia.ts` |
| Medir si el dato es confiable antes de decidir con él | `icr.ts` + `confianza-metrica.ts` + `BadgeConfianza.tsx` |
| Riesgo de que una categoría dependa de una sola persona | `busfactor.ts` |
| Cuánto del mes era previsible y cuánto entró de urgencia | `previsibilidad.ts` |
| Retrabajo, puntualidad, estabilidad, multitarea | `retrabajo.ts`, `puntualidad.ts`, `estabilidad.ts`, `salud-operativa.ts` |
| Patrones repetidos mes a mes, instructivo por tipo de tarea, retrospectiva del cierre | Ya propuestos en `PROPUESTAS-2026-08.md` |
| Cronómetro | **Desaconsejado con fundamento** en `PROPUESTA-ICR.md` §6 |

---

## Las ocho, ordenadas por costo

| # | Propuesta | Principio | Costo | ¿Migración? |
|---|---|---|---|---|
| 3 | Las diferencias que se repiten | Seiso | Chico | No |
| 8 | Por qué se volvió a hacer | Muda (retrabajo) | Chico | No |
| 1 | Está frenada, y por qué | Jidoka / Andon | Chico-medio | No |
| 5 | El checklist que funcionó | Seiketsu | Medio-bajo | No |
| 2 | Lo que ya no hace falta | Seiri | Medio | No |
| 4 | La ola que se viene | Heijunka | Medio | No |
| 7 | Buscar en todo | Seiton | Medio (partible) | Sólo una parte |
| 6 | Ideas del equipo | Kaizen + Shitsuke | Medio | Sí, una tabla |

Seis de ocho no tocan el esquema. No es casualidad: con 39 migraciones escritas y una sola persona
manteniendo esto, **cada migración nueva es deuda con intereses**.

---

## 1. Está frenada, y por qué — *Jidoka / Andon*

**El principio.** Parar la línea cuando algo sale mal, y poder pedir ayuda sin que parezca que no
podés solo. No lo encuadro como "medir la espera" aunque también la mida: el problema de fondo es
que **hoy la persona trabada no tiene ninguna manera de decirlo**.

**La evidencia.** El estado de una tarea es `pend | proc | term` y nada más. "Bloqueada" existe
sólo entre tareas del propio tablero. No hay forma de registrar lo que en un cierre pasa todos los
meses: espero el extracto, espero el listado de Ventas, espero que confirmen un criterio.

Y lo más fuerte: **esto ya se había diseñado y se perdió en la implementación.**
`PROPUESTAS-ADOPCION.md` P1 dice textual: *"El botón Está frenada es clave: le da al empleado una
respuesta honesta que no es 'estoy atrasado'"*. El componente que se construyó,
`EstancadaPrompt.tsx`, tiene cuatro botones: *Sigo con esto*, *Ya está terminada*, *Ahora no*,
*Abrir la tarea*. Ninguno es "está frenada".

Hoy, alguien que espera hace ocho días un archivo de otra área sólo puede apretar "Sigo con esto"
— que es exactamente el dato de relleno que el ICR existe para detectar.

**Qué mide.** Días de espera **por causa**, sobre una lista corta y cerrada: dato de otra área,
archivo externo, respuesta de un tercero, criterio a definir, sistema caído. De ahí salen dos
números que hoy no existen: cuántos días del mes se fueron esperando, y qué causa se lleva la
mayor parte.

**De dónde sale el dato.** De ningún lado nuevo. Se escribe como marca estructurada en `history`,
el patrón que el proyecto ya usa tres veces (`marcaPlantilla`, `marcaFiscal`, `TXT_REAPERTURA`).
Cero migración. Un toque en una lista de cinco opciones, sin escribir nada.

**Cómo ayuda al empleado.** *"Con esto yo dejo de figurar como el que tiene una tarea parada hace
ocho días. La tarea dice que espera el extracto, deja de aparecerme en Mi día como si fuera culpa
mía, el reloj del tiempo máximo no me corre mientras espero, y a fin de mes hay un número que dice
que el extracto llegó tarde cuatro meses seguidos. Eso ya no lo tengo que discutir yo en una
reunión: está escrito."*

**Por qué no es vigilancia.** El dato se agrega **por causa, nunca por persona**. La agregación
por persona no se calcula — no es una pantalla escondida, es una función que no existe. Declarar
una espera no requiere aprobación ni notifica a nadie. Y **beneficia a quien la declara**, porque
excluye ese tiempo del tiempo máximo. Un mecanismo que sólo tiene incentivo a favor de quien lo
usa no se vuelve instrumento disciplinario.

**Cómo se sabe si sirvió.** A los dos meses: de las tareas que estuvieron 5+ días hábiles sin
movimiento, ¿al menos un tercio tiene causa declarada? Si no, se saca. Segundo criterio y más
importante: si la causa número uno es la misma tres meses seguidos y no se hizo nada, la medición
no alimenta ninguna decisión y también se saca.

---

## 2. Lo que ya no hace falta — *Seiri*

**El principio.** Separar lo necesario de lo innecesario, en su forma difícil: no "borrá lo que no
usás", sino **descubrir con datos que ya tenemos qué trabajo se hace por costumbre**.

**La evidencia.** El proyecto ya diagnosticó esto y lo tapó sólo hacia adelante.
`recurrencia-alta.ts` dice textual: *"una tarea cargada para resolver algo puntual quedaba en el
tablero para siempre… Basura acumulándose, que es exactamente lo contrario de Seiri."* La solución
fue cambiar el default de alta a "una vez" — evita basura nueva y **no toca la vieja**.

**Qué mide.** Por cada recurrente, sobre 6 meses de `cards_archive`: en cuántos meses se cerró
**sin ninguna señal intermedia** — sin comentario, sin checklist tildado, sin dato de control, sin
actividad, sin que otra tarea dependiera de ella. Eso no prueba que sea inútil; prueba algo más
honesto: **que el tablero no guarda ningún rastro de para qué sirvió**.

**Cómo ayuda al empleado.** *"Una vez por trimestre me aparecen tres tareas mías con la pregunta
'¿esto sigue haciendo falta?' y las contesto en diez segundos. Saco dos y paso una a trimestral. Y
si mañana alguien pregunta por qué no está, quedó escrito que la revisé yo."*

**Por qué no es vigilancia.** Acá el peligro no es el jefe: es que la pantalla se lea como *"tu
trabajo no sirve"*. Cuatro defensas de diseño, no de redacción: la lista **la ve sólo el dueño de
la tarea**; el texto habla del *registro*, no del trabajo; *"sirve así como está"* es una respuesta
de primera clase que cuesta un click y no se vuelve a preguntar; y hacia arriba viaja un solo
número agregado del área, nunca quién ni cuáles.

**Cómo se sabe si sirvió.** A los dos meses: si nadie contestó, la pregunta está mal puesta. Si el
100% fue "sirve así", la detección es mala — y **ése es un resultado bueno**: significa que no hay
trabajo inútil y hay que dejar de buscarlo. Los dos casos terminan con la función afuera y ninguno
es un fracaso.

---

## 3. Las diferencias que se repiten — *Seiso*

**El principio.** Seiso en su sentido literal de Toyota: limpiar la máquina es cómo se detecta la
falla antes de que pare la línea. El equivalente exacto acá es **el arqueo diario de caja**: la
inspección chica y cotidiana donde el defecto del proceso aparece primero.

**La evidencia.** El dato se recoge todos los días y **no se cruza nunca**. `MisArqueos.tsx` le
muestra al cajero una tabla plana del mes: fecha, importe, observación. Se acabó. El encabezado de
`tendenciaDiferencias` dice lo que falta: *"una diferencia recurrente casi siempre indica un
procedimiento mal diseñado"* — lo dice, y después no da ninguna herramienta para encontrar cuál.

**Qué mide.** Sobre 6 meses: el mismo importe repetido 3+ veces, concentración por día de la
semana, por sucursal, y palabras repetidas en la observación. **Un $2.500 que aparece cuatro
viernes no es un error de caja: es un circuito de pago que entra tarde.**

**Cómo ayuda al empleado.** *"Dejo de contar la caja tres veces buscando los mismos $2.500. La
pantalla me dice que ese importe apareció los últimos cuatro viernes, y en vez de buscar un error
mío pido que se revise el circuito. Es la diferencia entre media hora buscando y resolverlo de
raíz."*

**Por qué no es vigilancia.** Vive en *Mis arqueos*, la pantalla propia del cajero. Lo que sube al
Reporte es el corte por importe, día y sucursal — nunca una lista de personas. Hay precedente en el
propio código: la tabla de reincidentes ya fue reordenada alfabéticamente y se le sacó la columna
de monto.

**Es la más barata de las ocho.** Sin migración, sin pantalla nueva.

---

## 4. La ola que se viene — *Heijunka*

**El principio.** Nivelar la carga. Una ola que se ve con dos semanas de anticipación se puede
aplanar; una que se ve el día 11 sólo se puede padecer.

**La evidencia.** Todo lo que el sistema sabe de distribución **mira hacia atrás**.
`flujo-mensual.ts` reconstruye la carga ya vivida y hasta tiene la etiqueta *"Mayor carga hacia el
cierre"* — o sea que **el sistema ya sabe nombrar la ola después de que pasó**. Nada proyecta el
mes completo sumando lo que todavía no existe como tarjeta: recurrencias, plantilla de cierre y
calendario fiscal.

**Condición dura.** Esto no vale nada hasta que se arregle el punto 4 de la auditoría: hoy el
trabajo adelantado desaparece cuando el mes pasa a vigente. **Construirlo antes es invitar a la
gente a adelantar trabajo para que después se borre.** Peor que no hacer nada.

**Cómo ayuda al empleado.** *"El día 2 veo que el 12 se me juntan seis cosas y que dos las puedo
hacer el 5, que lo tengo tranquilo. Hoy me entero el 11 a la tarde."*

**Por qué no es vigilancia.** Es mi propio pronóstico, en mi propia pantalla. Para el encargado, el
agregado **por día del área**: "el 12 el área está al triple" sirve para repartir. El dato "cuánto
adelantó cada uno" **no se calcula**: sería un indicador de esfuerzo por persona.

**Cómo se sabe si sirvió.** ¿Bajó la relación pico/promedio? Si es cero, la conclusión honesta no
es "mejorar la pantalla": es que **la ola es impuesta desde afuera** y nivelarla se negocia entre
áreas, no se resuelve con software. Ese hallazgo también vale.

---

## 5. El checklist que funcionó — *Seiketsu*

**El principio.** Estandarizar, en la versión difícil: **capturar el mejor método de alguien y
volverlo el método de todos, sin imponerlo**.

**La evidencia.** `checklist.ts` tiene ocho líneas: editar ítem, borrar ítem. Los pasos se
re-tipean a mano, en cada tarjeta, por cada persona, todos los meses. Hay cinco formas de hacer lo
mismo según quién lo haga, y el sistema no tiene dónde guardar ninguna.

**En qué se diferencia del "instructivo por categoría"** ya propuesto: ése es un texto que alguien
escribe una vez, y su modo de falla admitido es quedar viejo y mentir. Éste no le pide a nadie que
escriba nada: toma el checklist que **alguien ya usó y completó de verdad** el mes pasado.

**Qué mide.** Cuántas tareas arrancaron desde el checklist compartido; cuánta gente lo modificó
(**un estándar que nadie modifica nunca es un estándar muerto**, y eso es señal, no falla); y
**cuál es el paso que más veces queda sin tildar** — el paso que sobra o está mal escrito. Ese
tercero es Kaizen en su forma más chica y más útil.

**Cómo ayuda al empleado.** *"Cuando me toca cubrir a alguien de licencia no arranco de cero
mirando una tarea que dice 'Conciliación Banco Nación' y nada más: viene con los pasos que esa
persona usó el mes pasado."*

**La métrica prohibida.** "Cuántos pasos completó cada uno" sería un medidor de obediencia al
procedimiento. El paso más salteado se mide **por paso, sobre todo el equipo**, jamás por
individuo.

---

## 6. Ideas del equipo: proponer, probar, decidir — *Kaizen + Shitsuke*

**El principio.** La mejora la propone quien hace el trabajo (Kaizen), y lo que hace que dure es
que esté escrito cuándo se la revisa (Shitsuke). Van juntas: una idea sin fecha de revisión se
apaga sola.

**¿No alcanza el módulo de Consultas?** No, y el propio texto de la pantalla lo dice: *"Canal
interno para consultas, sugerencias o errores **del tablero**"*. Tres problemas verificables:

1. **Es sobre la herramienta, no sobre el trabajo.** Una idea sobre cómo se hace el cierre no
   tiene dónde ir.
2. **Es privada.** `const mias = todas.filter((c) => c.autor === meId)`. Nadie puede apoyar ni
   mejorar la idea de otro.
3. **El mejor final posible es "Archivada".** Los estados son `nueva | leida | archivada`. No
   existe "se probó" ni "quedó". **Un buzón cuyo mejor desenlace es *Leída* entrena a la gente a
   dejar de escribir.**

**Qué mide — y acá está la decisión que define la propuesta.** **No mide cuántas ideas tuvo cada
persona.** Eso es un ranking con otro nombre. Mide si el *sistema* funciona: cuántas llegaron a
probarse, cuánto tardaron, cuántas quedaron y cuántas se volvieron atrás. **Volver atrás es un
resultado bueno y hay que decirlo en la pantalla**, porque si volver atrás es un fracaso, nadie
prueba nada.

**La parte Shitsuke.** Una idea aprobada no queda "aprobada": queda **"en prueba hasta el 30/09"**.
Ese día la app pregunta una sola cosa: *"¿Seguimos así o volvemos al método anterior?"*. Eso impide
que una mejora se apague en silencio, y hace barato animarse.

**Y debe existir la opción de proponer sin nombre.** En un equipo con jerarquía real, la idea
incómoda es la valiosa, y la idea incómoda no se firma.

**Cómo se sabe si sirvió.** ¿Al menos tres ideas llegaron a "en prueba"? Si no, **el problema no
es el canal**: es que nadie cree que proponer cambie algo, y eso no se arregla con una pantalla.
Ese diagnóstico vale más que la función.

---

## 7. Buscar en todo, y saber qué no se encuentra — *Seiton*

**La evidencia dura.** El buscador de la base indexa dos cosas: `title` y `description`. Quedan
afuera las anotaciones, los comentarios, el checklist, el historial, las observaciones de arqueo y
los nombres de los adjuntos.

Y lo más revelador: `PROPUESTAS-MEJORA.md` P3 dice *"Estado: implementada"* y describe ampliar el
índice a *"announcements, **notes** y **vacaciones**"*. Los avisos entraron; notes y vacaciones
nunca entraron. **Hay un hueco que la documentación cree cerrado**, que es la peor clase de hueco.

**Qué mide.** Cuántas búsquedas terminan en nada, y —el dato que hoy no tiene nadie— **la lista de
lo más buscado que no aparece**. Se guarda sólo el texto, truncado, **sin autor, sin hora, sólo el
día**.

**Por qué no es vigilancia — y ésta es la que mejor pasa la prueba rigurosa.** La respuesta no es
un cartelito: **el dato no contiene a la persona**. No hay columna de autor. No está oculta ni
prometimos no mirarla: el registro es `(texto, día)` y no hay forma de reconstruir quién buscó qué.
**Una garantía que vive en el esquema es cualitativamente distinta de una que vive en una
promesa.**

**Cuidado obligatorio:** un cuadro de búsqueda puede tener un CUIT o el nombre de un cliente. Se
descarta cualquier cosa que parezca un número de más de 6 dígitos.

---

## 8. Por qué se volvió a hacer — *Muda: retrabajo*

**La evidencia.** `retrabajo.ts` cuenta reaperturas y las publica **incluido el desglose por
persona**. El encabezado dice que sirve *"para revisar el procedimiento y la capacitación"* — o
sea que el sistema **ya interpreta el número como señal de proceso**, pero no guarda ni un dato
sobre cuál proceso. Un encargado ve un nombre con "3 reaperturas" y nada más. Con esa información,
la única conclusión disponible es sobre la persona.

**Qué mide.** Al reabrir, una pregunta opcional de un toque: *llegó mal el dato*, *cambió un
criterio*, *faltaba información*, *se detectó un error al revisar*. Se agrega por causa y por
categoría. Marca en `history`, cero migración. Saltearla tiene que ser gratis.

**Cómo ayuda al empleado.** *"Cuando alguien mire que el IVA se reabrió tres veces, va a ver al
lado que el 60% de esas reaperturas fue porque el dato llegó mal de otra área. Hoy ese número está
solo y el único que puede explicarlo soy yo, en una reunión, de memoria."*

**Por qué no es vigilancia — el argumento más fuerte de las ocho.** La exposición por persona **ya
existe hoy**; esto no la agrega, le pone contexto. Un número desnudo sobre una persona es más
peligroso que el mismo número explicado. Con dos condiciones: la causa **nunca** se cruza con la
persona, y si algún día alguien pide "cuántos errores propios declaró cada uno", **ésa es la señal
de apagar la función entera**.

---

## Lo que propondría NO hacer

Ideas que suenan bien y que en este contexto empeoran el sistema.

1. **Un ICR por persona visible para el jefe.** Es el próximo pedido natural y va a sonar
   razonable. Con ICR nominal, la respuesta racional de cada uno es maximizarlo: marcar "En
   proceso" mecánicamente. El ICR sube, el dato no mejora, y **se pierde el único instrumento que
   quedaba para detectar registros de relleno**. Es Goodhart puro.
2. **Un contador de ideas por persona, o "la mejora del mes".** Destruye la propuesta 6 el día que
   lleve un número al lado de un nombre.
3. **Convertir "días de espera" en una meta de reducción del equipo.** La manera fácil de bajar la
   espera declarada es **dejar de declararla**.
4. **Notificar al encargado cuando alguien declara una espera, "para que pueda ayudar".** Suena a
   buen jefe y convierte la cuerda de andón en una escalada automática. En dos semanas nadie tira
   de la cuerda para no molestar.
5. **Cualquier vista de "quién hizo el ritual".** Quién cerró su día, quién revisó sus candidatos,
   quién contestó la retrospectiva. **Aplica a las ocho propuestas de este documento**: cada una es
   un espejo personal, y el día que exista una pantalla que muestre quién la usó, deja de ser
   espejo y pasa a ser control de asistencia con otro nombre.
6. **Encuesta de clima dentro del tablero.** Con 30 personas, un dato cortado por marca o sucursal
   deja de ser anónimo enseguida. Si se quiere saber cómo está el equipo, se pregunta caminando.
7. **Rachas o insignias visibles para los demás.** `tu-semana.ts` ya tiene una racha y está bien
   porque es privada. Hacerla pública es el ranking otra vez.
8. **Que la app archive o cierre tareas sola.** Un sistema que cierra trabajo por su cuenta
   **fabrica datos de cumplimiento falsos**. La app señala candidatos; decidir es siempre de una
   persona, con un click y con deshacer.
9. **Cronómetro.** No se reabre. Ya se evaluó y descartó dos veces con fundamento.

---

## Las preguntas que hay que hacerle al equipo

Todo lo de arriba sale de leer código. Esto sólo lo sabe quien hace el trabajo.

**Sobre la 1, que es la que decide si se hace:**

> *"Pensá en la última vez que una tarea tuya estuvo parada más de tres días esperando algo que no
> dependía de vos. ¿Qué esperabas exactamente, y a quién se lo habías pedido?"*

Y enseguida la que define si es viable:

> *"Si el tablero tuviera un botón para decir 'estoy esperando el extracto', ¿lo apretarías, o te
> daría cosa que quede escrito?"*

**Si la respuesta es "me daría cosa", la propuesta 1 no se construye** hasta entender por qué. Un
andón que la gente no se anima a usar es peor que ninguno: da la impresión de que no hay esperas.

**Sobre la 2, a dos personas por separado:**

> Al empleado: *"De las tareas que hacés todos los meses, ¿cuál pensás que no la mira nadie?"*
> Al jefe, sin contarle qué contestó: *"¿Quién usa el resultado de esa tarea, y para qué?"*

**La distancia entre las dos respuestas es el hallazgo**, y ninguna herramienta la puede calcular.

**Sobre la 5:**

> *"Cuando hacés la conciliación de IVA, ¿seguís una lista de pasos? ¿Está en papel, en la cabeza,
> en un Excel tuyo?"*

Si está en un Excel personal, la propuesta es casi gratis. Si está sólo en la cabeza, cuesta el
triple.

**Sobre la 6:**

> *"¿Alguna vez propusiste un cambio en cómo se hace algo acá? ¿Qué pasó? Y si nunca lo
> propusiste, ¿por qué no?"*

La tercera es la única que importa.

**Y una transversal, antes que todas las demás:**

> *"¿Hay algo que el tablero ya mide hoy que te incomode?"*

Preguntada así —sobre lo que ya existe, no sobre lo que vendría— es la única versión que consigue
una respuesta honesta. Y si aparece algo, **eso se arregla antes de agregar una sola función
nueva**: sumar medición encima de una desconfianza ya instalada es la forma exacta en que un
sistema de mejora continua se convierte en el sistema de control que todos dijeron que no iba a
ser.
