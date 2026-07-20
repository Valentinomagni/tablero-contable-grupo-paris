# Propuesta: rediseño del "cierre de mes"

**Para:** jefatura del equipo contable
**De:** equipo de producto del tablero
**Fecha:** 20/07/2026
**Qué es esto:** una propuesta para leer y decidir. **No cambiamos nada todavía.** Recién tocamos el sistema si vos das el OK.

---

## 1. El problema en una frase

Hoy, "cerrar el mes" se siente como **tres tareas distintas** que en realidad son **una sola idea**. Eso genera la sensación de estar haciendo lo mismo tres veces, y la duda de "¿ya cerré o me falta algo?".

Este documento explica por qué pasa eso y propone dos caminos para resolverlo, con una recomendación clara al final.

---

## 2. Cómo funciona hoy (el recorrido real)

Cuando termina un mes, en la práctica intervienen tres cosas separadas:

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    "CERRAR EL MES"                           │
   │              (lo que vos tenés en la cabeza)                 │
   └─────────────────────────────────────────────────────────────┘
                              │
        se reparte, sin querer, en TRES lugares distintos:
                              │
   ┌──────────────┬───────────────────────┬──────────────────────┐
   │              │                       │                      │
   ▼              ▼                       ▼                      ▼
 (1) CHECKLIST   (2) ARCHIVO           (3) REINICIO          ¿terminé?
 DE CIERRE       DEL MES               DE RECURRENTES        nadie lo dice
                                                             en un solo lado
 Pantalla        Se guarda una         Las tareas que se
 "Cierre":       "foto" del mes        repiten todos los
 IVA, sueldos,   en el Historial,      meses vuelven a
 F931,           para poder            "pendiente" para
 conciliaciones. consultarlo           arrancar el mes
 Ves el avance   después (solo         nuevo desde cero.
 en % y quién    lectura).
 va atrasado.
                              │
                              ▼
            El (2) y el (3) pasan SOLOS, automáticos,
            al cambiar de mes. Vos no ves cuándo ni si salió bien.
```

### Qué es cada una de las tres, en criollo

1. **El checklist de cierre.** Es la pantalla "Cierre". Ahí aparecen las tareas típicas del cierre (IVA, sueldos, F931, conciliaciones) con su responsable, su vencimiento y el avance en porcentaje. Es lo que vos sentís como "el cierre" de verdad: la lista de cosas que hay que terminar.

2. **El archivo del mes.** Cuando el mes cambia, el sistema guarda una **foto** de cómo quedó todo y la manda al Historial. Sirve para que después puedas mirar "cómo cerró marzo" sin tocar nada. Esto pasa **solo**, automáticamente.

3. **El reinicio de las tareas recurrentes.** Las tareas que se repiten todos los meses (las mismas de siempre) se vuelven a poner en "pendiente" para empezar el mes nuevo limpio. Esto también pasa **solo**, automáticamente, al mismo tiempo que el archivo.

### Por qué se siente duplicado

- Las **tres** cosas son, para tu cabeza, "cerrar el mes". Pero viven en lugares distintos y con nombres distintos.
- El checklist lo manejás **vos a mano** (generás las tareas, las vas completando). En cambio el archivo y el reinicio pasan **solos**, sin avisar. Entonces nunca hay **un solo lugar** que diga "el mes quedó cerrado, todo listo".
- Además, generar las tareas del mes aparece en **dos pantallas** (en "Cierre" y también en "Administración → Plantilla"), con el mismo botón "Generar cierre". Eso refuerza la sensación de repetición.
- Resultado: quedás con la duda de "¿ya está?, ¿me falta apretar algo?, ¿el mes viejo se guardó bien?".

**Importante:** por dentro el sistema hace todo bien y no pierde nada. El problema **no** es técnico, es de **claridad**: no se ve como un proceso único.

---

## 3. Los dos caminos posibles

### Camino A — "Cierre unificado" (recomendado)

**La idea:** una sola pantalla, "Cerrar mes", que muestra los tres pasos como un semáforo, en orden, de arriba abajo. Vos ves **el estado de todo en un solo lugar** y entendés de un vistazo si el mes quedó cerrado.

Se juntan las tres cosas visualmente, pero **por debajo sigue funcionando exactamente igual que hoy**. No cambiamos cómo se guardan los datos ni cómo trabaja el equipo. Cambiamos **lo que se ve y cómo se cuenta**.

**Cómo se vería en pantalla:**

```
   ┌──────────────────────────────────────────────────┐
   │   Cerrar mes — junio 2026                         │
   ├──────────────────────────────────────────────────┤
   │                                                  │
   │   ●  1. Tareas del cierre        18 de 20  90%   │
   │      IVA, sueldos, F931, conciliaciones          │
   │      → Faltan 2 (ver cuáles)                      │
   │                                                  │
   │   ●  2. Foto del mes guardada    ✓ listo         │
   │      El mes quedó archivado en el Historial       │
   │                                                  │
   │   ●  3. Tareas del mes nuevo     ✓ reiniciadas   │
   │      Las recurrentes ya arrancan en julio         │
   │                                                  │
   └──────────────────────────────────────────────────┘
```

**Ventajas**
- Un solo lugar responde "¿cerré el mes?": verde = listo, con pendientes = todavía no.
- Se elimina la sensación de repetir: los tres pasos se ven como **uno solo, en orden**.
- Bajo riesgo: no se toca la forma en que se guardan los datos; todo el historial actual queda igual.
- Rápido de hacer y fácil de explicarle al equipo (no cambia cómo trabajan).

**Desventajas**
- Es una mejora de **presentación**, no un cambio de fondo. Sigue habiendo tres mecanismos por debajo, solo que ahora se muestran juntos y ordenados.
- El paso 2 y 3 se siguen disparando automáticamente al cambiar de mes; la pantalla los **muestra**, pero no agrega un botón manual (salvo que lo quieras, se puede sumar después).

**Esfuerzo estimado:** bajo. Es principalmente pantalla y textos. Sin cambios de fondo en los datos.

---

### Camino B — "El mes como una entidad propia" (cambio profundo)

**La idea:** que el mes sea "una cosa" de verdad dentro del sistema, con un estado **abierto** o **cerrado**, como una carpeta que se puede abrir y cerrar con llave. "Cerrar junio" pasaría a ser una acción explícita y formal.

**Ventajas**
- Conceptualmente es lo más "correcto": el mes tiene un estado claro y oficial.
- Permitiría, a futuro, cosas como bloquear la edición de un mes ya cerrado con un candado formal.

**Desventajas**
- Esfuerzo **alto**: hay que rehacer por dentro buena parte de cómo el sistema entiende los meses, y revisar todas las pantallas que hoy dependen de eso.
- **Más riesgo:** al tocar los cimientos, hay más superficie donde algo puede fallar y hay que probar todo de nuevo.
- **No aporta información nueva** para tu trabajo diario: lo que ves y lo que necesitás decidir sería prácticamente lo mismo que con el Camino A. La diferencia es interna, no la notás en el día a día.

**Esfuerzo estimado:** alto. Cambia los cimientos y obliga a re-probar todo el sistema.

---

## 4. Recomendación

**Vamos con el Camino A ("Cierre unificado").**

Resuelve el problema real —la **confusión** de sentir que cerrás el mes tres veces— con **bajo riesgo, poco esfuerzo y sin tocar nada del histórico** que ya tenés guardado. El Camino B es más "elegante" por dentro, pero cuesta mucho más, arriesga más y **no te cambia lo que ves ni lo que decidís**.

**Qué verías vos, en concreto, con el Camino A:**
- Una sola pantalla "Cerrar mes" con los tres pasos como semáforo (tareas del cierre → foto del mes → mes nuevo reiniciado).
- De un vistazo sabés si el mes quedó cerrado: verde en los tres = listo.
- Si algo del cierre está pendiente, lo ves ahí mismo, sin ir a buscar a otra pantalla.
- Deja de aparecer el mismo botón "Generar cierre" en dos lugares distintos: se unifica.

**Próximo paso:** necesitamos tu **OK explícito** para arrancar. Hasta que digas que sí, no tocamos nada.

---
---

## Apéndice técnico (para el equipo de sistemas)

*Esta sección no hace falta leerla para decidir. Está acá solo para que quede documentado el detalle técnico.*

### Piezas actuales que componen el "cierre"

| Concepto que ve el usuario | Dónde vive en el código / base de datos |
|---|---|
| Checklist de cierre (avance, %, responsables) | `src/features/cierre/Cierre.tsx`, `src/lib/cierre.ts` |
| Plantilla + botón "Generar cierre" (duplicado) | `src/features/admin/PlantillaCierre.tsx`, `src/lib/plantilla.ts` |
| Foto/archivo del mes (solo lectura) | `src/features/historial/HistorialMes.tsx`, `src/lib/archivo.ts`, tabla `cards_archive` |
| Reinicio de recurrentes | función `reset_recurrentes_seguro()` (`migracion-24-reset-recurrentes-seguro.sql`) |

### Detalle de cada pieza

- **Generación del cierre.** Las tareas del cierre se crean desde `settings.value.closing_template` (la plantilla). La idempotencia (no duplicar si se aprieta dos veces) se resuelve con una **marca en el historial** de cada tarjeta: `"Generada desde la plantilla de cierre mensual · YYYY-MM"` (ver `marcaPlantilla` en `plantilla.ts`). `closingCards()` en `cierre.ts` filtra las tarjetas de un mes justamente por esa marca.

- **Duplicación de UI.** El botón "Generar cierre de {mes}" existe en **dos** componentes: `Cierre.tsx` (para el mes visible) y `PlantillaCierre.tsx` (apunta al mes siguiente, `hoy + 1`). Ambos llaman a `filasParaInsertar()`. El Camino A unificaría esto en un solo punto de entrada.

- **Archivo y reinicio (mismo cron).** Ambos los hace la función `reset_recurrentes_seguro()`, disparada por el cron job `reset-recurrentes` (Supabase → Integrations → Cron → Jobs), mensual, día 1. La función:
  1. Borra el archivo previo del mes que cierra (idempotente) e inserta el snapshot `to_jsonb(c)` de cada card no-operativa en `cards_archive`.
  2. Resetea a `pend` **solo** las cards con `reset_policy = 'mensual'` (respeta `'mantener'` y `'manual'`), limpiando `done_at` y los `done` del checklist, y deja rastro en `history`.
  3. No toca `task_occurrences` (el cumplimiento diario ya es inmutable por fecha).
  - Corre con `SECURITY DEFINER` porque el cron no tiene rol `jefe`.

- **Por qué el usuario no "ve" los pasos 2 y 3.** Son server-side (cron + función SQL). No hay ningún componente de React que muestre su resultado ni su última corrida. El Camino A agregaría esa lectura de estado (p. ej. mostrar el último mes archivado en `cards_archive` y la última corrida del reset) sin cambiar la mecánica.

### Alcance técnico de cada camino

- **Camino A:** nuevo componente contenedor "Cerrar mes" que compone las lecturas existentes (`cierreStats`, `mesesDisponibles` sobre `cards_archive`, y opcionalmente el resultado del último reset). Consolidar el botón "Generar cierre" en un único lugar. **Sin cambios de esquema ni de RLS.** Solo UI + copy + una consulta de lectura del estado del cron/archivo.

- **Camino B:** nueva tabla `months` (o similar) con estado `abierto`/`cerrado`, más RLS asociada. Habría que reescribir la lógica que hoy infiere el mes por marca de historial (`marcaPlantilla`/`closingCards`), migrar el disparo del cron a una acción explícita de cierre, y re-testear archivo, historial, recurrentes y cierre de punta a punta. Alto esfuerzo y alta superficie de regresión, sin datos nuevos para el usuario.
