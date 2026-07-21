# Propuestas para el spec 28 — investigación del 20/07/2026

Tres investigaciones independientes (empleados / jefes / técnica) sobre el código real,
filtrando lo que ya existe. Consolidado y priorizado. **Nada de esto está implementado.**

Hallazgo transversal: la app captura datos valiosos que después nadie lee — reaperturas en
`history`, timestamps de transiciones, diferencias de arqueo históricas, el archivo mensual
completo. Muchas de las mejores ideas son "leer lo que ya guardamos".

---

## Tier 1 — Máximo impacto / esfuerzo bajo (candidatas al spec 28)

| # | Idea | Para quién | Por qué |
|---|------|-----------|---------|
| E1 | **Mis arqueos**: historial personal de diferencias (fecha, importe, obs, acumulado del mes, faltante vs sobrante) | Cajeros | El dato ya se guarda en `task_occurrences` y se descarta visualmente; cero tablas nuevas |
| E5 | **Cierre del día**: semáforo diario del cajero (arqueo hecho, cargas completas, vence-hoy cerradas) antes de irse | Empleados | Replica el patrón del cierre unificado a nivel día; todo lectura de datos existentes |
| E8 | **Aviso "vence hoy y es tuyo"**: un vencimiento del tablón con responsable genera notificación personal | Empleados | `owner_id` ya existe en announcements y no dispara nada |
| J1 | **Índice de retrabajo**: ratio de tareas reabiertas / terminadas por persona/marca/mes | Jefe | "Reabrió la tarea" ya se escribe en `history`; nadie lo lee. Mide calidad, no cantidad |
| J3 | **Radar de vencimientos fiscales**: por cada vencimiento futuro, ¿hay tarea? ¿avanza? ¿el responsable está de vacaciones? → semáforo predictivo | Jefe | Cruza announcements + cards + vacaciones; hoy el semáforo es reactivo |
| J10 | **Tendencia de diferencias de arqueo**: reincidencia por persona/sucursal a lo largo de meses | Jefe | Hoy solo se ve el mes en curso |
| T1 | **Notificaciones en tiempo real**: matar el polling de 60 s replicando el canal realtime que ya usa el tablero | Todos | La campana pasa de "hasta 1 min de retraso" a instantánea. Paso manual: un checkbox en Supabase (Replication) |
| T2 | **Partir el bundle inicial** (`manualChunks` de motion/supabase/query en vite.config) | Todos | Ataca de verdad el chunk >500 kB; solo config |
| T5 | **Activar el cron del resumen semanal** (la función ya existe de la migración 28) | Jefe | Un `cron.schedule` en el SQL Editor |

## Tier 2 — Alto impacto / esfuerzo medio

| # | Idea | Para quién |
|---|------|-----------|
| E3 | **Calendario fiscal autogenerado**: vencimientos AFIP/ARCA recurrentes (IVA, F931, IIBB, Sicore) que se crean solos cada mes con el motor de recurrencia existente | Empleados + jefe |
| E2 | **Checklist cuantitativo**: "18 de 30 comprobantes cargados" reusando el patrón de operativas | Empleados |
| E4 | **Cheques en cartera**: alta de cheques con fecha de cobro + semáforo de vencimiento existente | Empleados |
| E6 | **Traspaso a reemplazante**: al cargar vacaciones, dejar novedades que le llegan al que cubre | Empleados |
| J4 | **Comparador de sucursales/marcas en el tiempo**: serie mensual (12 meses) de cumplimiento/puntualidad/retrabajo desde `cards_archive` — lo que pide el directorio | Jefe |
| J5 | **Curva de mejora individual**: tendencia 3-6 meses por persona, sparkline en su ficha | Jefe |
| J6 | **Panel de delegaciones vivas**: seguimiento de todo lo delegado sin entrar tarea por tarea | Jefe |
| J7 | **Impacto de licencias**: "si aprobás estas vacaciones, quedan N tareas vencibles sin cubrir" | Jefe |
| J8 | **Cierre en riesgo**: proyección "al ritmo actual, el cierre no llega" con daily_snapshots | Jefe |
| T3 | **Notificaciones por trigger de DB** (migración 29): los crons y acciones server-side notifican solos; el cliente deja de ser responsable | Todos |
| T6 | **Mutaciones optimistas** (mover card / marcar leída al instante, rollback en error) | Empleados |
| T4 | **Buscador full-text de Postgres** (acentos, todo el histórico, no solo lo cargado) | Todos |

## Tier 3 — Valiosas pero más caras o dependientes

| # | Idea | Nota |
|---|------|------|
| J9 | Bus factor por categoría (dependencia de una sola persona) | Riesgo operativo, esfuerzo medio |
| E7 | Conciliación bancaria asistida (partidas pendientes + monto descuadrado arrastrado) | Esfuerzo medio |
| E9 | Watchlist de saldos de proveedores/clientes | Tabla nueva |
| T8 | Vista materializada para el análisis histórico | Vale cuando crezca el histórico |
| T7 | **Web Push real** (avisos con la app cerrada) | Viable sin servidor propio (VAPID + edge function), pero requiere `supabase login` (mismo bloqueo que P12) y en iPhone solo con la PWA instalada. Hacer DESPUÉS de T1+T3 |

## Descartadas con razón
- Integración AFIP real (sin API viable sin certificados), Supabase Branching (plan pago + CLI), cualquier server local (PC sin admin), Sentry/gen:types (ya propuestas, siguen bloqueadas por pasos del usuario).

## Recomendación de paquete para el spec 28
**Los 9 del Tier 1** entran en una tanda (7 son esfuerzo bajo) + **E3 (calendario fiscal)** y
**J4 (comparador de sucursales)** del Tier 2 como platos fuertes. Eso da: cajeros con su
historial de arqueos y cierre del día, jefe con retrabajo + radar fiscal + comparador para
el directorio, y la app entera más rápida (realtime + bundle).
