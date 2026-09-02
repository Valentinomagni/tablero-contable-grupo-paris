# Navegación mensual y herramientas contra fallos — Diseño

**Fecha:** 02/09/2026
**Estado:** aprobado en conversación, pendiente de revisión escrita

---

## El problema, en una frase del dueño

> *"uno debería poder desplazarse entre todos los meses para poder ver cómo cerró, qué cerró, qué
> faltó"*

Y la que explica por qué esto no es sólo una función que falta:

> *"ya llevamos casi 2 meses, no deberíamos tener fallos"*

El 2/9 tres personas del equipo creyeron que habían perdido el mes de agosto. No lo perdieron
—157 tareas y 119 terminadas están en `cards_archive`, verificado— pero el tablero se los mostró
vacío y todos llegaron a la misma conclusión.

Este documento cubre las dos mitades: **arreglar la navegación mensual**, y **cerrar las cuatro
clases de fallo que hoy no tienen ninguna defensa** y que produjeron éste y los anteriores.

---

# PARTE 1 — Las herramientas

## Por qué primero

Para arreglar los meses hay que saber cosas que hoy no se pueden ver: si `cards_archive` tiene
todos los meses o hay huecos, si hay filas de `card_periodos` que van a chocar con el archivo,
cuántas tareas tienen `reset_policy` distinto de mensual.

**Hacerlo a ciegas es exactamente cómo se produjo este bug.** Se arregló una dirección del
problema (el trabajo adelantado que desaparecía al llegar el mes, migraciones 51 y 56) sin poder
ver la dirección simétrica.

## Las cuatro clases de fallo sin defensa

Salen de los fallos reales de estos dos meses, no de categorías genéricas.

| Clase | Qué pasó de verdad | Defensa hoy |
|---|---|---|
| Migraciones sin probar | La 53 abortaba el reinicio mensual entero por chocar con la 51. La 40 se justificó con un comportamiento del front que no existía | ninguna |
| No poder ver la base | Seis pedidos de "corré esta consulta y decime". El 2/9, media hora de creer que se perdió un mes | ninguna |
| Buscar texto no ve lo indirecto | Tres fallos el 20/08: el guardián no vio `Board.tsx` (escribe `{ status }`), un agente no vio `volcar_periodo_a_cards` (escribe `p.status`), y el catálogo no vio los acentos | ninguna |
| Error en producción sin testigo | El 400 de `COLUMNAS_CARDS` corrió un día entero antes de que alguien lo notara | ninguna |

## El hallazgo estructural

**Las migraciones van del editor de texto a la base de producción sin nada en el medio.**

Todos los fallos caros tienen esa forma. No falta una herramienta de lectura: falta **un lugar
donde una migración pueda fallar sin consecuencias**.

Y no requiere Docker ni permisos de administrador: **un segundo proyecto de Supabase, en el plan
gratuito, como banco de pruebas.** Mismo Postgres, mismo motor de RLS, en la nube.

## H1 — Banco de pruebas (segundo proyecto Supabase)

**Qué es.** Un proyecto Supabase aparte, vacío, donde se corren las migraciones antes de
producción, con datos de mentira.

**Qué cambia.** El entregable de una migración deja de ser "corré esto y decime qué pasó" y pasa
a ser "esto ya corrió en el banco de pruebas, acá está la salida de las comprobaciones".

**Lo que cuesta, dicho de frente.** Toda migración se corre dos veces. **Si se saltea, es peor que
no tenerlo**, porque genera confianza en una verificación que no ocurrió — que es exactamente el
problema del cron que fallaba callado.

**Criterio de descarte:** si a los dos meses hay migraciones que fueron a producción sin pasar por
el banco, la disciplina no existe y hay que dejar de fingir que sí.

## H2 — MCP de Supabase

**Configuración:** `@supabase/mcp-server-supabase` (v0.11.0, verificado en npm), por `npx`. Es un
proceso hijo por entrada/salida estándar: **no abre puertos y no dispara el aviso del firewall**,
que es la restricción real de esta máquina.

**Dos conexiones, con permisos distintos:**

- **Banco de pruebas: lectura y escritura.** Ahí se puede romper.
- **Producción: SÓLO LECTURA** (`--read-only`). Escribir en producción sigue siendo del dueño.

**Por qué producción en sólo lectura y no es exceso de cautela:** este proyecto ya destruyó el
archivo de un mes con una función mal escrita. La lectura resuelve el 100% de los casos donde hoy
hay que pedir una consulta; la escritura no agrega nada que valga ese riesgo.

**Criterio de descarte:** si al mes no se usó para verificar nada, sale.

## H3 — codegraph como MCP

**Ya está instalado** (v1.5.0, en el PATH). Se conecta con `codegraph install`.

**Por qué, y por qué mi evaluación anterior estaba mal.** Lo descarté juzgándolo como buscador
—"navegar más rápido no arregla el problema"— y eso era cierto pero irrelevante. Tiene
`impact <símbolo>`, `callers`, `callees` y `affected`: **es análisis de impacto**, que es
exactamente la pregunta que falló tres veces el 20/08.

Las tres fallas tienen la misma forma: *cambié algo y no vi quién dependía de eso*. `impact` es
literalmente esa pregunta.

**Regla de uso:** antes de tocar una función que escribe en `cards` o una migración que redefine
otra, se corre `impact`. No es opcional — es el reemplazo de las búsquedas de texto que ya
demostraron ser ciegas.

**Criterio de descarte:** si en dos meses no encontró nada que un `grep` no hubiera encontrado,
sale.

## H4 — Sentry y su MCP

**Qué cierra.** El dolor de que *el equipo se entere antes que el dueño*. El 400 de ayer corrió un
día en producción sin que nadie supiera.

**La objeción que hay que resolver ANTES de instalarlo, y es del dueño y no mía:** Sentry manda
datos a un tercero, y esta app tiene información contable de una empresa real. Un mensaje de error
puede arrastrar el título de una tarea, un monto o un CUIT.

**Condición para que entre:** filtrado de datos sensibles configurado y verificado con un error de
prueba, **antes** de conectarlo a producción. Si eso no se hace, no entra.

**Criterio de descarte:** si a los dos meses no avisó de nada antes que una persona, sale.

## H5 — Dos skills de ECC, en el proyecto correcto

De las 286 skills de ECC hay **dos** que aplican:

- **`postgres-patterns`** — basada en buenas prácticas de Supabase, cubre RLS.
- **`database-migrations`** — cubre rollbacks y despliegue sin caída.

Las dos habrían ayudado con el choque de la 53 contra la 51.

**El hallazgo que importa más que las skills en sí:** las 8 skills que ya están instaladas
—incluida `safety-guard`, descrita como *"prevenir operaciones destructivas en sistemas de
producción"*— viven en `AUTOMATIZACION TRABAJO`. El tablero, que es donde se corren migraciones
contra producción, **no las tiene**. Es un problema de cableado, no de criterio.

Entran esas dos, más `safety-guard` y `verification-loop`, copiadas a
`tablero-contable-v2/.claude/skills/`.

**Las otras 284 no entran.** Este proyecto ya llegó a 75 documentos sin saber cuáles decían la
verdad; un catálogo de 286 skills tiene el mismo modo de falla.

---

# PARTE 2 — La navegación mensual

## La causa, en una función

`cardsDelPeriodo` (`src/lib/periodo-instancias.ts:117`) tiene **dos** casos:

```
mes vigente     → tarjetas crudas
cualquier otro  → fila de card_periodos; si no hay → instanciaEnBlanco
```

"Cualquier otro" mete en la misma bolsa el mes que viene y el mes pasado, **y son opuestos**. Para
un mes futuro, en blanco es correcto: no pasó nada todavía. Para un mes pasado es una mentira:
pasó todo.

Y agosto **no puede** tener filas en `card_periodos`: durante agosto, agosto era el vigente, así
que todo se guardó en `cards`. Esas filas sólo las escribe quien adelanta un mes futuro.

## El diseño: tres casos

| Mes | Fuente | Cambia |
|---|---|---|
| **Vigente** | `cards` crudas | no |
| **Futuro** | fila de `card_periodos`; si no hay → `instanciaEnBlanco` | no |
| **Pasado** | **foto de `cards_archive`**, con `card_periodos` encima como corrección | **sí, es lo nuevo** |

### La regla de precedencia, y por qué es necesaria

Para un mes pasado:

1. **Base:** la foto de `cards_archive` de ese mes. Es lo que pasó.
2. **Encima:** la fila de `card_periodos` de ese mes **sin `aplicado_at`**, si existe. Es una
   corrección hecha después.
3. **Si no hay foto:** NO se cae en `instanciaEnBlanco`. Ver "Cuando no se sabe".

Las filas con `aplicado_at` se siguen ignorando (migraciones 51 y 56): ésas ya se volcaron sobre
`cards` y volver a leerlas taparía el trabajo real.

Sin la regla de precedencia, corregir agosto dos meses después no se vería.

## Un efecto que no estaba a la vista y es la mitad del pedido

Hoy, mirar agosto recorre las `cards` **de hoy** y las dibuja en blanco. O sea:

- una tarea creada en septiembre **aparece** en la vista de agosto,
- una que existió en agosto y se borró después **no aparece**.

Leyendo el archivo, agosto muestra **las tareas que agosto tuvo**. Eso es literalmente "qué cerró,
qué faltó", y hoy no existe.

## Reabrir una tarea dos meses después

El mecanismo de escritura **ya existe**: `escribeEnPeriodo` (`periodo-escritura.ts:51`) manda a
`card_periodos` todo lo que se escribe en un mes que no es el vigente.

Nunca sirvió porque la lectura devolvía blanco: se corregía sobre una ficción.

Con la lectura arreglada, el flujo queda: **reabrir el mes → corregir la tarea → volver a
cerrarlo**. Los dos botones existen (`useReabrirMes`, `useCerrarMes`) y queda asentado.

## Las tareas que no siguen el ciclo mensual

Del reporte: *"estoy haciendo una evaluación de un pasivo hace 2 meses: debería aparecer como
creada el día que se inicia e ir completándose"*.

**La mitad ya funciona y conviene saberlo:** la base no las reinicia, porque el reinicio filtra por
`coalesce(reset_policy,'mensual') = 'mensual'` y una tarea de una sola vez se guarda con
`'manual'`.

**La otra mitad es el mismo bug:** `instanciaEnBlanco` sólo respeta `reset_policy === "mantener"`,
no `"manual"`. Así que se ve bien en el mes en curso y en blanco en cualquier otro.

No hace falta un mecanismo nuevo. Leer el archivo lo resuelve: la foto de julio tiene su estado
real de julio, y `created_at` viaja dentro de la foto.

## Los comentarios: el problema opuesto

Del reporte: *"si yo puse en el banco de agosto 'cerrado con salvedad, revisar X movimiento', no
debería arrastrarse mes a mes, debería quedar como constancia del mes"*.

El reinicio toca `status`, `done_at`, `proc_at`, `checklist` e `history`. **No toca `comments`.**

**El arreglo:** limpiar `comments` en el reinicio, **después** de insertar la foto en
`cards_archive`. El orden no es negociable: al revés, la constancia se pierde de verdad.

**El riesgo, explícito:** es destructivo. Por eso **no se toca hasta tener el banco de pruebas
andando** — es la misma clase de cambio que destruyó el archivo de un mes.

**Un borde conocido:** el archivado usa `on conflict do nothing`. Si un mes ya estaba archivado y
después se escribieron comentarios, esos comentarios no entran en la foto y se pierden al limpiar.
Es angosto y queda anotado, no resuelto.

## Cuando no se sabe: la regla que cierra el agujero de fondo

**El bug de agosto no fue que el código estuviera mal. Fue que una falla se dibujó como un dato
con confianza:** cero terminadas, prolijo, creíble.

Y hay un agravante que hace falta arreglar de paso: **`useArchive` y `useArchiveEquipo` devuelven
`[]` ante cualquier error.** Si la lectura nueva se apoya en eso, se reconstruye exactamente el
mismo bug con otra fuente.

Entonces, tres estados distintos y visiblemente distintos:

| Estado | Qué se muestra |
|---|---|
| El mes tiene foto | Las tareas de ese mes |
| El mes existe y no tiene foto | El mensaje *"Este mes no quedó archivado"* y **ninguna tarjeta**. No se dibujan tareas en blanco: mostrarlas sería inventar un mes que nadie guardó |
| La consulta falló | El mensaje *"No se pudo cargar este mes"* y **ninguna tarjeta**, con la opción de reintentar |

**"No sé" tiene que verse distinto de "no había nada", y hoy se ven igual.**

Y una consecuencia que hay que aceptar: los meses anteriores a que existiera `cards_archive` van a
decir "no quedó archivado". Es incómodo y es correcto — la alternativa es que el tablero invente
un mes que nadie guardó, que es justo lo que pasó en agosto.

## Cómo se lee, en concreto

`useArchive(ownerId)` trae **todos** los meses sin filtro y se traga los errores. Para el tablero
hace falta otra cosa:

- **Hook nuevo `useArchiveMes(ownerId, mes)`**: filtra por mes en el servidor y **distingue
  error de vacío** (devuelve el estado, no `[]`).
- La decisión de qué mostrar vive en una **función pura nueva en `periodo-instancias.ts`**, con
  tests, no repartida en la pantalla.

`HistorialMes` sigue leyendo el archivo como hoy; la lógica de resolución es la misma función para
que las dos pantallas no puedan discrepar sobre el mismo mes.

---

# Lo que este diseño NO hace

- **No mergea `card_periodos` sobre el mes vigente.** Ya analizado el 05/08: mostraría el estado
  adelantado por encima del trabajo real, para siempre.
- **No copia el estado del mes anterior al mes nuevo.** Es lo que evita `instanciaEnBlanco` y por
  eso existe.
- **No entran las reglas de diseño de Vercel ni frontend-design.** El proyecto tiene un sistema
  visual propio con dos guardianes que hacen fallar los tests; una segunda autoridad de diseño
  crea dos verdades, y este proyecto ya se lastimó tres veces por tener un criterio en dos
  lugares. Se revisa si el reclamo pasa a ser que las pantallas se ven mal.
- **No entra el MCP de Airtable ni Sheets.** En el tablero no hay planillas que conectar. Puede
  tener sentido en `ESTUDIO CONTABLE MAGNI`, que es otro proyecto y otro spec.
- **No entra el navegador agente.** Ya hay Playwright con specs de accesibilidad en CI.
- **No se parten `Admin.tsx` (713 líneas) ni `Board.tsx` (611).** Es deuda real y anotada, pero no
  sirve a este objetivo.

---

# Lo que depende del dueño, y bloquea

Sin estas dos cosas la Parte 1 no existe y la Parte 2 se hace a ciegas otra vez:

1. **Crear el segundo proyecto de Supabase** (plan gratuito) y pasar su URL y su clave.
2. **Generar un token de acceso personal de Supabase** para el MCP.

Son cinco minutos. **Hasta que existan, sigo trabajando exactamente como ayer.**

Y una decisión, no una tarea:

3. **Sentry: sí o no**, sabiendo que manda datos a un tercero y que acá hay información contable.

---

# Cómo se verifica que esto funcionó

No por "está implementado". Tres comprobaciones concretas:

1. **Abrir agosto y ver 157 tareas con 119 terminadas** — los mismos números que devuelve la
   consulta al archivo. Si no coinciden, está mal.
2. **Reabrir una tarea de julio, corregirla, cerrar el mes, y volver a abrir julio**: la
   corrección tiene que seguir ahí.
3. **Cortar la red y abrir un mes pasado**: tiene que decir que no se pudo cargar, **no** mostrar
   cero tareas.

La tercera es la que más importa, porque es la que falló en agosto.

---

# Orden

1. **H1 + H2** (banco de pruebas y MCP) — sin esto, todo lo demás es a ciegas.
2. **H3 + H5** (codegraph y las skills) — baratos, y H3 se usa en el paso siguiente.
3. **Parte 2, lectura de meses pasados** — verificada en el banco de pruebas.
4. **Parte 2, limpieza de comentarios** — última, porque es la única destructiva.
5. **H4 (Sentry)** — cuando esté decidido lo del filtrado.
