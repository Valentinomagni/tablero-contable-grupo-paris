# Spec 28 — Fase D: escalabilidad, seguridad y analítica avanzada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 3 bugs reportados, incorporar etiquetas y datos estratégicos de empresas, analítica de operativas, cronómetro con pausas, y arrancar la etapa de seguridad con un análisis justificado antes de instalar nada.

**Architecture:** Misma arquitectura. Una migración nueva (31) agrupa el esquema: etiquetas, empresas, pausas del cronómetro. El organigrama se corrige rediseñando la construcción del árbol (la marca deja de ser partición). El ICR y el análisis de seguridad son documentos, no código, hasta que el usuario apruebe.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Supabase (Postgres + RLS), vitest, Lucide.

## Global Constraints

- **Foco del producto:** NO es un ERP, NO duplica Quiter (conciliaciones, proveedores, facturación, gestión comercial, registraciones). Antes de cada tarea: *¿ayuda a organizar, controlar o analizar el trabajo del equipo?*
- **Cero emojis**; estética monocroma; **español rioplatense (voseo)**.
- Las migraciones 26-30 YA están aplicadas en producción. **El trigger de notificaciones sigue APAGADO** (paso manual pendiente del usuario) — no lo toques.
- Escrituras de columnas nuevas SIEMPRE por `payloadCards`/`payloadProfiles` de `src/lib/esquema.ts`, y agregá las columnas nuevas a `COLUMNAS_CARDS` si corresponde.
- **TDD** para `src/lib/*`. Gates: `tsc -b` + vitest. Tests base: **666**.
- **Encuadre no punitivo** en todo lo que mida personas: el sujeto es el dato o la situación, nunca la persona. Nada de etiquetas pegadas al nombre.
- **El cronómetro (item 10) NO se implementa hasta que el usuario apruebe la propuesta del ICR** (Task 11 produce el documento; la implementación es Task 12 y está condicionada).
- **Seguridad (item 4): analizar y justificar ANTES de instalar.** El entregable es un documento con recomendación, no una instalación.
- Changelog v2.7.0 antes del push final. Rama `dev`; merge a `main` en la task final.
- **Un solo subagente escribiendo por vez.**

---

### Task 1: Corregir el organigrama (item 1)

**Diagnóstico ya hecho, no lo repitas:** `src/features/organigrama/Organigrama.tsx` hace `porMarca(team)` y recién después `construirArbol(gente)` **dentro de cada grupo**. Como el árbol se construye sobre un subconjunto, `esRaiz(p) = manager_id === null || !idset.has(manager_id)` se dispara para cualquiera cuyo jefe esté en OTRA marca. Juan (Gerente General, marca "General") es jefe de gente de Peugeot/Honda, así que en la sección "Peugeot" desaparece y sus reportes quedan como raíces.

**Files:** Modify `src/features/organigrama/Organigrama.tsx`, `src/lib/jerarquia.ts` + test

**Interfaces:**
- Produces: `construirArbol` sin cambios (ya es correcta sobre un set completo). Nueva: `arbolConAncestros(profiles: Profile[], filtroMarca: string | null): NodoOrg[]` — si `filtroMarca` es null devuelve el árbol completo; si no, devuelve el árbol de las personas de esa marca **arrastrando siempre la cadena completa de superiores** (aunque sean de otra marca).

- [ ] **Step 1: Tests que fallan** — jerarquía cruzada: Juan (General) es manager de Ana (Peugeot); filtrando por "Peugeot", Juan debe aparecer como raíz con Ana colgando. Dos jefes generales sin manager → dos raíces legítimas. Un encargado que solo ve su subárbol → su propio nodo como raíz. Ciclo imposible por el guard existente.
- [ ] **Step 2: Implementar** `arbolConAncestros` en `jerarquia.ts`.
- [ ] **Step 3: Rediseñar la vista** — UN solo árbol global. La marca pasa a ser **etiqueta en cada nodo** (chip con `MarcaIcon`), no partición. Agregá un selector de marca opcional arriba que use `arbolConAncestros` para filtrar sin romper la jerarquía.
- [ ] **Step 4: Verificá el caso del usuario** — con 4 integrantes y Juan como máxima autoridad, Juan debe verse SIEMPRE, desde cualquier filtro.
- [ ] **Step 5: Gates + commit** — `fix(organigrama): un solo árbol jerárquico con la marca como etiqueta`

---

### Task 2: Filtros de marca y sucursal en Resumen (item 2)

**Files:** Modify `src/features/resumen/Resumen.tsx`

Reusá `filtrarPorSegmento` de `src/lib/segmento.ts` y el patrón EXACTO de selects de `src/features/reporte/Reporte.tsx` (incluido el reseteo de sucursal al cambiar marca). Aplicá el filtro antes de calcular las métricas, y filtrá también el equipo (`teamSeg`) como hace el Reporte, para que la dotación sea coherente.

Commit `feat(resumen): filtros por marca y sucursal`.

---

### Task 3: Corregir el buscador rápido (item 3)

**Diagnóstico ya hecho:** `src/components/CommandPalette.tsx:30` tiene `if (isJefe) team.forEach(...)` — la lista de personas está gateada por rol, así que **encargados y empleados no ven ninguna persona**.

**Files:** Modify `src/components/CommandPalette.tsx`

- [ ] **Step 1: Quitar el gate** y alimentar la lista con `team` (que ya viene acotado por `visiblesPara` según el rol). El alcance lo define el scope, no un `if`.
- [ ] **Step 2: Reproducir el síntoma puntual** que reportó el usuario ("no aparecen los encargados") logueado como jefe. Si con el gate quitado ya aparecen, documentalo. Si persiste, investigá `visiblesPara`/`personasVisibles` y arreglá la causa real.
- [ ] **Step 3: Gates + commit** — `fix(buscador): todas las personas del alcance, sin importar el rol`

---

### Task 4: Migración 31 — etiquetas, empresas y pausas

**Files:** Create `migracion-31-etiquetas-empresas.sql`; Modify `src/lib/types.ts`, `src/lib/esquema.ts` (`COLUMNAS_CARDS`), `docs/PASOS-MANUALES.md`

**Produces:**
- `cards.etiquetas text[] default '{}'` — múltiples etiquetas por tarea, independientes de `categoria`.
- Tabla `empresas (id, nombre, cuit, cierre_balance, reporta_fabrica boolean, prioridad int, created_at)` con RLS: SELECT authenticated, INSERT/UPDATE/DELETE solo `es_jefe()`.
- Tabla `card_pausas (id, card_id, owner, desde, hasta)` para el cronómetro, con RLS propio/jefe/encargado. **Se crea ahora aunque el cronómetro esté condicionado a la aprobación del ICR** — la tabla vacía no molesta y evita una migración extra después.
- Autoregistro id 31 con el patrón de las anteriores.

Idempotente, en cualquier orden respecto de 26-30. Commit `feat(datos): migración 31 — etiquetas, empresas y pausas`.

---

### Task 5: Etiquetas en tareas (item 5)

**Files:** Create `src/lib/etiquetas.ts` + test; Modify `src/features/board/card/MetaSection.tsx`, `src/features/board/Board.tsx`, `src/components/CommandPalette.tsx`

**Produces:** `etiquetasEnUso(cards): string[]` (únicas, orden es-AR); `pasaFiltroEtiquetas(card, filtro: string[]): boolean` (AND: la card debe tener todas las del filtro; filtro vacío → true); `normalizarEtiqueta(s): string` (trim, sin duplicar por mayúsculas).

Las etiquetas son **contextuales** (Peugeot, Autocity, Empresa X), distintas de la categoría (que es el tipo de trabajo). Múltiples por tarea. UI: input con datalist de las en uso + chips removibles. Filtro por etiqueta en el tablero. Búsqueda: incluir etiquetas en el CommandPalette.

Commit `feat(etiquetas): etiquetas múltiples por tarea, filtrables y buscables`.

---

### Task 6: Mejorar avisos archivados (item 6)

**Files:** Modify `src/features/tablon/Tablon.tsx`

En "Archivados y Vencidos": **desarchivar** (ya existe `setArchivado`, exponelo ahí) y **eliminar definitivamente** con confirmación previa (la policy DELETE existe desde la migración 27, y `puedeEliminarAnuncio` ya está en `src/lib/anuncios.ts`). Seguí el patrón de confirmación inline ya usado en ese archivo.

Commit `feat(tablon): desarchivar y eliminar avisos archivados`.

---

### Task 7: Simplificar el scrap de ARCA (item 7)

**Files:** Modify `src/lib/arca-filtro.ts` + test, `src/features/tablon/arca.tsx`, y los consumidores en Login, Calendario y Tablón

Conservar **únicamente IVA y Libro IVA Digital**, mostrando solo sus vencimientos. Aplicar la misma simplificación en Login, Calendario y Tablón: evitar información repetida o irrelevante. Relevá primero qué muestra cada uno hoy y documentá qué sacaste.

Commit `feat(arca): mostrar solo IVA y Libro IVA Digital`.

---

### Task 8: Información estratégica de empresas (item 8)

**Files:** Create `src/lib/empresas.ts` + test, `src/features/admin/Empresas.tsx`; Modify `src/features/admin/Admin.tsx`, `src/hooks/useData.ts`

**Produces:** `prioridadEmpresa(e: Empresa): number` — las que reportan a fábrica pesan más que las que no; `ordenarEmpresas(es): Empresa[]`.

CRUD en Administración **solo para jefe** (la RLS lo refuerza). Campos: nombre, CUIT, fecha de cierre de balance, reporta a fábrica, prioridad operativa. **Foco:** esto es parametrización para priorizar trabajo, NO un maestro de clientes tipo ERP — no agregues domicilio, contactos, condición de IVA ni nada que empiece a competir con Quiter.

Commit `feat(empresas): datos estratégicos para priorizar el trabajo`.

---

### Task 9: Analítica de tareas operativas (item 9)

**Files:** Create `src/lib/analitica-operativas.ts` + test; Modify `src/features/reporte/AnalisisMensual.tsx`

**Produces:** `analiticaOperativas(cards, activity, profiles, desdeISO, hastaISO)` → por empleado (cantidad ejecutada, tiempo invertido si hay dato), por tipo de tarea (frecuencia, duración promedio, distribución), y cruzado empleado × tipo (carga operativa, evolución).

Usa `ActivityLog` (qty por card/owner/fecha) y las cards operativas. Excluye no visibles con `archivesParaMetricas`/`esVisible` según corresponda. **Encuadre:** el objetivo es detectar tareas que consumen tiempo excesivo y oportunidades de mejora del proceso, no comparar personas.

Commit `feat(analisis): analítica de tareas operativas`.

---

### Task 10: Documento de seguridad (item 4) — SOLO ANÁLISIS

**Files:** Create `docs/SEGURIDAD.md`

**No instalar nada.** Análisis justificado, con el estado actual relevado del código real: RLS por rol, `es_jefe()`/`es_encargado_de()`, trigger de campos sensibles en `profiles`, CI con tests y e2e, `scripts/rls-smoke.mjs`, Sentry (P11) bloqueado esperando DSN.

Cubrir las 11 áreas del spec (autenticación, autorización, protección de datos, validaciones, auditoría, registros de actividad, monitoreo, seguridad del código, seguridad de dependencias, errores comunes, resiliencia), con criterio de +200 usuarios. Por cada herramienta candidata: qué problema real resuelve **en este proyecto**, costo, complejidad, y una recomendación explícita de **implementar / descartar / esperar**. Sé honesto: si algo no aporta valor real acá, decilo y descartalo.

Commit `docs(seguridad): análisis de herramientas con recomendación justificada`.

---

### Task 11: Documento del ICR y confiabilidad del dato (item 10 previo) — SOLO ANÁLISIS

**Files:** Create `docs/PROPUESTA-ICR.md`

El usuario ya desarrolló la idea: un **Índice de Calidad del Registro** separado de la productividad, que mida qué tan fielmente el sistema representa el trabajo, no cuánto trabaja cada uno. Sus 7 mecanismos complementarios están en `docs/superpowers/plans/2026-07-21-28D-PARKED-*.md` — leelos y desarrollalos.

**Restricción que gobierna todo el documento (palabras del usuario):** *"El objetivo no es controlar personas, sino obtener información útil y representativa para mejorar los procesos de trabajo."* Cada mecanismo debe evaluarse por su **riesgo de leerse como vigilancia**, y hay que desaconsejar los que crucen esa línea aunque sean fáciles. Conectar con `docs/PROPUESTAS-ADOPCION.md`.

Cerrar con: fórmula concreta propuesta para el ICR, qué se muestra y a quién, y las 3 que recomendás empezar. **Este documento es el gate del cronómetro (Task 12).**

Commit `docs(icr): propuesta de índice de calidad del registro`.

---

### Task 12: Cronómetro con pausas (item 10) — CONDICIONADA

**Solo se ejecuta si el usuario aprueba la propuesta de la Task 11.** Si no hay aprobación explícita, esta task NO se implementa y se documenta como pendiente.

**Files:** Create `src/lib/cronometro.ts` + test; Modify `src/features/board/card/MetaSection.tsx`

**Produces:** `tiempoNeto(procAt, pausas, ahoraISO, doneAt): number` (horas efectivas, excluyendo pausas); `pausaAbierta(pausas): Pausa | null`.

Cronómetro que arranca al pasar a "En proceso" (ya existe `proc_at`), con pausar/reanudar sobre `card_pausas`. Muestra tiempo transcurrido y acumulado. Alimenta los indicadores existentes de tiempo máximo.

Commit `feat(cronometro): tiempo neto con pausas`.

---

### Task 13: Cierre de la Fase D

- [ ] Changelog **2.7.0**.
- [ ] Gates completos.
- [ ] Review final transversal: los 3 bugs realmente corregidos (verificá el caso concreto del usuario en el organigrama); etiquetas vs categorías sin confusión; foco de producto (empresas es el limítrofe — que no se haya ido a maestro de clientes); encuadre no punitivo en la analítica de operativas.
- [ ] Fix de hallazgos en un solo subagente.
- [ ] Merge `dev` → `main` y push, con resumen.

---

## Self-Review
- **Cobertura:** item 1 → T1; 2 → T2; 3 → T3; 4 → T10 (doc); 5 → T5; 6 → T6; 7 → T7; 8 → T8; 9 → T9; 10 → T11 (doc) + T12 (condicionada); esquema → T4; release → T13. ✔
- **Sin placeholders:** cada task tiene archivos y firmas; los diagnósticos de T1 y T3 ya están hechos y se implementan, no se re-investigan. ✔
- **Foco:** ninguna task agrega funcionalidad de ERP. Empresas se acota explícitamente a parametrización de prioridad. ✔
