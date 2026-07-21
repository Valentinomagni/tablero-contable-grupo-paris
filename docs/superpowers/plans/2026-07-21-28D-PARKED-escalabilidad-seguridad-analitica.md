# FASE D (EN COLA — no ejecutar todavía) — Escalabilidad, seguridad y analítica avanzada

> **ESTADO: PARQUEADA.** Se implementa DESPUÉS de terminar las Fases B y C del spec 28.
> Decisión del usuario del 21/07/2026.

**Objetivo:** soportar adopción masiva (30 → 200+ usuarios): robustez, seguridad, escalabilidad
e información **confiable** para decidir.

**Filosofía (sin cambios):** gestión de tareas, seguimiento de procesos, control operativo,
análisis de rendimiento, mejora continua. **NO es un ERP y no duplica Quiter.**

---

## Diagnósticos ya realizados (21/07) — no repetir, implementar

### Item 1 — Organigrama: CAUSA RAÍZ ENCONTRADA
`src/features/organigrama/Organigrama.tsx` hace `porMarca(team)` y recién después
`construirArbol(gente)` **dentro de cada grupo de marca**. Como el árbol se construye sobre un
subconjunto, `esRaiz(p) = p.manager_id === null || !idset.has(p.manager_id)` se dispara para
cualquiera cuyo jefe esté en OTRA marca.

Juan (Gerente Contable General, marca "General") es jefe de gente de Peugeot/Honda/etc. En la
sección "Peugeot" Juan no está en el subconjunto → sus reportes aparecen como raíces y Juan
desaparece. Ese es exactamente el síntoma reportado.

**Fix:** la marca NO puede ser una partición del árbol. Construir UN árbol global con todas las
personas visibles y usar la marca como etiqueta en cada nodo, o como filtro que **siempre
arrastre la cadena completa de superiores**. Verificar el caso de dos jefes generales (dos raíces
legítimas) y el caso de un encargado que solo ve su subárbol.

### Item 3 — Buscador rápido (Ctrl+K): CAUSA RAÍZ ENCONTRADA
`src/components/CommandPalette.tsx:30`: `if (isJefe) team.forEach(...)`. La lista de personas
está gateada por rol, así que **encargados y empleados no ven ninguna persona**, contradiciendo
el objetivo de "acceso universal a cualquier integrante".

**Fix:** quitar el gate y alimentar la lista con el alcance que corresponde a cada rol
(`visiblesPara`), no con un `if`. Reproducir además el síntoma puntual de "no aparecen los
encargados" con un jefe logueado antes de dar por cerrado el item.

---

## Alcance de la Fase D

| # | Item | Nota |
|---|------|------|
| 1 | Corregir el organigrama | Diagnóstico arriba |
| 2 | Filtros de marca y sucursal en Resumen | Reusar `filtrarPorSegmento` y el patrón de selects del Reporte |
| 3 | Corregir el buscador rápido | Diagnóstico arriba |
| 4 | **Etapa de seguridad** | Análisis justificado ANTES de instalar nada (ver abajo) |
| 5 | Etiquetas en tareas | Independientes de categoría, múltiples por tarea, filtrables y buscables |
| 6 | Avisos archivados: desarchivar y eliminar | Con confirmación previa. La policy DELETE ya existe (migración 27) |
| 7 | Simplificar el scrap de ARCA | Conservar SOLO IVA y Libro IVA Digital, con sus vencimientos. Aplicar también en Login, Calendario y Tablón |
| 8 | Información estratégica de empresas | CUIT, cierre de balance, reporta a fábrica, prioridad operativa. Solo jefe. Alimenta prioridad automática |
| 9 | Analítica de tareas operativas | Por empleado, por tipo, y cruzado: cantidad, tiempo, frecuencia, duración promedio, distribución, evolución |
| 10 | Cronómetro con pausas | Tiempo neto efectivo. **Requiere la propuesta del ICR aprobada primero** |

### Item 4 — Etapa de seguridad (criterios del usuario)
Aportar valor real, compatible con el proyecto, sin complejidad innecesaria, arquitectura
escalable, preparado para **+200 usuarios**. Áreas: autenticación, autorización, protección de
datos, validaciones, auditoría, registros de actividad, monitoreo, seguridad del código,
seguridad de dependencias, protección frente a errores comunes, resiliencia.

**Regla del usuario: justificar técnicamente cada herramienta ANTES de instalarla.** El
entregable es un documento de análisis con recomendación, no una instalación directa.

Contexto que el análisis debe considerar: ya existen RLS por rol, `es_jefe()`/`es_encargado_de()`,
trigger de campos sensibles en `profiles`, CI con tests y e2e, `scripts/rls-smoke.mjs`, y
Sentry (P11) sigue bloqueado esperando el DSN del usuario.

---

## Item 10 + calidad del dato — decisión tomada: PROPUESTA ESCRITA PRIMERO

El usuario planteó el problema central: **si el dato depende de la disciplina del usuario, los
indicadores dejan de reflejar la realidad**. Un empleado podría marcar "En proceso" recién al
terminar, generando métricas artificialmente buenas.

Su propuesta principal, a desarrollar en el documento: **Índice de Calidad del Registro (ICR)** —
un indicador separado de la productividad, que no mide cuánto trabaja una persona sino **qué tan
fielmente el sistema representa su trabajo**. Factores propuestos por el usuario:

- % de tareas que pasaron por todos los estados;
- tiempo razonable entre cambios de estado;
- cantidad de cierres tardíos;
- tareas abiertas sin actividad;
- % de tareas cerradas el mismo día en que se marcaron "En proceso";
- cumplimiento de recordatorios;
- frecuencia de actualización del tablero.

Y sus 7 ideas complementarias, todas a evaluar en el documento: índice de confiabilidad,
antigüedad de cambios de estado, alertas de hábitos (sugerir, no bloquear), separar productividad
de calidad del registro, tiempo activo real, confirmación de fin del día, tareas "olvidadas"
(con opciones continuar / finalizar / delegar / posponer con motivo).

**Restricción explícita del usuario, que gobierna todo este item:** *"El objetivo no es controlar
personas, sino obtener información útil y representativa para mejorar los procesos de trabajo."*
El documento debe evaluar cada mecanismo por su **riesgo de leerse como vigilancia**, y
desaconsejar los que crucen esa línea aunque sean técnicamente fáciles. Conecta con
`docs/PROPUESTAS-ADOPCION.md`, que ya advierte sobre lo mismo.

---

## Metodología (sin cambios)
Subagent-Driven estricto: un subagente por funcionalidad, que analiza solo lo suyo, evalúa el
impacto en el resto, respeta la arquitectura, corre las pruebas y documenta qué archivos tocó y
por qué. Review por tarea + review transversal al final de la fase.
