# Tablero Contable — Grupo Paris · Estado y Propuesta

> Documento vivo (Kaizen). Última actualización: 15/07/2026.
> Objetivo: dejar sentada la **base premium** del proyecto y el camino de crecimiento.

---

## 1. Estado actual (qué hay hoy)

### Infraestructura — sólida
| Pieza | Estado |
|---|---|
| Stack | React 19 + TypeScript + Vite + Tailwind + Supabase (Postgres + Auth + Edge Functions) |
| Repo | GitHub privado `Valentinomagni/tablero-contable-grupo-paris` (rama `main`) |
| Deploy | **Cloudflare Pages** conectado — cada `git push` a `main` = deploy automático, gratis e ilimitado. Adiós al zip manual y a los créditos de Netlify. |
| Proxy ARCA | Pages Function `functions/arca-xml.js` (vive junto al `_redirects` de Netlify de respaldo). |
| Calidad | `tsc` + `vitest` (11 archivos de test en `src/lib`) + `oxlint` + hook `pre-commit`. Build pasa limpio. |

### Funcionalidad — completa para el uso diario
Solapas activas: **Resumen · Reporte ejecutivo · Tablón · Calendario · Bitácora · Administración**, más vistas por persona, Objetivos, Mi Mes, Semana y Plantilla de Cierre.
Roles: Jefe / Encargado / Empleado con permisos diferenciados (jefes editan, empleados leen/operan lo suyo).

### Diseño visual — **corregido hoy** (el punto que venía fallando)
- **Antes:** modo oscuro azul (`#14181f` fondo, `#7da3d8` acento) + avatares en 6 tonos de azul. Eso era lo "genérico/barato".
- **Ahora:** sistema **monocromo puro alineado a la marca** (el logo es 100% B&N):
  - **Oscuro:** negro grafito real `#0b0b0c`, superficies `#161618`, texto blanco hueso, acento plata `#e4e4e7`. **Cero azul.**
  - **Claro:** blanco `#ffffff` sobre gris neutro `#f6f6f7`, acento negro, botones negros.
  - **Color solo en estados:** verde = hecho, rojo = vencido, ámbar = por vencer. Nada de arcoíris.
  - Avatares pasados a escala grafito.
- Verificado en navegador (claro + oscuro) y por CSS computado. Es el look "Linear / Apple": imposible que se vea barato.

---

## 2. Cómo el programa YA encarna las 5S y Kaizen (y dónde reforzarlo)

La filosofía no debe ser un texto bajo el login: debe **verse en cómo funciona**. Mapeo real:

| Principio | Dónde ya vive | Cómo profundizarlo (propuesto) |
|---|---|---|
| **整理 Seiri — Clasificar** (separar lo necesario) | Filtros por persona/estado | Bandeja "Archivo": ocultar automáticamente tareas terminadas + obsoletas; el Resumen muestra solo lo que requiere acción hoy. |
| **整頓 Seiton — Ordenar** (un lugar para cada cosa) | **Command Palette** (Ctrl+K) ya implementado; navegación consistente | Que TODO sea alcanzable en ≤1 clic o 1 atajo. Documentar los atajos en la propia app. |
| **清掃 Seiso — Limpiar** (limpieza = detectar problemas) | Estética monocroma limpia, estados vacíos | Indicador de "tablero limpio" (0 vencidas) y un chequeo de cierre diario. |
| **清潔 Seiketsu — Estandarizar** | **Plantilla de Cierre** ya existe | Convertirla en *la* solapa estrella: un clic genera el set mensual (IVA, sueldos, F931, conciliaciones) con dependencias prearmadas. |
| **躾 Shitsuke — Disciplina** | **Bitácora** (línea de tiempo de actividad) | Un **score de adherencia** por persona/equipo en el Resumen: % de tareas cerradas en fecha, racha de días sin vencidas. |
| **改善 Kaizen — Mejora continua** | Reporte ejecutivo | Deltas semana-contra-semana (▲/▼) en los KPIs + un registro de "mejoras aplicadas". |

**Conclusión de la corroboración:** la arquitectura ya respeta la filosofía en el 70%. Lo que falta no es reescribir: es **hacer visible** lo que ya hay (framing 5S en la UI) y agregar 2 features de disciplina/estandarización.

---

## 3. Propuesta de cambios

### 3.1 Visual (siguiente nivel premium — bajo esfuerzo, alto impacto)
1. **`motion` (framer-motion, ~30KB):** micro-animaciones — modales con spring, listas con stagger 30-50ms, transición entre vistas. **Es la diferencia sensorial entre "web" y "producto de $1000".** (Mayor impacto percibido.)
2. **`sonner`:** toasts premium apilables (reemplaza los mensajes inline "Guardado." y el toast casero del undo).
3. **Tipografía de números tabulares** ya está; sumar **jerarquía**: KPIs con número grande + etiqueta chica + delta Kaizen.
4. **Densidad y aire:** revisar paddings de las tarjetas del Resumen para que respiren (Seiso).
5. **Estados vacíos con intención:** cada vista vacía comunica "limpio", no "roto".

### 3.2 Código (deuda técnica sana)
1. **Code-splitting:** el bundle JS es 714KB (>500KB warning). Cargar vistas pesadas con `import()` dinámico → arranque más rápido.
2. **Tipos generados desde Supabase** (`supabase gen types`) en vez de `types.ts` a mano → menos drift.
3. **Sentry (free):** ver errores de producción antes de que un empleado los reporte.
4. **Ampliar `shots.mjs`** a dark + móvil (375px) + todas las vistas → QA visual en un comando.

### 3.3 Próxima solapa funcional (recomendada)
**"Cierre Mensual" (Seiketsu + Kaizen) — la de mayor valor para mostrar a jefes:**
- Un checklist guiado del cierre contable del mes, generado de un clic desde la plantilla existente.
- Barra de progreso del cierre (12/18 tareas), con dependencias (no podés cerrar IVA sin conciliar banco).
- Al terminar el mes, un resumen "cerramos en X días, Y% en fecha" → narrativa Kaizen pura.

Alternativa de expansión estratégica: **Multi-área** (RRHH/Compras con el dueño como stakeholder) — convierte el tablero en plataforma. Requiere migración SQL propia; dejarla para después del Cierre Mensual.

### 3.4 Inspiración a mirar (referencias premium monocromas)
- **Linear** (linear.app) — el estándar de dashboard monocromo con micro-animaciones.
- **Vercel / Stripe dashboard** — jerarquía de datos y aire.
- **Height, Retool** — tableros de trabajo densos pero elegantes.
- **Arc / Raycast** — command palette y atajos como ciudadanos de primera (Seiton).

---

## 4. Orden recomendado (por valor y dependencias)
1. ✅ **Paleta monocroma premium** — hecho hoy (esta corrección).
2. **`motion` + `sonner`** — el salto sensorial visible en la reunión.
3. **Solapa Cierre Mensual** — feature estrella + narrativa 5S/Kaizen concreta.
4. **Score de adherencia (Shitsuke) + deltas Kaizen** en el Resumen.
5. **Code-split + Sentry + types codegen** — robustez para crecer.
6. **Multi-área** — la expansión con el dueño como stakeholder.

---

## 5. Restricciones que respeta todo lo anterior
- PC sin permisos de admin: todo con Node portable o servicios cloud free-tier.
- Cero emojis en UI (solo íconos Lucide). Estética negro/blanco/gris de marca.
- Verificación visual (`shots.mjs` / preview) antes de cada merge. Gates: `tsc` + `vitest` + build + screenshot.
