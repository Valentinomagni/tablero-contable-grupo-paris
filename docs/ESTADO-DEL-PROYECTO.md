# Estado del proyecto — al 30/07/2026

Documento de situación. Separa lo que depende de mí (código) de lo que depende de vos
(decisiones y acciones externas). Honesto y sin adornos.

---

## 1. Dónde estamos

- **Tablero Contable v2.10.0**, con **1102 pruebas automáticas** en 97 archivos, verdes,
  TypeScript sin errores, lint sin errores y build OK.
- **Sistema visual documentado** en `docs/SISTEMA-VISUAL.md`, con dos tests guardianes que
  impiden que se erosione.
- 36 migraciones de base de datos escritas. Las 35 y 36 ya están aplicadas.
- Repositorio en GitHub con CI (lint + tests + build + e2e en cada push) y **mantenimiento
  automático** semanal (Dependabot + auditoría de seguridad y de código sin uso).

## 2. ⚠️ Lo más importante: hay trabajo terminado que todavía NO ves

Esto es lo único urgente del documento.

### 2.1 Cuarenta commits sin publicar

Están hechos, probados y commiteados **en esta máquina**, pero no subidos. Publicar
requiere abrir GitHub Desktop en tu pantalla, y quedamos en que eso lo hago sólo cuando
me avises.

### 2.2 Tres migraciones sin correr

**`migraciones-pendientes.sql`** (raíz del repo) junta las tres en un solo archivo, listo
para pegar una vez en Supabase → SQL Editor.

| # | Qué habilita | Sin ella |
|---|---|---|
| 32 | Períodos | El selector de mes no muestra datos reales |
| 33 | Administrador del sistema | No podés ver las consultas del equipo |
| 34 | Checklist por día | Las recurrentes diarias siguen pisando el checklist |

**La 33 tiene un paso previo**: crear la cuenta en Supabase → Authentication → Users, y
poner ese email en la línea marcada dentro del archivo. Está explicado arriba de todo.

**Nada de esto rompe si no lo corrés**: la app es defensiva y se comporta como hoy.

## 3. Lo que se hizo y está esperando que lo veas

| Qué | Estado |
|---|---|
| PDF del Reporte (vista de impresión dedicada) | Hecho — **verificación visual tuya pendiente** |
| Períodos: adelantar meses, cierre con candado, checklist diario | Hecho — necesita migraciones 32 y 34 |
| Usuario fantasma + consultas fuera del jefe | Hecho — necesita migración 33 |
| Pantalla vacía al entrar | Corregido |
| Agrupar y ordenar por columna | Hecho |
| Modo Director (5 señales + recomendaciones + confianza del dato) | Hecho |
| Flujo mensual por persona y mapa de calor | Hecho |
| Mi día: retomar, tarea estancada, cerrar de un toque, Tu semana | Hecho |
| Mantenimiento automático (Dependabot + auditoría) | Hecho |
| Instructivo del equipo (14 diapositivas) | Hecho |
| Bandeja de consultas leíble fuera de la app (`node scripts/consultas.mjs`) | Hecho — necesita migración 33 |
| Recuperación de fallas (versión nueva, sin conexión, permisos) | Hecho |
| Sistema visual: escala tipográfica, foco, movimiento, esqueletos | Hecho — **mirá el tablero y el reporte**, ver 7 |
| Saneado de filas en el borde de Supabase | Hecho |
| Blanqueo de contraseña por el jefe | Hecho — **falta desplegar la Edge Function** |
| Mensajes de login que explican qué pasó | Hecho |

## 4. Pendiente MÍO (código)

1. **Decidir las variantes de `Panel` que faltan.** Medido: de 41 superficies, 18 son la
   tarjeta canónica y ya usan `Panel`. Las otras 23 son 4 o 5 superficies distintas (`p-4`,
   `p-5`, `p-8`, `px-5 py-4`, shells sin padding). Unificarlas necesita que vos mires la
   pantalla y digas cuáles son la misma cosa. Detalle en `docs/SISTEMA-VISUAL.md`.
2. **`mv_resumen_mensual`**: la vista materializada existe y **nadie la usa**. Le faltan
   `sucursal` y `categoria` y el filtro de operativas para que las métricas den bien.
   Arreglarla es una migración nueva; no la mezclé con lo demás.
3. **Propuestas de adopción que quedan**: P6 (recordatorio contextual) y P10 (sincronizar
   antes de la reunión). Diseñadas en `docs/PROPUESTAS-ADOPCION.md`.

## 5. Pendiente TUYO

1. **Desplegar la Edge Function `blanquear-clave`** — es lo único que separa el blanqueo de
   contraseñas de estar andando. Supabase Dashboard → Edge Functions → "Create function" con
   ese nombre exacto → pegar el contenido de `edge-function-blanquear-clave.ts` (raíz del
   repo) → Deploy. **Hasta que eso pase, el botón existe pero da error.** Pasos detallados en
   `docs/ACCESO-Y-PERMISOS.md`.
2. **Correr `migraciones-pendientes.sql`** (ver punto 2.2). Es lo que desbloquea todo.
3. **Avisarme para publicar** los 40 commits.
4. **Verificación visual del PDF**: Reporte → Imprimir/PDF → confirmar que la vista previa
   tiene contenido. Los tests garantizan que el documento se arma bien, **no** que el
   navegador lo imprima bien — esa es exactamente la falla que tuve la vez pasada.
5. **Si querés que analicemos las consultas juntos**: crear `.env.consultas.local` con el
   email y la contraseña de la cuenta de administración, y correr `node scripts/consultas.mjs`.
   Instrucciones en `docs/CONSULTAS-PARA-ANALISIS.md`. Depende de la migración 33.
6. **Decisiones abiertas**: ¿va el cronómetro? (desaconsejado en `docs/PROPUESTA-ICR.md`).
   ¿Sentry para monitoreo de errores? (el Error Boundary ya está preparado).
7. **Rotación de credenciales** — diferida por decisión tuya hasta salir de beta.

## 6. Bloqueado, para que conste

- **Sacar 6 dependencias que nadie usa** (`@base-ui/react`, `class-variance-authority`,
  `clsx`, `shadcn`, `tailwind-merge`, `tw-animate-css`). Verificado que no las importa
  nadie. **No hay npm en esta máquina**, así que no puedo regenerar el `package-lock.json`;
  subir el `package.json` desincronizado rompería el CI. Retomable cuando haya npm.
- **`card_pausas`**: tabla creada y vacía a propósito. Depende del cronómetro, que el
  análisis del ICR desaconseja explícitamente.

## 7. Riesgos abiertos

- **El tablero y el reporte van a verse distintos, y es lo correcto.** `--ring` estaba
  definido como un color y no como una sombra, así que `box-shadow: var(--ring),var(--shadow)`
  era CSS inválido y el navegador **descartaba la declaración entera**: cinco pantallas venían
  renderizando sin ninguna sombra y nadie lo notó en meses. Ya está arreglado. Cuando publiques
  vas a ver aparecer una línea finita de borde y una sombra suave en esas tarjetas. Miralo y
  decime si te gusta.
- **Verificación visual acumulada**: hay bastante entregado que todavía no viste
  funcionando. Los tests cubren la lógica, no la percepción. Cuanto antes corras las
  migraciones y mires, menos se acumula.
- **Deploy vs. caché**: si algo "no se ve" después de publicar, puede ser la PWA vieja
  cacheada. Cerrar y reabrir la app fuerza la última versión.
- **Adopción del equipo**: el modo de falla más probable de este proyecto no es técnico.
  Si el equipo lo percibe como control, va a trabajar "para la foto" y todos los datos van
  a ser mentira. Por eso el encuadre no punitivo está verificado por tests, y por eso hay
  propuestas (P7 costo colectivo, P8 ranking) que están descartadas a propósito.
