# Propuestas de mejora — análisis del sistema (18/07/2026, actualizado 20/07/2026)

> Spec 24 item 6: **no se implementó nada** al momento de escribir este documento.
> Actualización post spec 25/26 (task 14, item 13.3): **P1, P2, P4, P6, P7, P8, P9 y P10 quedaron
> implementadas en spec 25**; **P3 y P5 también están implementadas**. Quedan bloqueadas por el
> usuario **P11** (falta DSN de Sentry) y **P12** (falta `npx supabase login`). Ver detalle de
> estado al pie de cada propuesta.
> Criterio: solo mejoras que aporten valor real (productividad, organización, control, UX,
> calidad de información, automatización, análisis gerencial). Nada de features innecesarias.

Estado base analizado: React 19 + Vite + Supabase + TanStack Query; ~35 libs puras testeadas
(260 tests); vistas Resumen/Reporte/Cierre/Organigrama/Calendario/Tablón/Anotaciones/Historial;
recurrencias con `task_occurrences`; jerarquía por `manager_id`/`marca`; notificaciones; arqueo.

Leyenda esfuerzo: **S** ≈ medio día · **M** ≈ 1-2 días · **L** ≈ 3+ días.

---

## Alto valor / bajo-medio esfuerzo (recomendadas primero)

### P1 — Dashboard del arqueo integrado a objetivos y ficha (control gerencial) · M
**Estado:** implementada (spec 25).
**Problema:** el arqueo (item 9) ya registra ok/diferencias y calcula cumplimiento, pero el
indicador vive dentro del CardModal. Un jefe no ve de un vistazo el cumplimiento de arqueo del
mes por cajero/responsable.
**Propuesta:** en el Reporte y en la ficha de puesto (UserModal), una fila "Cumplimiento de
controles (arqueo)" con el % del mes y semáforo (≥98 verde, ≥95 ámbar, <95 rojo), alimentada por
`statsArqueo` ya existente. Vincularlo a un objetivo automático ("Arqueo sin diferencias ≥ 98%").
**Justificación:** reutiliza lógica ya testeada; convierte un dato disperso en KPI gerencial.
**Dependencias:** ninguna nueva (migración 23 aplicada). **Riesgo:** bajo.

### P2 — Auto-generación de las ocurrencias del mes por cron (Seiketsu) · S
**Estado:** implementada (spec 25).
**Problema:** hoy las ocurrencias de tareas recurrentes se materializan cuando alguien abre la
card ese mes. Si nadie la abre a principio de mes, el calendario/arqueo del día 1-3 puede estar vacío.
**Propuesta:** un pg_cron mensual (día 1, 00:05) que llame una función `materializar_mes()` para
todas las cards con `recur_rule`, respetando `reset_policy`. Deja el mes listo sin intervención.
**Justificación:** el sistema ya tiene el cron `reset-recurrentes` heredado; esto lo formaliza y
elimina el "hueco de principio de mes". **Dependencias:** confirmar estado del cron actual.
**Riesgo:** medio (tocar cron de producción — probar en función aislada primero).

### P3 — Búsqueda global (Ctrl+K) sobre TODO, no solo tareas · S
**Estado:** implementada.
**Problema:** el Command Palette busca tareas/personas/vistas, pero no avisos, anotaciones ni
eventos del calendario.
**Propuesta:** ampliar el índice del CommandPalette a announcements, notes y vacaciones. Un solo
buscador para "¿dónde estaba eso?".
**Justificación:** Seiton — reduce clics de navegación; reusa el componente existente.
**Riesgo:** bajo.

### P4 — Vista "Mi día" / agenda personal del empleado · M
**Estado:** implementada (spec 25).
**Problema:** el empleado entra a su tablero (kanban) pero no tiene una vista "qué tengo que hacer
HOY" priorizada (vencimientos de hoy + ocurrencias del día + tareas alta prioridad).
**Propuesta:** subtab "Hoy" que liste, ordenado por urgencia: ocurrencias del día (arqueo, etc.),
tareas que vencen hoy/vencidas, y las de prioridad alta. Un checklist del día accionable.
**Justificación:** productividad diaria directa; datos ya existen (dueInfo, occurrences).
**Riesgo:** bajo.

### P5 — Exportar Reporte/Cierre a PDF con marca (gerencial) · S
**Estado:** implementada.
**Problema:** el Reporte tiene "Imprimir/PDF" (window.print) pero sin encabezado con logo ni
formato de informe.
**Propuesta:** hoja de estilos `@media print` con el lockup vectorial (ya tenemos SVG), fecha,
y quiebre de página por sección. Un PDF presentable para la reunión de jefes.
**Justificación:** el logo vectorial ya está; costo casi solo CSS. **Riesgo:** bajo.

---

## Medio valor / medio esfuerzo

### P6 — Plantillas de tareas por categoría (automatización de alta) · M
**Estado:** implementada (spec 25).
**Problema:** duplicar (item 5) ayuda, pero cada mes se recrean las mismas tareas (conciliaciones
por banco, IVA por marca). Es repetitivo.
**Propuesta:** "plantillas" (settings jsonb) que generen un lote de tareas con un clic
("Generar conciliaciones de julio" → N cards con responsable/categoría/vencimiento). Extiende la
plantilla de cierre ya existente a cualquier categoría.
**Justificación:** Kaizen — mata la carga repetitiva; reutiliza `filasParaInsertar`.
**Riesgo:** medio (UX de configuración de plantillas).

### P7 — Alertas proactivas de riesgo (asistente) · M
**Estado:** implementada (spec 25).
**Problema:** las notificaciones son por evento; falta la mirada "preventiva".
**Propuesta:** cómputo diario (cron o al abrir Resumen) de señales: persona con >X tareas
vencidas, tarea crítica sin mover hace N días, cajero con 2+ diferencias en la semana, equipo
por debajo del % objetivo. Notificación al gestor correspondiente.
**Justificación:** control gerencial anticipado; reusa métricas existentes.
**Riesgo:** medio (calibrar umbrales para no generar ruido — respetar regla anti-ruido).

### P8 — Comentarios/menciones en tareas con notificación · M
**Estado:** implementada (spec 25).
**Problema:** las cards tienen "anotaciones" pero no hilo de conversación ni @menciones.
**Propuesta:** permitir @persona en el comentario de una card → notificación al mencionado.
Convierte la tarea en el lugar de la conversación (menos WhatsApp paralelo).
**Justificación:** trazabilidad + UX; parser simple sobre el campo comments existente.
**Riesgo:** bajo-medio.

### P9 — Modo "cobertura activa" visible en el tablero · S
**Estado:** implementada (spec 25).
**Problema:** las vacaciones (item 5) reasignan tareas, pero cuando alguien cubre a otro no queda
marcado en la tarjeta que es "cobertura temporal".
**Propuesta:** badge "Cobertura de {ausente}" en las cards reasignadas por vacaciones, y al volver
el titular, botón "Devolver al titular". Evita que la cobertura quede permanente por olvido.
**Justificación:** cierra el ciclo de la feature de vacaciones; history ya lo registra.
**Riesgo:** bajo.

---

## Estratégicas / mayor esfuerzo (evaluar cuando el core esté estable)

### P10 — App móvil PWA optimizada para el cajero · L
**Estado:** implementada (spec 25).
**Problema:** el arqueo diario lo hace gente en el mostrador; el tablero completo es pesado para eso.
**Propuesta:** una vista móvil mínima (ya es PWA) enfocada: "marcar arqueo de hoy" con los 2
botones (sin/con diferencias) y nada más. Instalable en el celular del responsable de caja.
**Justificación:** adopción real de la feature crítica. **Riesgo:** medio (responsive dedicado).

### P11 — Observabilidad en producción (Sentry) · S (bloqueado por DSN)
**Estado:** pendiente — bloqueada por el usuario (falta el DSN de Sentry).
**Problema:** si algo falla para un empleado, nos enteramos cuando lo reporta.
**Propuesta:** `@sentry/react` (ya evaluado en TOOLING-UPGRADES) enganchado en `validateRows` y un
error boundary. Necesita el DSN de una cuenta free del usuario.
**Justificación:** calidad; ya está el punto de enganche preparado (`schemas.ts`).
**Riesgo:** bajo. **Bloqueo:** DSN del usuario.

### P12 — Tipos generados desde la DB (menos drift) · S (bloqueado por auth)
**Estado:** pendiente — bloqueada por el usuario (falta `npx supabase login` con token propio).
**Problema:** `types.ts` se mantiene a mano; ya hubo casos de campos nuevos por migración.
**Propuesta:** correr `npm run gen:types` (script ya existe) tras cada migración → tipos reales de
Supabase. Requiere `npx supabase login` con token del usuario.
**Justificación:** Seiketsu — una sola fuente de verdad de tipos. **Riesgo:** bajo.

---

## Recomendación de orden

> Nota histórica: el orden de abajo corresponde al momento original (18/07/2026) en que ninguna
> propuesta estaba implementada. Con P1-P10 y P3/P5 ya resueltas, lo único pendiente de decisión
> del usuario es **P11** y **P12** (ver estado arriba).

1. **P1** (arqueo gerencial) y **P4** (Mi día) — impacto diario inmediato, esfuerzo medio.
2. **P3** (búsqueda global) y **P5** (PDF con marca) — quick wins de UX.
3. **P2** (cron de ocurrencias) — resolver junto con la verificación del cron `reset-recurrentes`.
4. El resto según prioridad del negocio.

## Nota de spec 26 (task 14, item 13)

Este spec (26) revisó el estado de estas propuestas (item 13, ver arriba) y ejecutó
code-splitting adicional + auditoría de módulos (`docs/AUDITORIA-MODULOS.md`, item 13.1-13.2).
No se agregaron propuestas nuevas a este documento: el foco de la revisión fue confirmar estado
real de P1-P12, no generar más ítems. Las únicas pendientes activas siguen siendo **P11** y
**P12**, ambas bloqueadas por credenciales que solo el usuario puede proveer.
