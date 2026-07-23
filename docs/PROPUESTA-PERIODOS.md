# Propuesta: modelo de períodos y ejecuciones independientes

> **Estado: GATE de decisión.** Este documento NO implementa nada. Describe el
> problema, tres alternativas de modelo de datos y una recomendación, para que
> vos decidas si se implementa y en qué orden. Nada de acá tocó la base ni la app.
>
> Spec de origen: `28-correcciones`, items **8** (períodos por empleado) y **2**
> (recurrencia diaria que pisa el checklist). Los dos problemas tienen **la misma
> raíz técnica**, por eso van juntos en una sola propuesta.

---

## 0. Para qué es esto (el problema del negocio, en una línea)

En contabilidad conviven **varios meses abiertos a la vez**: se cierra junio cuando
junio realmente terminó, mientras ya se adelanta trabajo de julio y agosto. Hoy el
tablero no sabe representar eso: hay **una** tarea con **un** estado, y cuando llega
el mes nuevo ese estado se reinicia y se pierde la foto de lo que se hizo. El
resultado práctico es que **no se puede mostrar el trabajo adelantado**: el empleado
avanza tareas del mes siguiente y el sistema no tiene dónde guardarlo como algo
distinto del mes actual.

Este documento resuelve exactamente eso: que cada período (junio / julio / agosto)
tenga su propio tablero, con sus tareas, su checklist, sus estados y su evidencia,
**independientes**, sin pisarse.

---

## 1. Diagnóstico: por qué HOY se pisan los datos

### 1.1 El modelo actual, dibujado

La entidad central es `cards` (`src/lib/types.ts`, interface `Card`). Una card es
**mutable y única**: tiene UN `status`, UN `checklist`, UN `history`, UN `done_at`.

```
                    ┌──────────────────────────────────────────┐
   cards (fila)     │ id, owner, title                          │
   una por tarea    │ status:  pend | proc | term   ← MUTABLE   │
                    │ checklist: [{txt, done, done_at}] ← MUTABLE│
                    │ history: [...]                             │
                    │ done_at, due_date, recur_rule, ...        │
                    └──────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼───────────────────────────┐
              ▼                     ▼                            ▼
   task_occurrences        cards_archive                cierre_periodos
   (una por fecha)         (una por mes)                (una por owner+mes)
   ─────────────────       ─────────────────            ─────────────────
   card_id, fecha          owner, mes, card(jsonb)      owner, mes, cerrado_at
   done, done_at           snapshot INMUTABLE           marca "cerré mi mes"
   resultado, dif_importe  del mes archivado            (Fase A, ya en prod)
   (arqueo, migr. 16/23)   (migr. 22)                   (migr. 29)
   INMUTABLE por fecha
```

Hay que notar una asimetría que es la clave de todo:

- **La ejecución diaria YA está bien modelada.** `task_occurrences` guarda una fila
  por `(card_id, fecha)` con su propio `done`, `resultado`, `dif_importe`, `dif_obs`.
  Cada día es una instancia independiente e inmutable. El arqueo de caja funciona así
  y no pierde historial (ver `CumplimientoDiario.tsx` y `recurrencia.ts`).

- **El estado "de trabajo" de la card (status + checklist + observaciones) NO está
  instanciado.** Vive en la propia fila `cards`, es único y se muta en el lugar.

### 1.2 Dónde exactamente se pisan los datos

**Caso item 2 — recurrencia diaria pisa el checklist.**
El `done` diario sí se guarda por fecha en `task_occurrences`. Pero el **checklist**,
las **observaciones** y la **evidencia** NO: viven en `cards.checklist` /
`cards.comments`. Una tarea recurrente diaria tiene UN solo checklist compartido por
todas las fechas. Cuando el reset mensual (o el reinicio de la recurrente) destilda el
checklist, **se pierde el detalle de las ejecuciones anteriores**. La grilla de
cumplimiento diario sobrevive (es `task_occurrences`), pero "qué ítems del checklist
tildé el 3 de junio" no existe: sólo existe "el checklist actual".

**Caso item 8 — el cambio de mes reinicia el estado.**
`migracion-24-reset-recurrentes-seguro.sql`, la función `reset_recurrentes_seguro()`,
hace exactamente esto cada día 1:

1. Archiva un snapshot jsonb del mes que cierra en `cards_archive` (bien: evidencia
   inmutable).
2. **Muta** las cards con `reset_policy='mensual'`: `status='pend'`, `done_at=null`,
   destilda el checklist entero, agrega una línea al history.

O sea: la MISMA fila `cards` sirve para junio y para julio. En junio estaba en `term`
con el checklist completo; el día 1 de julio esa misma fila vuelve a `pend` con el
checklist en blanco. **Junio "vivo" ya no existe** — sólo queda su foto jsonb en
`cards_archive`, que es de **sólo lectura** (no es un tablero operable, es un snapshot).

Consecuencia directa sobre el pedido del usuario:

- **No se puede adelantar julio mientras junio sigue vivo**, porque junio y julio son
  la misma fila. Si toco la card para adelantar julio, piso junio. Si dejo junio como
  está, no puedo empezar julio.
- **No se puede "cerrar un período cuando realmente finalizó"** a nivel de datos: el
  cierre por persona (`cierre_periodos`, Fase A) es sólo una **marca declarativa**
  ("yo digo que cerré mi junio"); no congela ni separa las tareas de junio de las de
  julio. Es un post-it, no un archivador.

### 1.3 La raíz común

Los dos items son el mismo problema: **hoy hay UNA card con UN estado mutable, y
tanto la recurrencia diaria como los períodos mensuales necesitan INSTANCIAS
INDEPENDIENTES.** La diferencia es sólo el eje de la instancia:

| Item | Eje de la instancia | ¿Ya instanciado hoy? |
|------|---------------------|----------------------|
| 2 (recurrencia diaria) | por **fecha** | `done`/arqueo sí; checklist/obs/evidencia **no** |
| 8 (períodos mensuales) | por **mes (owner+período)** | **no**, la card es única |

Cualquier solución honesta tiene que **mover el estado de trabajo (status +
checklist + observaciones + evidencia + tiempos) desde la card única hacia una tabla
de instancias** — o por fecha, o por período, o ambas.

---

## 2. Alternativas de modelo de datos

Tres caminos, ordenados de menos a más ambicioso. Para cada uno: cómo guarda cada
período/ejecución lo suyo, qué migración implica, cómo conviven varios meses
abiertos, cómo se cierra un período, impacto en las métricas existentes
(`analizarMes`, `comparador`, `curvaPersona`/evolución, cumplimiento diario) y en
`cards_archive` / `cierre_periodos`, y su ventaja/desventaja/esfuerzo/riesgo.

### Alternativa A — Instancia de ejecución por período (tabla `card_periodos`)

**Idea.** La `cards` deja de ser "la tarea de este mes" y pasa a ser la **plantilla /
definición** de la tarea (título, dueño, recurrencia, prioridad, esfuerzo, deps,
categoría — lo que NO cambia mes a mes). El **estado de trabajo** de cada mes se muda
a una tabla nueva de instancias:

```
cards (definición estable)                card_periodos (estado por mes)
────────────────────────────             ───────────────────────────────────
id, owner, title, recur_rule,   1 ─── N  id, card_id, owner, periodo 'YYYY-MM'
priority, effort, deps,                   status: pend|proc|term
categoria, protected, ...                 checklist jsonb
                                          comments jsonb, history jsonb
                                          done_at, proc_at, due_date
                                          unique(card_id, periodo)
```

- **Cómo guarda cada período lo suyo:** una fila por `(card_id, periodo)`. Junio y
  julio de la misma tarea son dos filas distintas: distinto status, distinto
  checklist, distinta evidencia. Nunca se pisan (garantizado por el `unique`).
- **Cómo conviven varios meses abiertos:** el board de una persona, en vez de leer
  `cards where owner=X`, lee `card_periodos where owner=X and periodo=<seleccionado>`,
  uniendo con `cards` para los datos estables. El selector del perfil (junio/julio/
  agosto) cambia el `periodo` y listo: son datasets distintos.
- **Cómo se cierra un período:** sigue siendo `cierre_periodos` (Fase A, sin cambios),
  pero ahora SÍ tiene sentido pleno: cerrar junio marca la fila y, opcionalmente, pone
  las `card_periodos` de junio en modo lectura. Junio queda intacto para siempre.
- **Recurrencia diaria (item 2):** el checklist/observaciones por ejecución diaria
  migran a `task_occurrences` (ver 2.bis abajo) — se resuelve en el mismo movimiento
  conceptual, pero es una tabla aparte (fecha, no mes).
- **Migración:** tabla nueva `card_periodos` + backfill (crear la fila del período
  vigente para cada card actual, copiando su status/checklist/history actuales) +
  RLS analogo al de `task_occurrences`. El reset mensual (migr. 24) se **jubila**: ya
  no muta la card; el "reinicio" pasa a ser, simplemente, "el mes siguiente todavía no
  tiene fila y se crea en blanco al abrirlo/materializarlo".
- **Impacto en métricas:**
  - `cumplimiento diario`: sin cambios (ya lee `task_occurrences`).
  - `analizarMes` (mes en curso): hoy lee `cards where status` vivas. Debe pasar a
    leer `card_periodos where periodo=<mes>`. Cambio localizado pero real.
  - `comparador` / `curvaPersona` / evolución: hoy leen `cards_archive` (snapshots).
    **No se rompen**: se sigue archivando. Es más: el snapshot mensual pasa a ser
    trivial y exacto (es la foto de las `card_periodos` de ese mes, ya no una foto de
    una card mutante en el instante del cron).
  - `cards_archive`: se mantiene como capa histórica de sólo lectura (meses muy
    viejos fuera de la ventana de 6 meses). Se puede incluso derivar de `card_periodos`.
- **Ventajas:** modelo correcto y explícito; el snapshot deja de depender del timing
  del cron; el cierre por persona cobra sentido real; escala bien (una fila por card ×
  mes con trabajo, no por card × día).
- **Desventajas / esfuerzo:** es el cambio más grande. Toca el corazón: cómo el Board,
  el CardModal, el resumen y varias métricas leen "las cards del mes". Hay que tocar
  las queries de lectura/escritura del estado de trabajo. **Esfuerzo alto, riesgo de
  regresión medio-alto** si se hace de una. Se mitiga con las fases de la sección 4.
- **Almacenamiento:** barato. `card_periodos` crece ~= (cards no operativas) × (meses
  con trabajo). Para un equipo de ~30 personas es del orden de miles de filas por año,
  no millones. **No** es duplicar cards ciegamente: la definición estable vive una sola
  vez en `cards`.

### Alternativa B — Todo por ocurrencia (colapsar en `task_occurrences` extendida)

**Idea.** No agregar `card_periodos`; en cambio, **enriquecer `task_occurrences`**
para que sea la única tabla de ejecuciones, tanto diarias como mensuales, agregándole
`checklist`, `comments`, `status` y `evidencia`. Una tarea mensual sería una ocurrencia
con `fecha = primer día del mes`; una diaria, una ocurrencia por día.

- **Cómo guarda cada período/ejecución lo suyo:** una fila por ocurrencia, con su
  propio checklist/estado/evidencia. Resuelve item 2 e item 8 con **una sola** tabla.
- **Cómo conviven varios meses abiertos:** el board lee `task_occurrences` filtrando
  por rango de fechas del mes seleccionado.
- **Cierre de período:** `cierre_periodos` igual; el período es el mes de la `fecha`.
- **Migración:** extender `task_occurrences` con columnas jsonb + backfill. Menos
  tablas nuevas que A.
- **Impacto en métricas:** más disruptivo de lo que parece. `analizarMes`,
  `comparador`, `curvaPersona` hoy razonan sobre **cards** (status por card). Habría
  que reescribirlas para razonar sobre ocurrencias, y reconciliar el doble sentido de
  `task_occurrences` (hoy "hice el arqueo del día" vs. nuevo "estado de trabajo de la
  tarea mensual"). El `resultado/dif_importe` del arqueo y un `status` de tarea mensual
  conviviendo en la misma fila es semánticamente turbio.
- **Ventajas:** una sola tabla de ejecuciones, conceptualmente unificado.
- **Desventajas / esfuerzo:** **mezcla dos ejes distintos** (día y mes) en una tabla
  cuya identidad es `(card_id, fecha)`. Una tarea NO recurrente "de junio" no tiene una
  fecha natural — habría que inventar una convención frágil (fecha = día 1). Rompe la
  claridad que hoy tiene `task_occurrences` (arqueo). **Riesgo de regresión alto** en
  todo lo que ya usa esa tabla. Esfuerzo medio-alto y deuda conceptual.

### Alternativa C — Híbrido pragmático (recomendada): `card_periodos` para el mes + `task_occurrences` para el día

**Idea.** Cada eje con su tabla, cada una haciendo lo que ya sabe hacer:

- **Eje día (item 2):** el checklist/observaciones/evidencia por ejecución diaria van
  a `task_occurrences` (extender la tabla que YA existe y YA es inmutable por fecha con
  columnas `checklist jsonb`, `obs text`, `evidencia`). Cambio chico y contenido: la
  grilla de cumplimiento diario ya opera fila por fecha.
- **Eje mes (item 8):** el estado de trabajo mensual (status + checklist + comments +
  history + tiempos) va a `card_periodos` como en la Alternativa A.
- **`cards`** queda como definición estable. **`cards_archive`** y **`cierre_periodos`**
  se mantienen tal cual.

- **Cómo conviven varios meses abiertos:** igual que A — el selector del perfil cambia
  el `periodo` y el board lee las `card_periodos` de ese mes.
- **Cierre de período:** `cierre_periodos` sin cambios; opcionalmente congela las
  `card_periodos` de ese mes a lectura.
- **Impacto en métricas:** el mismo de A para lo mensual; lo diario no toca las
  métricas mensuales (sólo el panel de cumplimiento diario, que gana el checklist por
  día sin perder nada).
- **Ventajas:** cada eje modelado donde corresponde, sin forzar una tabla a hacer dos
  trabajos (evita el problema semántico de B); reutiliza `task_occurrences` para lo
  diario (ya inmutable) y agrega `card_periodos` sólo para lo mensual. Es A + la parte
  buena de B, sin la mezcla.
- **Desventajas / esfuerzo:** dos migraciones en vez de una; hay que tener claro qué
  tarea es "mensual" (usa `card_periodos`) y cuál es "diaria/recurrente por fecha" (usa
  `task_occurrences`). En la práctica ya está separado: las recurrentes diarias ya
  viven en `task_occurrences`. **Esfuerzo medio, riesgo controlable** porque se puede
  entregar por partes (sección 4).

### Comparación rápida

| Criterio | A (`card_periodos`) | B (occurrences todo) | C (híbrido) |
|---|---|---|---|
| Resuelve item 8 (meses en paralelo) | Sí | Sí | Sí |
| Resuelve item 2 (checklist diario) | Con tabla aparte | Sí | Sí |
| Claridad conceptual | Alta | Baja (mezcla ejes) | Alta |
| Reusa lo que ya funciona | Parcial | Fuerza reescritura | **Máximo** |
| Riesgo de regresión | Medio-alto | Alto | **Medio, por fases** |
| Esfuerzo total | Alto | Medio-alto | Medio |
| Almacenamiento | Bajo | Bajo | Bajo |

---

## 3. Recomendación

**Recomiendo la Alternativa C (híbrido).** Es la que respeta lo que ya está bien hecho
(`task_occurrences` inmutable por fecha, `cards_archive`, el cierre por persona de la
Fase A) y agrega **sólo** la pieza que falta: instancias de tarea por período mensual
(`card_periodos`). Evita el error de B de meter mes y día en la misma tabla, y evita el
riesgo de hacer todo el cambio de A de un saque, porque se puede entregar por fases.

En una línea: **la card pasa a ser la definición de la tarea; el estado de cada mes vive
en su propia fila.** Nunca más un mes pisa a otro, porque nunca más comparten fila.

### Qué vería el empleado en pantalla

**Selector de período en el PERFIL (no en el calendario).** En la cabecera del perfil
del empleado, un selector tipo pill igual al de meses del calendario:

```
   Perfil de Valentino          [ ‹  Junio 2026 │ Julio 2026 │ Agosto 2026  › ]
   ────────────────────────────────────────────────────────────────────────────
   Pendiente        En proceso        Terminado
   ┌───────────┐    ┌───────────┐     ┌───────────┐
   │ IVA junio │    │ Concil.   │     │ Sueldos   │   ← tablero de JUNIO
   └───────────┘    └───────────┘     └───────────┘
```

- Elige **Junio** → ve el tablero de junio: sus tareas de junio con su checklist, sus
  estados, sus observaciones y su evidencia. Elige **Julio** → otro tablero, otras
  filas, sin ninguna relación con junio.
- **Adelantar trabajo del mes que viene:** cambia el selector a Agosto y empieza a
  tildar checklist / mover tarjetas a "en proceso". Eso queda guardado en las
  `card_periodos` de agosto. Junio y julio no se enteran. **Y ahora el jefe lo ve**:
  el resumen puede mostrar "avance de agosto: 20%" cuando agosto todavía ni empezó —
  que es exactamente la prueba de trabajo adelantado que hoy no existe.
- **Consultar meses cerrados en modo lectura:** los meses con fila en `cierre_periodos`
  se muestran con un candado; el tablero de ese mes se ve completo pero no editable
  (salvo reabrir, que ya existe). El historial deja de ser una foto jpg y pasa a ser un
  tablero real que se puede recorrer.
- **Recurrencia diaria (item 2):** al abrir una tarea diaria (ej. arqueo), la grilla de
  cumplimiento sigue mostrando el mes; al tocar un día, además del `done`/resultado de
  hoy, se puede ver/editar el checklist **de ese día**, sin que se pierda el de los días
  anteriores.

---

## 4. Plan de implementación por fases (bajo riesgo, entregable temprano)

El orden está pensado para que **lo primero que se entregue ya le sirva al usuario para
mostrarle algo a su jefe**, y para que cada fase sea reversible y testeada antes de la
siguiente. Nada de esto se ejecuta hasta que aprobes.

**Fase 0 — Fundaciones de datos (sin UI visible).**
- Migración `card_periodos` (tabla + `unique(card_id, periodo)` + RLS calcado de
  `task_occurrences`, usando los helpers `es_jefe()` / `es_encargado_de()`).
- Backfill idempotente: por cada card no operativa, crear la `card_periodos` del mes
  vigente copiando su `status`/`checklist`/`history`/`done_at` actuales. Doble corrida
  no duplica (on conflict do nothing).
- Lib pura nueva `periodo-instancias.ts` con helpers de lectura (merge card+período) y
  sus tests. **Entregable:** nada visible, pero la base ya tiene el modelo y está
  cubierto por tests. Riesgo casi nulo (tabla nueva, no toca `cards`).

**Fase 1 — Selector de período en el perfil, en modo LECTURA (primer entregable
demostrable). ← esto es lo que le muestra al jefe rápido.**
- El selector Junio/Julio/Agosto en la cabecera del perfil, cambiando el `periodo`.
- El Board lee `card_periodos` del período elegido (con fallback a `cards` si un período
  no tiene filas todavía, para no romper nada).
- Todavía sin edición separada: al principio el mes vigente escribe donde escribía
  siempre. **Pero ya se ve** que junio, julio y agosto son tableros distintos y que hay
  trabajo cargado en el mes que viene. Con esto el usuario ya puede pararse frente al
  jefe y mostrar "mirá, esto es lo que adelanté de agosto".

**Fase 2 — Escritura por período (el estado de cada mes es de verdad independiente).**
- El status/checklist/comments/history se escriben en la `card_periodos` del período
  activo, no en `cards`.
- Jubilar el reset mutante de `migracion-24`: el "reinicio mensual" pasa a ser "el mes
  nuevo arranca sin fila y se crea en blanco". El archivo de `cards_archive` se deriva
  de `card_periodos` (más exacto que hoy).
- Migrar `analizarMes` y el resumen a leer `card_periodos` del mes en curso.

**Fase 3 — Cierre real + modo lectura de meses cerrados.**
- Conectar `cierre_periodos` (Fase A) con `card_periodos`: cerrar un mes lo congela a
  lectura; reabrir lo libera. El candado en el selector.

**Fase 4 — Item 2: checklist/observaciones/evidencia por día.**
- Extender `task_occurrences` con `checklist`/`obs`/`evidencia` y exponerlo en la grilla
  de cumplimiento diario. Independiente de las fases anteriores: se puede hacer antes o
  después, no bloquea. (Si el usuario prioriza el arqueo, se puede adelantar.)

Cada fase: una migración idempotente + libs puras con tests + un pedazo de UI, en ese
orden, verificando la preview de la rama `dev` antes de pasar a la siguiente.

---

## 5. Compatibilidad: cómo NO romper lo que ya funciona

- **Cierre por persona (Fase A, `cierre_periodos`):** intacto. Gana sentido: hoy es una
  marca declarativa; con `card_periodos` pasa a congelar datos reales. No cambia su API.
- **Arqueo diario (`task_occurrences`, resultado/dif_importe):** intacto en las fases
  0–3. La Fase 4 sólo **agrega** columnas jsonb; el `done`/`resultado` de hoy sigue
  igual. Sin migración destructiva.
- **Historial mensual (`cards_archive`):** se mantiene. Deja de depender del timing del
  cron (hoy fotografía una card mutante en el instante que corre; con `card_periodos` la
  foto del mes ya existe como datos, no hay ventana de carrera).
- **Métricas (`analizarMes`, `comparador`, `curvaPersona`, cumplimiento diario):** las
  históricas (comparador/evolución) siguen leyendo `cards_archive` sin cambios; sólo la
  del mes en curso (`analizarMes`) se repunta a `card_periodos` en la Fase 2, con tests
  de regresión que comparen resultado viejo vs. nuevo sobre los mismos datos.
- **RLS:** `card_periodos` copia las policies de `task_occurrences` (propio / encargado
  de / jefe), con los helpers SECURITY DEFINER — **nunca** subconsulta directa a
  `profiles` (regla dura del proyecto, evita el 42P17).
- **Bases sin migrar / defensivo:** mismo patrón que el resto del proyecto — si
  `card_periodos` no existe todavía, la lectura cae a `cards` y la app funciona como
  hoy. Se puede desplegar la UI antes que todos corran la migración.
- **`reset_policy` ('mensual' / 'mantener' / 'manual'):** se respeta. En el nuevo modelo
  determina si al abrir el mes nuevo la `card_periodos` arranca en blanco ('mensual') o
  copiando el estado del mes anterior ('mantener').

---

## 6. Lo que NO recomiendo (y por qué)

- **Duplicar cards por mes ciegamente** (una fila `cards` completa por tarea × mes): infla
  la tabla que TODO el sistema consulta, rompe las deps (que apuntan a `card.id`), y
  obliga a filtrar por mes en cada query de cards. Es la solución que parece fácil y
  sale cara. `card_periodos` da lo mismo separando definición de estado, sin ese costo.
- **Alternativa B (todo en `task_occurrences`)**: tentadora por usar una sola tabla, pero
  mezclar el eje día con el eje mes ensucia la tabla del arqueo y obliga a reescribir las
  métricas. El ahorro de una tabla no compensa la deuda conceptual.

---

*Documento de decisión. Si aprobás, la implementación arranca por la Fase 0 y la Fase 1
(selector en lectura) como primer entregable demostrable.*
