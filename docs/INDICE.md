# Índice — qué hay, y hasta dónde llegó cada cosa

Actualizado el 07/08/2026.

Este documento existe porque había 75 documentos en `docs/` y **no había forma de saber qué se
implementó y qué quedó a mitad de camino**. Esa era la pregunta real: *"que no quede nada sin
terminar"*.

**Regla de este archivo:** un estado sólo se escribe si se verificó. Lo que no se verificó dice
"sin verificar" — no "hecho". Un índice que miente es peor que no tenerlo, y este proyecto ya
tuvo tres documentos así.

---

## Lo que falta terminar, en una sola lista

Si sólo vas a leer una sección, es ésta.

### Depende de vos

| Qué | Dónde | Por qué importa |
|---|---|---|
| **Cambiar la contraseña de `jefe1@grupoparis.com`** | — | Estuvo en texto plano en 3 scripts. Sacarla del código no la saca del historial de git |
| Correr `migracion-38` y `migracion-39` | `db/migraciones/` | La 39 arregla notificaciones que **hoy no llegan** |
| Correr `migracion-40` | `db/migraciones/` | El `visible_to` del tablón es decorativo: cualquiera lee los avisos ajenos por la API |
| Correr `migracion-41` | `db/migraciones/` | Habilita el checklist que bloquea el cierre |
| Desplegar la Edge Function `blanquear-clave` | `edge-functions/` | El botón existe y da error hasta que se despliegue |
| Configurar `E2E_USER` y `E2E_PASSWORD` en GitHub | — | Sin eso el E2E **se saltea y el CI queda verde igual** |
| Verificar que los backups de Supabase estén activos | Dashboard → Database → Backups | En plan Free no hay ninguno |
| Publicar los commits | GitHub Desktop | — |

### Depende de mí (código)

| Qué | Dónde está el detalle | Estado |
|---|---|---|
| Los 9 hallazgos abiertos de la auditoría | `AUDITORIA-2026-08-05.md` | **Ninguno arreglado.** Los 3 primeros pueden costar datos |
| Las 6 fases del plan de calidad (A a F) | `superpowers/plans/2026-08-06-salto-de-calidad.md` | **Ninguna ejecutada** |
| Las 8 propuestas de 5S | `PROPUESTAS-5S-2026-08.md` | **Ninguna construida** — y no se construyen hasta cerrar la auditoría |
| Las 5 propuestas de agosto | `PROPUESTAS-2026-08.md` | Esperando tu aprobación |
| P6 y P10 de adopción | `PROPUESTAS-ADOPCION.md` | Diseñadas, sin construir |
| Variantes de `Panel` | `SISTEMA-VISUAL.md` | Necesita que mires la pantalla |
| `mv_resumen_mensual` | `ESTADO-DEL-PROYECTO.md` §4 | Existe y **no la usa nadie** |
| Los 6 caminos de creación de tareas | — | **Analizado, sin propuesta escrita todavía** |

---

## Dónde está cada cosa

### Estado del proyecto

| Documento | Para qué sirve |
|---|---|
| `ESTADO-DEL-PROYECTO.md` | **La fuente de verdad de qué falta.** Separado entre lo tuyo y lo mío |
| `INDICE.md` | Este archivo |
| `COBERTURA-DE-REVISION.md` | Qué área revisó quién, y qué queda sin mirar |
| `NIVEL-DEL-PROYECTO.md` | Medición del proyecto. **Números vencidos** — actualizar |

### Propuestas

| Documento | Contenido | Hasta dónde llegó |
|---|---|---|
| `PROPUESTA-PERIODOS.md` | Alternativa C: `cards` / `card_periodos` / `task_occurrences` | **Implementada.** Es el esquema que se usa todos los días |
| `PROPUESTA-ICR.md` | Por qué NO hay cronómetro | **Decidido: no va.** Se volvió a evaluar el 04/08 y se rechazó |
| `PROPUESTA-CIERRE-MENSUAL.md` | Rediseño del cierre, alternativa A | Sin verificar |
| `PROPUESTAS-ADOPCION.md` | P1 a P10 | Parcial. P6 y P10 sin construir. P7 y P8 **descartadas a propósito** |
| `PROPUESTAS-2026-08.md` | 5 propuestas | Esperando aprobación |
| `PROPUESTAS-5S-2026-08.md` | 8 propuestas de 5S y Kaizen | **Ninguna construida** |

### Auditorías

| Documento | Qué revisó | Estado de sus hallazgos |
|---|---|---|
| `AUDITORIA-2026-08-05.md` | Seguridad, datos, encuadre | **9 abiertos.** Los 3 primeros son serios |
| `AUDITORIA-5S-KAIZEN.md` | 5S sobre el proyecto | Parcial — actualizar por ítem |
| `SEGURIDAD.md` | Análisis de seguridad | Parcial. Su ítem "IMPLEMENTAR HOY" está diferido por decisión tuya |

### Guías operativas — cómo hacer cosas

| Documento | Cuándo se usa |
|---|---|
| `ACCESO-Y-PERMISOS.md` | Alta, baja y permisos de una persona |
| `BACKUP-RESTORE.md` | Respaldar y restaurar. **El restore nunca se probó** |
| `PASOS-MANUALES.md` | Cola de migraciones y pasos de Supabase. **Se corta en la 34** |
| `COMO-INSTALAR-DEPENDENCIAS.md` | Instalar paquetes. **Ojo: ya hay npm local**, ver `CLAUDE.md` §1 |
| `CONSULTAS-PARA-ANALISIS.md` | Leer la bandeja de consultas fuera de la app |
| `RELEASE.md` | Publicar una versión |
| `PWA-REINSTALL.md` | Cuando alguien ve una versión vieja |
| `FLUJO-DEV.md` | Ramas. **La regla está muerta**: `main` va 69 commits adelante de `dev` |
| `TOOLING.md` | Comandos del proyecto |

### Referencia

| Documento | Contenido |
|---|---|
| `SISTEMA-VISUAL.md` | Tokens, escala tipográfica, `Panel`, movimiento |
| `marca/IDENTIDAD-MARCA.md` | La marca |
| `presentacion/` | El deck para la reunión y el instructivo del equipo |

### Planes

`superpowers/plans/` — **40 planes**, del 13/07 al 06/08. Cada uno lleva su fecha en el nombre.
El vigente es `2026-08-06-salto-de-calidad.md`; los anteriores son historia de cómo se llegó acá.

### Archivo

`docs/archivo/` — 10 documentos que **cumplieron su función**. No se borran: registran decisiones
que si se pierden, se vuelven a proponer cada seis meses. Pero ya no describen el presente.

Ojo con dos: `STACK.md` describe un despliegue en Netlify por zip que ya no existe, y
`ci-workflow.yml.txt` es una copia vieja de `main.yml`. Si alguien los lee buscando cómo funciona
el proyecto hoy, se equivoca.

---

## Por qué `docs/` no se reorganizó del todo

Se evaluó mover los 75 documentos a subcarpetas por tipo. **Se midió primero**: hay 259
referencias cruzadas entre ellos, desde el código y desde `CLAUDE.md`. Moverlos rompía casi todas,
y arreglarlas es una edición masiva — el mismo tipo de operación que ese mismo día rompió tres
scripts.

El beneficio habría sido un listado más lindo. El costo, 259 enlaces rotos y un día de trabajo.

**Se hizo lo que resolvía el problema real**: archivar los 10 que ya no describen el presente
(la raíz bajó de 32 a 22) y escribir este índice. El dolor no era el listado: era no saber qué
estaba terminado.
