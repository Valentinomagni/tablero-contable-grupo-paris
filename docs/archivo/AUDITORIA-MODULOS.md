# Auditoría de módulos — `src/features/*` (item 13.1, 20/07/2026)

> Regla del task: **ningún módulo se elimina**. Esta auditoría es un mapa de qué hace cada
> uno hoy, qué tan enganchado está al flujo principal (Tablero → Resumen → Reporte → Cierre)
> y, para los de uso más marginal, una propuesta concreta de integración — no de borrado.

## Tabla general

| Módulo (`src/features/`) | Qué hace hoy | Uso aparente en el flujo | Utilidad propuesta |
|---|---|---|---|
| `board/` (Board, CardModal, DelegarModal, NuevaTareaModal, ArqueoResultDialog, CumplimientoDiario) | Kanban de tareas por persona: crear, mover, delegar, arqueo diario, anotaciones | **Alto** — vista por defecto al entrar (`mode: "board"`), corazón de la app | Ya central. Sumar el link a Notas propuesto abajo. |
| `resumen/` (Resumen, DepGraph) | Panel de arranque para jefe/encargado: KPIs de equipo, accesos a personas | **Alto** — vista `__resumen`, default para gestores | `DepGraph` (grafo de dependencias entre tareas) hoy vive colapsado dentro de Resumen y es fácil de no ver. Proponer: badge/contador de "N tareas bloqueadas" en el header de Resumen que despliegue el grafo, en vez de que dependa de que el usuario scrollee hasta encontrarlo. |
| `reporte/` (Reporte, AnalisisMensual) | Reporte ejecutivo mensual: cumplimiento, gráficos, análisis por persona/marca | **Medio-alto** — vista `__reporte`, mensual/gerencial por naturaleza (no diario) | Ya lazy-loaded (13.2). Sin cambios adicionales; candidato natural de P5 (export PDF). |
| `objetivos/` (Objetivos, ObjModal) | Objetivos por persona con seguimiento de cumplimiento | **Medio** — tab "Objetivos" del subnav de persona | Vincular con P1 (arqueo) creando el objetivo automático "Arqueo sin diferencias ≥ 98%" ya propuesto en PROPUESTAS-MEJORA.md P1. |
| `mimes/` (MiMes) | Vista "Mi mes": resumen mensual personal de una persona (cards + actividad) | **Medio** — tab "Mi mes"/"Su mes" del subnav | Uso bajo comparado con Board/Hoy. Propuesta: agregar acceso directo desde Reporte ("Ver mi mes" en la fila de cada persona) para que el jefe salte de la foto agregada al detalle mensual de un empleado puntual sin pasar por "Tablero de X". |
| `hoy/` (MiDia) | Agenda del día: ocurrencias de hoy + vencimientos + prioridad alta (P4 ya implementada) | **Alto** — tab default recomendado, primera pestaña del subnav | Consolidado. Sin cambios. |
| `semana/` (Semana) | Vista semanal de tareas (probablemente agenda de 7 días) | **Bajo** — un tab más entre 5, compite con "Hoy" y "Tareas" | Propuesta: convertir "Semana" en la vista sugerida automáticamente los **lunes** (default de `mode` al iniciar sesión un lunes, en vez de "board"), ya que ahí es cuando planificar la semana tiene más sentido. El resto de los días sigue el default actual ("Hoy"). |
| `objetivos/`, `tablon/` (Tablon, arca) | Tablón de anuncios/avisos del equipo + vacaciones/ausencias (arca.tsx) | **Medio** — vista `__tablon`, con badge de novedades en el header | Uso ligado a que haya avisos activos; el badge ya lo resuelve. Sin cambios. |
| `notas/` (Notas) | Anotaciones libres (¿de quién? probablemente notas sueltas del usuario, no ligadas a una tarea) | **Bajo** — vista `__notas`, sin entrada visible desde el subnav de persona (solo accesible si está enganchada al menú superior) | Propuesta concreta: agregar botón "Ver notas relacionadas" o un ícono de nota dentro de **CardModal**, que abra/filtre Notas por la tarea o persona actual. Así una anotación general deja de ser un cajón aislado y se vuelve contexto de la tarea que se está mirando. |
| `bitacora/` (Bitacora) | Log/historial de eventos (auditoría de cambios: quién movió qué, cuándo) | **Bajo** — vista `__bitacora`, típicamente solo para jefe, sin acceso directo desde otras pantallas | Propuesta: enlazar desde **UserModal** (ficha de la persona) un link "Ver bitácora de esta persona" que abra Bitácora pre-filtrada por `owner`, en vez de que el jefe tenga que navegar a la vista general y buscar manualmente. |
| `historial/` (HistorialMes) | Tareas archivadas/cerradas de meses anteriores por persona | **Medio-bajo** — tab "Historial" del subnav de persona | Ya lazy-loaded (13.2). Uso esperado bajo por naturaleza (consulta ocasional, no diaria); no requiere más integración que la que ya tiene. |
| `organigrama/` (Organigrama) | Vista jerárquica del equipo por marca/manager | **Bajo** — vista `__organigrama`, consulta puntual (¿quién reporta a quién?) | Ya lazy-loaded (13.2). Propuesta: desde **UserModal**, en la sección de jerarquía, un link "Ver en organigrama" que abra esta vista centrada en esa persona/marca, en vez de dejarlo como destino aislado del menú. |
| `cierre/` (Cierre) | Cierre mensual: plantilla de tareas recurrentes, checklist de fin de mes | **Medio** — vista `__cierre`, uso mensual por diseño | Ya lazy-loaded (13.2). Vinculado a P2 (auto-generación por cron) cuando se decida implementar. |
| `admin/` (Admin, Huerfanas, PlantillaCierre, ReasignarModal, UserModal) | Administración de usuarios, tareas huérfanas, plantillas, reasignación, ficha de persona | **Alto** para jefe/admin, invisible para empleado | Ya lazy-loaded (13.2, `Admin`). Sin cambios adicionales. |

## Resumen de lo que ya está resuelto por 13.2

Las vistas más pesadas de renderizar/importar y de uso no-primer-render (Reporte, Calendario,
Cierre, Organigrama, Notas, Bitácora, Admin, HistorialMes, MiDia) ya estaban separadas en chunks
propios vía `React.lazy` desde una iteración anterior ("Kaizen H2"). Esta tarea normalizó el
patrón para las 5 vistas del alcance (Reporte, Organigrama, Calendario, Bitácora, HistorialMes):
ahora cada una expone un `export default` real al final del archivo (sin quitar el export
nombrado que usan los tests) y el `lazy()` en `App.tsx` importa directamente en vez de mapear
`.then((m) => ({ default: m.X }))`. Ver cifras de bundle antes/después en el commit.

## Principio general

Ningún módulo listado como "uso bajo" se elimina: todos representan una función real
(consulta ocasional, auditoría, planificación) que un jefe o empleado puede necesitar en un
momento puntual del mes, aunque no sea parte del recorrido diario. La estrategia es **integrar**
(links cruzados desde donde el usuario ya está) en vez de esconder o remover.
