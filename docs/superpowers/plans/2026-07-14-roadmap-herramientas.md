# Roadmap de Herramientas y Crecimiento — "la bestia premium"

> Plan estratégico (no de código). Cada ítem ejecutable genera después su propio plan detallado con TDD. Todo respeta las restricciones reales: PC sin admin, Node portable, créditos Netlify agotados en el team CONTABLE.

**Goal:** Equipar el proyecto (tooling visual + infraestructura + features) para crecer sostenido con calidad de producto de 1000 USD.

---

## A. VISUAL — lo que falta para "bestia premium"

| # | Herramienta | Qué aporta | Costo | Estado |
|---|---|---|---|---|
| A1 | **Screenshots headless (puppeteer-core + Edge)** | Ver la app de verdad antes/después de cada cambio. La causa raíz de las rondas fallidas ya está resuelta. | 0 | ✅ HECHO (scripts/shots.mjs) |
| A2 | **`motion` (framer-motion, ~30KB)** | Micro-animaciones de nivel: modales con spring, listas con stagger 30-50ms, transición de vistas, drag con física. ES la diferencia sensorial entre "app web" y "producto premium". | npm install | PRÓXIMO — mayor impacto percibido |
| A3 | **`sonner`** | Toasts premium apilables (reemplaza el toast casero del undo y los mensajes inline "Guardado."). | npm install | Alto valor, barato |
| A4 | **Base UI (ya instalado) para Dialog/Tooltip/Dropdown** | Modales accesibles con focus-trap, animación de entrada, tooltips reales en el grafo y KPIs. Hoy los modales son divs caseros. | 0 (ya en package.json) | Refactor gradual |
| A5 | **shots.mjs ampliado**: dark mode + viewport móvil (375px) + todas las vistas | QA visual completo en 1 comando; detectar quiebres responsive que hoy nadie mira. | 0 | Rápido |
| A6 | Logo oficial exacto | El SVG actual es recreación. Si Valentino exporta el vectorial real (o pasa un PNG en alta), se incrusta pixel-perfect. | pedirlo | Bloqueado por usuario |

**NO recomendado (YAGNI):** librerías de charts (Recharts/visx) — los SVG propios rinden y pesan 0; tema custom fonts display — Inter variable ya es correcta; Storybook — overkill para 1 dev.

## B. INFRAESTRUCTURA — crecer sin fricción

| # | Herramienta | Qué resuelve | Estado |
|---|---|---|---|
| B1 | **GitHub remoto (privado) + deploy automático** | Mata el zip manual Y el problema de créditos: **Cloudflare Pages** (gratis ilimitado: builds y bandwidth sin cuota como Netlify) conectado al repo. Cada `git push` = deploy. El proxy ARCA se migra de `_redirects` a una Pages Function de 10 líneas. Netlify queda de backup. | PRÓXIMO — es la base de todo lo demás |
| B2 | **Supabase CLI types codegen** | `supabase gen types typescript` → tipos generados desde la DB real en vez de a mano (types.ts). Menos drift. | Con B1 (se corre en CI) |
| B3 | **Sentry (free tier)** | Errores de producción visibles: si a un empleado se le rompe algo, lo sabés antes de que lo reporte. | Post B1 |
| B4 | **pre-commit hook** (oxlint + tsc + vitest) | El gate manual actual, automático. | Trivial con B1 |
| B5 | migracion-12 + Edge Function crear-usuario | Altas de usuario desde la app (la UI ya está lista). | 10 min del usuario en dashboard Supabase |

## C. FUNCIONALIDADES — el crecimiento

| # | Feature | Valor | Requiere |
|---|---|---|---|
| C1 | **Multi-área** (migracion-13: tabla `areas` + `area_id` + rol `dueño` + reporte cross-área) | LA visión: replicar a RRHH/compras y darle al dueño su vista. Es lo que convierte el tablero en plataforma. | Plan propio + migración SQL |
| C2 | **Notificaciones por email** (Edge Function cron + Resend free 100/día) | "Te vence mañana IVA" en la casilla → el tablero trabaja solo. Enorme valor percibido por jefes. | B5 hecho; emails reales del equipo |
| C3 | **Plantillas de cierre mensual** | Un click genera el set de tareas recurrentes del cierre (IVA, sueldos, F931, conciliaciones) con deps prearmadas. Kaizen/Seiketsu puro: estandarización. | Nada — solo desarrollo |
| C4 | **Vista "Mi semana" con agenda** | Planificación semanal drag & drop de tareas a días. | A2 (animaciones drag) |
| C5 | PWA instalable (manifest + service worker) | Ícono en el celular del equipo, abre como app nativa. | 1 tarde |

## Orden recomendado (por dependencias y valor)

1. **B1 GitHub + Cloudflare Pages** — desbloquea deploys ilimitados gratis (adiós problema de créditos) y CI.
2. **A2+A3 motion + sonner** — el salto sensorial premium visible en la reunión.
3. **C3 Plantillas de cierre** — feature estrella para validar con el equipo contable + narrativa 5S.
4. **B5 + C2** — crear usuarios + notificaciones (el tablero "vivo").
5. **C1 Multi-área** — la expansión, con el dueño como stakeholder.

## Global Constraints
- Sin admin: todo npm local o servicios cloud free-tier. Zips con python -m zipfile mientras existan.
- Cero emojis, Lucide only, paleta negro/blanco/azul Paris, verificación visual con shots.mjs SIEMPRE.
- Gates: tsc + vitest + build + screenshot antes de cada merge.
