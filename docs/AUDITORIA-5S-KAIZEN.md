# Auditoría 5S + Kaizen — 27/07/2026

> **Esto es un documento de DECISIÓN, no de implementación.** Nada de acá está hecho.
> Cada recomendación tiene su costo, su riesgo y una casilla para que apruebes o rechaces.
>
> Pedido del propietario: *"revisar que todo funciona bien, que no hay ninguna función
> duplicada, y recordá que el programa tiene como valores principales las 5S y la filosofía
> Kaizen"*.

---

## 1. Estado de salud: verificado

| Chequeo | Resultado |
|---|---|
| TypeScript (`tsc -b`) | **0 errores** |
| Tests (`vitest run`) | **905 pasan / 81 archivos** |
| Build de producción | **OK** |
| Lint (`oxlint`) | Corre en CI en cada push |
| Migraciones escritas | 33 (la 32 y la 33 **pendientes de correr**) |

**No hay nada roto.** Lo que sigue son oportunidades de mejora, no incendios.

---

## 2. Hallazgos de duplicación (lo que pediste específicamente)

### 2.1 🔴 Función duplicada REAL — y la introduje yo

`useEscribirPeriodo()` en `src/hooks/useData.ts:338` **no se usa en ningún lado**.

Lo creé en la Fase 2 de períodos para centralizar la escritura en `card_periodos`… y después
implementé el mismo `upsert` **a mano, dos veces**: en `Board.tsx` (mover tarjeta) y en
`CardModal.tsx` (editar tarea). O sea: hay tres implementaciones de lo mismo y la buena está
muerta.

Es exactamente el tipo de cosa que pediste que buscara, y es mía. Dos salidas posibles:

- **(a) Usar el hook** en Board y CardModal, y borrar los upserts a mano. Deja UN solo lugar
  donde se escribe un período. Más trabajo, mejor resultado.
- **(b) Borrar el hook** y dejar los upserts inline. Más rápido, pero si mañana cambia la forma
  de escribir un período hay que acordarse de tocar dos archivos.

**Recomiendo (a).** Es el criterio de Seiton: un lugar para cada cosa.

- [ ] Aprobado (a) — unificar en el hook
- [ ] Aprobado (b) — borrar el hook
- [ ] Rechazado — dejarlo como está

### 2.2 🟡 Llamadas repetidas en el Director

`Director.tsx` llama **dos veces con los mismos argumentos** a:
- `concentracionPorCategoria(archives, team)` (líneas 62 y 82)
- `previsibilidad(norm, mes)` (líneas 65 y 83)

Ambas recorren listas completas. No se nota hoy con pocos datos, pero es trabajo tirado y
ensucia la lectura. Se arregla guardando el resultado en una constante.

- [ ] Aprobado
- [ ] Rechazado

### 2.3 🟢 NO es duplicación: `puedeEliminarAnuncio`

Knip marca `puedeEliminarAnuncio = puedeEditarAnuncio` como export duplicado. **Lo revisé y
está bien así**: es un alias semántico deliberado, con el comentario que explica que hoy la
regla es la misma pero podría diferenciarse. Lo dejo. Lo menciono para que conste que se
miró y se decidió, no que se pasó por alto.

---

## 3. 5S — Seiri (eliminar lo innecesario)

### 3.1 🔴 Seis librerías instaladas que NO se usan

```
@base-ui/react · class-variance-authority · clsx · shadcn · tailwind-merge · tw-animate-css
```

Verificado a mano, no sólo por el detector:
- **Nadie las importa** (grep en todo `src/`).
- **No existe** la carpeta `src/components/ui` (no hay componentes shadcn).
- `cn()` está **escrito a mano en 3 líneas** en `src/lib/ui.tsx` — no usa `clsx` ni
  `tailwind-merge`, que es para lo que suelen estar.

Son restos de un andamiaje que se instaló y nunca se usó. **Por qué molesta ahora más que
antes:** acabo de configurar Dependabot, así que va a abrir pull requests de actualización
**de librerías que no usamos**. Ruido puro, todas las semanas.

Impacto de sacarlas: instalación más rápida, menos superficie de seguridad, cero ruido de
mantenimiento. Riesgo: bajo (no las importa nadie), pero se verifica con build + tests.

- [ ] Aprobado
- [ ] Rechazado

### 3.2 🟡 Exports muertos

`LECTURA_ICR`, `MIGRACION_PERIODOS`, `MIGRACION_ADMIN_SISTEMA`, `CAMPOS_ADMIN_SISTEMA_PROFILES`
y varios tipos exportados que nadie importa. Son inofensivos, pero son ruido: quien lee el
archivo no sabe si son API pública o basura.

Ojo: algunos son **intencionales** (las constantes de migración documentan el número y se usan
dentro del mismo archivo). Habría que revisarlos uno por uno, no borrar en masa.

- [ ] Aprobado
- [ ] Rechazado

---

## 4. 5S — Seiton (un lugar para cada cosa)

### 4.1 🟡 El estilo de "panel" está copiado en 23 archivos

Estos dos fragmentos aparecen repetidos en **23 archivos** de `src/features/`:

```tsx
const card = "bg-surface rounded-2xl p-[18px]";
const cardSh = { boxShadow: "var(--ring),var(--shadow)" };
```

Consecuencia concreta: si algún día querés cambiar el estilo de las tarjetas (más redondeadas,
otra sombra, más aire), hay que editar 23 archivos y rezar por no olvidarse ninguno. Y ya hay
**dos variantes distintas** dando vueltas (`--ring` vs `--ring-sh`), que es justamente cómo
empieza la deriva visual.

**Propuesta:** un componente `<Panel>` en `src/components/Panel.tsx` que encapsule el estilo.
Se migran los 23 archivos de a poco (no hace falta todo de una).

Riesgo: bajo, pero toca muchos archivos. Se puede hacer en tandas y verificar visualmente.

- [ ] Aprobado — hacerlo completo
- [ ] Aprobado — crear el componente y migrar sólo lo nuevo de acá en adelante
- [ ] Rechazado

---

## 5. 5S — Seiketsu (que la limpieza no se degrade sola)

### 5.1 🟢 Ya resuelto

El workflow `mantenimiento.yml` que configuré corre `knip` **todos los lunes y en cada pull
request**, y publica el informe. O sea: esta auditoría que estoy haciendo a mano **ya queda
automatizada**. La próxima vez que aparezca una dependencia muerta o código sin uso, lo vas a
ver sin que nadie tenga que acordarse de mirar.

Eso es Seiketsu: no basta con limpiar una vez, hay que hacer que quedarse sucio sea visible.

---

## 6. Kaizen — mejoras de funcionamiento propuestas

### 6.1 ⭐ Períodos Fase 4 — el checklist diario que no se borra

**Es tu queja original #2**, la única del spec 28-correcciones que sigue sin resolverse.

Hoy una tarea recurrente diaria tiene **un solo checklist compartido por todos los días**.
Cuando se reinicia, se pierde lo que tildaste ayer. La grilla de cumplimiento sobrevive
(vive en `task_occurrences`), pero el detalle no.

Solución: extender `task_occurrences` con `checklist` y `observaciones` por fecha. La tabla ya
es inmutable por día, así que el modelo ya está bien — falta guardar el detalle ahí.

Requiere: una migración nueva (34). Esfuerzo medio. **Valor alto: es un pedido tuyo que quedó
sin cerrar.**

- [ ] Aprobado
- [ ] Rechazado

### 6.2 ⭐ Períodos Fase 3 — cerrar un mes con candado

Hoy "cerrar el mes" es una **marca declarativa**: dice que cerraste, pero no congela nada. Con
`card_periodos` ya en su lugar, cerrar un mes puede volverlo **de sólo lectura** de verdad, con
candado en el selector, y reabrirlo si hace falta.

Requiere: sin migración (usa `cierre_periodos`, que ya existe). Esfuerzo bajo-medio. Riesgo
bajo. Es la pieza que le da sentido pleno al cierre.

- [ ] Aprobado
- [ ] Rechazado

### 6.3 Modo Cierre (idea 46 de tu lista)

Los últimos días del mes, la interfaz se enfoca: menos información secundaria, todo orientado
a cerrar. Conceptualmente muy alineado con cómo trabajás.

**Mi recomendación honesta: dejarlo para después.** Es trabajo de UI condicional repartido en
muchas pantallas, y conviene hacerlo cuando lo demás esté verificado y estable. Si lo hacemos
ahora, sumamos superficie sobre cosas que todavía no viste funcionando.

- [ ] Aprobado igual
- [ ] Postergado (mi recomendación)

### 6.4 Peso del bundle inicial

El archivo principal pesa **147 kB comprimido**. No es alarmante, pero:
- `vendor-motion` (framer-motion) son **42 kB** comprimidos sólo para animaciones.
- `xlsx` son 141 kB, pero **ya está separado** y sólo se descarga si exportás a Excel — eso
  está bien resuelto.

Se podría evaluar si las animaciones justifican su peso. **No lo recomiendo ahora**: es una
optimización sin problema reportado, y "no está lento" no es un motivo para tocar algo que
funciona.

- [ ] Quiero que lo investigue
- [ ] Postergado (mi recomendación)

---

## 7. Mi recomendación de orden

Si aprobás todo, este sería el orden — de menor riesgo a mayor, y priorizando lo que ya te
debía:

1. **Limpieza** (3.1 + 2.2 + 2.1): sacar las 6 librerías muertas y unificar la escritura de
   períodos. Bajo riesgo, mejora inmediata.
2. **Períodos Fase 3** (6.2): cierre con candado. Sin migración.
3. **Períodos Fase 4** (6.1): checklist diario. Cierra tu queja #2.
4. **Panel** (4.1): consistencia visual, en tandas.

Y **antes de todo eso**, lo que sigue pendiente y no depende de mí: correr las **migraciones
32 y 33**, sin las cuales no podés ver ni los períodos ni las consultas.

---

## 8. Lo que NO recomiendo tocar

- **`puedeEliminarAnuncio`**: el alias es deliberado y está documentado.
- **Animaciones / bundle**: no hay problema reportado.
- **Modo Cierre ahora**: mejor cuando lo demás esté verificado.
- **Reescribir lo que funciona**: hay 905 tests en verde. La tentación de "mejorar" código
  sano es la forma más común de romper un sistema estable.
