# Hallazgos Kaizen / 5S — propuestas para revisión (spec #3)

> Documento de PROPUESTAS. Nada de esto se implementa sin OK previo.
> Fecha: 2026-07-16 · Base: revisión de `src/App.tsx`, `Board.tsx`, `CardModal.tsx`, `Resumen.tsx`, `Calendario.tsx`, `Tablon.tsx`, `tailwind.config.js` y el bundle de producción.

---

## 1. (Seiso — limpiar) Clases `bg-chip` / `bg-done-soft` / `bg-danger-soft` / `bg-warn-soft` no compilan: bug latente

**Problema.** Hay 12 usos de estas clases en `src/` (p. ej. `Calendario.tsx` líneas 15-17 en el mapa `KIND`, badges "Venció" en `Resumen.tsx` línea 167), pero `tailwind.config.js` solo define los colores `accent-soft`, `done`, `danger`, `warn`… — **no** `chip`, `danger-soft`, `warn-soft` ni `done-soft`. Verificado en el CSS compilado (`dist/assets/index-*.css`): las reglas `.bg-chip`, `.bg-danger-soft`, etc. no existen; solo existen las variables CSS. Resultado: esos chips se renderizan sin fondo (texto coloreado sobre transparente).

**Propuesta.** Agregar `chip: "var(--chip)"`, `"danger-soft": "var(--danger-soft)"`, `"warn-soft": "var(--warn-soft)"` y un `done-soft` (crear la variable) al `theme.extend.colors`. Verificar visualmente Calendario, Tablón y Resumen tras el cambio.

**Esfuerzo.** Bajo (30 min con verificación visual).

## 2. (Seiso — limpiar) Bundle único de 831 KB sin code-splitting

**Problema.** `dist/assets/index-*.js` pesa 831 KB minificado; el propio build de Vite lo advierte en cada `npm run build`. Todo (Reporte con charts, Admin, Organigrama, Calendario…) se descarga en el primer login, aunque un empleado quizá nunca abra el Reporte ejecutivo.

**Propuesta.** `React.lazy()` + `Suspense` por vista (Reporte, Admin, Cierre, Organigrama, Calendario son candidatos obvios: solo se montan al navegar). Ganancia estimada: 30-40 % menos en el bundle inicial.

**Esfuerzo.** Medio (2-3 h, requiere smoke de cada vista).

## 3. (Kaizen — mejora continua) Crear una tarea recurrente exige demasiados pasos

**Problema.** Hoy la recurrencia vive dentro de `CardModal.tsx` (sección "Recurrencia", líneas ~178-208): hay que crear la tarea, abrirla, bajar hasta la sección, elegir regla y apretar "Guardar recurrencia". Son 5+ interacciones para un caso muy frecuente en contabilidad (tareas mensuales).

**Propuesta.** Exponer la regla de recurrencia en el formulario de alta rápida (o un atajo "Duplicar como recurrente" en el menú de la tarjeta), guardando tarea + regla en una sola acción.

**Esfuerzo.** Medio (2-4 h).

## 4. (Seiton — un lugar para cada cosa) Vencimientos duplicados entre Tablón y Calendario

**Problema.** Los anuncios `kind === "vencimiento"` se listan y ordenan en `Tablon.tsx` (líneas 28-46) y a la vez se pintan como eventos en `Calendario.tsx` (mapa `KIND`). Dos vistas, dos lógicas de orden/badge propias sobre el mismo dato; el usuario tiene que recordar dónde mirar y el código duplica el formateo de fechas/badges.

**Propuesta.** Extraer un helper compartido (p. ej. `lib/vencimientos.ts`: filtrado, orden y etiqueta de urgencia) y que ambas vistas lo consuman; en el Tablón, enlazar cada vencimiento a su día del Calendario para unificar el flujo.

**Esfuerzo.** Medio (2-3 h).

## 5. (Seiton — visibilidad) Atajos de teclado sin documentar en la UI

**Problema.** `App.tsx` (líneas 63-76) implementa Ctrl/Cmd+K (paleta de comandos) y Ctrl/Cmd+Z (deshacer), pero ninguna parte de la interfaz los anuncia: no hay hint en el header, ni ítem "Atajos" en el menú de usuario, ni tooltip. Funciones valiosas quedan invisibles para el equipo.

**Propuesta.** Agregar un ítem "Atajos de teclado" en el menú de usuario (modal chico con la lista) y/o un placeholder "Buscar… Ctrl K" en el header. Reutiliza `Modal` existente.

**Esfuerzo.** Bajo (1-2 h).

## 6. (Seiketsu — estandarizar) Estados vacíos inconsistentes entre vistas

**Problema.** Cada vista redacta su vacío a su manera: "Sin carga abierta." (`Reporte.tsx` línea 92), "Sin actividad en el período." (línea 106), variantes "No hay…" / "Nada…" en Admin, Notas, Tablón, Semana, etc. (18 archivos con textos ad hoc). No hay componente ni tono común; algunos ofrecen acción siguiente y otros no.

**Propuesta.** Componente `EmptyState` único (ícono Lucide + título + descripción + acción opcional) y una pasada de unificación de textos (voz "vos", siempre sugerir el próximo paso cuando exista).

**Esfuerzo.** Medio (2-3 h).

## 7. (Seiri — separar lo necesario) Lógica de negocio incrustada en el handler de teclado de `App.tsx`

**Problema.** El deshacer (Ctrl+Z) hace el update a Supabase y la invalidación de queries directamente dentro del `useEffect` de teclado en `App.tsx` (líneas 63-76). Mezcla capa de UI global con persistencia; no es testeable de forma aislada y `App.tsx` ya orquesta 15+ imports de features.

**Propuesta.** Mover esa lógica a `lib/undo.ts` (una función `deshacerUltimo(qc)`) y dejar el handler solo como binding de tecla. Mismo patrón serviría para futuros atajos.

**Esfuerzo.** Bajo (1 h, con test unitario del undo).

## 8. (Seiketsu — estandarizar) Claves de `localStorage` dispersas y sin convención

**Problema.** Hay claves sueltas escritas inline: `"tablon-visto"` (`App.tsx` línea 109), `"version-vista"` (aviso de novedades), estado de la barra lateral, tema/densidad. Sin prefijo común ni módulo central: riesgo de colisión, tipos repetidos y difícil de limpiar/migrar.

**Propuesta.** Módulo `lib/storage.ts` con las claves como constantes tipadas (prefijo `tc:`) y helpers get/set. Migración leyendo las claves viejas una vez.

**Esfuerzo.** Bajo (1-2 h).

---

## Resumen

| # | Principio | Hallazgo | Esfuerzo |
|---|-----------|----------|----------|
| 1 | Seiso | Clases soft/chip que no compilan (bug latente) | Bajo |
| 2 | Seiso | Bundle 831 KB sin code-split | Medio |
| 3 | Kaizen | Alta de tarea recurrente con demasiados clics | Medio |
| 4 | Seiton | Vencimientos duplicados Tablón/Calendario | Medio |
| 5 | Seiton | Atajos de teclado invisibles en la UI | Bajo |
| 6 | Seiketsu | Estados vacíos inconsistentes | Medio |
| 7 | Seiri | Undo acoplado al handler de teclado de App | Bajo |
| 8 | Seiketsu | Claves de localStorage sin convención | Bajo |

Sugerencia de orden si se aprueban: 1 (bug) → 5 → 7 → 8 → 6 → 3 → 4 → 2.
