# Limpieza — agosto 2026

Revisión de qué está muerto de verdad en el repositorio, hecha con `knip` y con una lectura
documento por documento de `docs/`.

**El criterio que mandó sobre todo:** un documento no se borra por tener fecha vieja. Casi todo
lo que hay en `docs/` es el **registro de por qué se decidió algo**, y eso no vence. Perder ese
registro hace que la misma idea descartada se vuelva a proponer cada seis meses, y que la
discusión se dé de nuevo sin los argumentos que ya se habían encontrado. Ante la duda, se dejó
el documento y se escribió acá el motivo.

---

## 1. Qué se sacó

| Qué | Motivo | Dónde vive ahora lo que valía |
|---|---|---|
| `docs/ESTADO-Y-PROPUESTA.md` | Documento de **estado** del 15/07/2026, fácticamente superado. Decía "11 archivos de test" y "63 tests verdes" (hoy son 1158 en 103 archivos), daba el bundle en 714 KB antes del code-split, y listaba como "PRÓXIMO" cosas que están hechas hace semanas. Además duplicaba el rol de `docs/ESTADO-DEL-PROYECTO.md`, que `CLAUDE.md` §9 declara como la única fuente de verdad de qué falta: dos documentos de estado en desacuerdo es peor que uno solo. | Estado y pendientes: `docs/ESTADO-DEL-PROYECTO.md`. Paleta monocroma y decisiones visuales: `docs/SISTEMA-VISUAL.md`. Mapeo 5S/Kaizen y propuestas de mejora: `docs/AUDITORIA-5S-KAIZEN.md` y `docs/PROPUESTAS-MEJORA.md`. |

Un detalle que pesó en la decisión: ese documento recomendaba un **"score de adherencia por
persona"** en el Resumen. Eso hoy es exactamente lo que el proyecto **no** hace — las métricas
describen procesos, nunca juzgan personas, y hay tests que lo verifican. Dejarlo escrito como
recomendación vigente era un riesgo concreto de que alguien lo volviera a implementar.

No se borró ningún otro archivo, ni de `docs/` ni de código.

---

## 2. Qué se dejó a propósito, aunque parezca legado

Todos estos tienen fecha vieja y **ninguno se borra**.

| Documento | Por qué se queda |
|---|---|
| `docs/PROPUESTA-ICR.md` | Es lo que sostiene **por qué no hay cronómetro en vivo**. El cronómetro se volvió a pedir el 04/08/2026 y se volvió a rechazar apoyándose en este análisis. También explica por qué la tabla `card_pausas` está creada y vacía a propósito. Sin este documento, el pedido vuelve y hay que rehacer el razonamiento entero. |
| `docs/PROPUESTAS-ADOPCION.md` | Registro de las propuestas de adopción con su estado. Incluye las que están **descartadas con motivo** (P7 costo colectivo, P8 ranking) y las dos que siguen abiertas (P6 recordatorio contextual, P10 sincronizar antes de la reunión). Es el índice de "esto ya se pensó". |
| `docs/SISTEMA-VISUAL.md` | Referencia activa, con dos tests guardianes que dependen de lo que dice. |
| `docs/ACCESO-Y-PERMISOS.md` | Referencia activa: pasos de despliegue de la Edge Function `blanquear-clave`, que sigue pendiente. |
| `docs/SEGURIDAD.md` | Referencia activa del modelo de permisos y de los agujeros ya cerrados. |
| `docs/PASOS-MANUALES.md` | Sigue siendo la cola operativa de migraciones y pasos de Supabase. `docs/SEGURIDAD.md` lo referencia. La cabecera está desactualizada (habla de 135 tests), pero el contenido se usa. |
| `docs/FIX-EDGE-FUNCTION.md` | El diagnóstico puntual ya se resolvió, pero el documento describe **el flujo de despliegue de una Edge Function** en esta cuenta de Supabase, y esa trampa (el "Hello World" que no se reemplazó) se puede repetir con `blanquear-clave`. |
| `docs/PROPUESTA-PERIODOS.md` | El modelo de períodos ya está implementado, pero este documento explica **por qué se eligió la alternativa C** (`cards` / `card_periodos` / `task_occurrences`) y qué se descartó. Es la justificación del esquema que se usa todos los días. |
| `docs/PROPUESTA-CIERRE-MENSUAL.md` | El rediseño del cierre unificado **todavía no se implementó**: es una decisión abierta, no un documento vencido. |
| `docs/PROPUESTAS-2026-08.md`, `docs/PROPUESTAS-SPEC-28.md`, `docs/PROPUESTAS-MEJORA.md`, `docs/KAIZEN-HALLAZGOS.md`, `docs/AUDITORIA-5S-KAIZEN.md`, `docs/AUDITORIA-MODULOS.md` | Propuestas y auditorías con estado por ítem, incluido lo rechazado y su motivo. Sirven para no reproponer y para saber qué se miró y no era. |
| `docs/TOOLING-UPGRADES.md`, `docs/TOOLING.md`, `docs/STACK.md`, `docs/FLUJO-DEV.md`, `docs/RELEASE.md`, `docs/DEPLOY-GITHUB-CLOUDFLARE.md`, `docs/BACKUP-RESTORE.md`, `docs/PWA-REINSTALL.md`, `docs/CONSULTAS-PARA-ANALISIS.md` | Documentación operativa en uso. |
| `migracion-13-*.sql` … `migracion-37-*.sql`, incluido `migracion-14-FIX-URGENTE-recursion.sql` | Las migraciones aplicadas no se borran: son el historial del esquema y hay que poder releerlas para entender por qué una policy está como está. |

### Exportaciones que `knip` marca sin uso y se dejan

`knip` reporta 10 exportaciones y 16 tipos sin usar. Se revisaron y **no se tocan**:

- `MIGRACION_PERIODOS`, `MIGRACION_ADMIN_SISTEMA`, `MIGRACION_CHECKLIST_DIARIO`,
  `CAMPOS_ADMIN_SISTEMA_PROFILES` en `src/lib/esquema.ts` son parte del gateado defensivo y de
  su documentación; sacarlos deja el archivo sin explicar de dónde sale cada columna.
- `UMBRAL_ALTA` / `UMBRAL_MEDIA` (`confianza-metrica.ts`), `LECTURA_ICR` (`icr.ts`) y los tipos
  (`TipoDeFalla`, `PasoCierre`, `CardPausa`, etc.) son vocabulario del dominio que usan los
  tests y las firmas públicas.
- Los "duplicate exports" (`Componente|default`) son el patrón de export nombrado + default que
  necesita el code-split con `import()` dinámico. No es duplicación real.

---

## 3. Qué sigue bloqueado

### Las 6 dependencias sin usar — bloqueadas, no pendientes

`@base-ui/react`, `class-variance-authority`, `clsx`, `shadcn`, `tailwind-merge`,
`tw-animate-css`. `knip` las confirma sin un solo import.

**No se pueden sacar, y no hace falta volver a evaluarlo.** En esta máquina **no hay npm**, así
que no se puede regenerar `package-lock.json`. Modificar `package.json` sin regenerar el lock
deja los dos archivos desincronizados y el `npm ci` del CI falla en el próximo push. El costo de
dejarlas es cero en el bundle (nadie las importa, no entran en el build); el costo de sacarlas a
mano es romper la integración continua.

**Se retoma únicamente si aparece npm en la máquina.** Hasta entonces, cada auditoría las va a
volver a listar: es esperable y no es un hallazgo nuevo.

### Otros bloqueos, para que consten

- **Edge Function `blanquear-clave` sin desplegar.** El botón existe y da error hasta que se
  despliegue. Depende del usuario. Pasos en `docs/ACCESO-Y-PERMISOS.md`.
- **`mv_resumen_mensual`**: la vista materializada existe y nadie la usa. Le faltan `sucursal`,
  `categoria` y el filtro de operativas. Arreglarla es una migración nueva.
- **`card_pausas`**: creada y vacía **a propósito**. Depende del cronómetro, que
  `docs/PROPUESTA-ICR.md` desaconseja.
- **`migraciones-pendientes.sql` (raíz)**: el archivo agrupa las migraciones 32 a 35, que ya
  están aplicadas, así que el nombre miente. **No se borró** porque es un archivo operativo del
  usuario y la decisión de descartarlo no es técnica. Queda anotado acá: lo único realmente
  pendiente hoy es la migración 37, que está en su archivo suelto
  `migracion-37-reinicio-mensual-manual.sql`.
- **Sugerencias de configuración de `knip`** (`public/sw.js`, `functions/**`,
  `edge-function-eliminar-usuario.ts` en la lista de ignorados, y `src/main.tsx` redundante en
  entries). Son ajustes cosméticos del `knip.json` que cambian la salida de la auditoría sin
  cambiar nada del producto; se dejan para no tocar la configuración de un chequeo que hoy anda.
