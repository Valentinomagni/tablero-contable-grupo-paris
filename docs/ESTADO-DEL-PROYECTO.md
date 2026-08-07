# Estado del proyecto — al 04/08/2026

Documento de situación. Separa lo que depende de mí (código) de lo que depende de vos
(decisiones y acciones externas). Honesto y sin adornos.

---

## 1. Dónde estamos

- **Tablero Contable v2.13.0**, con **1198 pruebas automáticas** en 107 archivos, verdes,
  TypeScript sin errores, lint sin errores y build OK.
- **Sistema visual documentado** en `docs/SISTEMA-VISUAL.md`, con dos tests guardianes que
  impiden que se erosione.
- 37 migraciones de base de datos escritas, todas aplicadas.
- Repositorio en GitHub con CI (lint + tests + build + e2e en cada push) y **mantenimiento
  automático** semanal (Dependabot + auditoría de seguridad y de código sin uso).

## 2. ⚠️ Lo más importante: hay trabajo terminado que todavía NO ves

Esto es lo único urgente del documento.

### 2.1 Commits sin publicar: 5

Del 05 al 07/08/2026. Se publican con GitHub Desktop y quedamos en que eso lo hago sólo cuando
me avisás.

Contienen: los arreglos de la auditoría (el chip de migraciones ciego, los cuatro agujeros de
permisos, los tres podios), las migraciones 38 y 39, el plan de salto de calidad y la matriz de
cobertura de revisión.

### 2.2 Migraciones: falta una chica, la 38

Las 37 anteriores están aplicadas — la 37 la corriste el 04/08/2026. Eso desbloquea períodos,
administrador del sistema, checklist por día, el cierre de la escalada de privilegios (35) y
los permisos de encargado (36).

**Apareció una nueva, la 38, y sale de una auditoría del 05/08/2026.** No toca ningún dato:
escribe tres renglones en el índice de migraciones. Motivo, en criollo:

El chip de Administración que dice "Base de datos al día" venía revisando **sólo hasta la
migración 28**. De la 29 a la 37 no las miraba, así que mostraba el escudo verde sin haberlas
revisado — incluida la 35, que es la que cierra la escalada de privilegios. Un indicador que
sólo sabe decir que sí no distingue entre "está todo bien" y "no miré".

Al arreglarlo apareció lo segundo: a los archivos de la **35 y la 36 les faltaba la línea que
las anota** en el índice. Están aplicadas, pero el índice no se enteró. Sin la 38, el chip te
iba a decir "Faltan migraciones: 35, 36" para siempre y volver a correrlas no lo arreglaba.

### 2.3 Y hay una segunda, la 39, que sí arregla cosas que se notan

`migracion-39-cerrar-cuatro-agujeros.sql`. Cierra cuatro agujeros que encontró la auditoría del
05/08. El que más se nota en el día a día es el segundo:

1. El jefe podía darse a sí mismo acceso al canal de consultas del equipo.
2. **Un empleado no podía avisarle nada a nadie.** Delegás una tarea, la tarjeta aparece en el
   tablero del otro, y la notificación la rechaza la base. **Hoy hay notificaciones que no
   llegan**, y nunca se supo porque el error se descartaba solo.
3. Cualquiera podía publicar un aviso anónimo para toda la empresa.
4. Cualquiera podía plantar una tarea protegida en el tablero de otro.

**Qué vas a ver hasta que corras las dos**: el chip en ámbar diciendo que faltan la 35, 36, 38 y
39. Es esperable y no significa que la base esté mal — la 35 y la 36 están aplicadas, lo que
falta es el registro. Corré las dos en orden y queda verde:

```
migracion-38-registrar-35-36.sql
migracion-39-cerrar-cuatro-agujeros.sql
```

**Lo otro del lado de Supabase, que no es una migración**: desplegar la Edge Function
`blanquear-clave`. Ver el punto 1 de la sección 5.

Verificación rápida, por si querés confirmarlo:

```sql
select name, email, admin_sistema from public.profiles where admin_sistema = true;
select tablename, policyname from pg_policies
 where tablename in ('task_occurrences','activity_log') order by tablename;
```

La primera tiene que devolver sólo las cuentas de administración que pusiste vos. La segunda,
exactamente dos filas: "occ del equipo" y "activity del equipo".

## 3. Lo que se hizo y está esperando que lo veas

| Qué | Estado |
|---|---|
| PDF del Reporte (vista de impresión dedicada) | Hecho — **verificación visual tuya pendiente** |
| Períodos: adelantar meses, cierre con candado, checklist diario | Hecho y habilitado |
| Usuario fantasma + consultas fuera del jefe | Hecho y habilitado |
| Pantalla vacía al entrar | Corregido |
| Agrupar y ordenar por columna | Hecho |
| Modo Director (5 señales + recomendaciones + confianza del dato) | Hecho |
| Flujo mensual por persona y mapa de calor | Hecho |
| Mi día: retomar, tarea estancada, cerrar de un toque, Tu semana | Hecho |
| Mantenimiento automático (Dependabot + auditoría) | Hecho |
| Instructivo del equipo (14 diapositivas) | Hecho |
| Bandeja de consultas leíble fuera de la app (`node scripts/consultas.mjs`) | Hecho y habilitado |
| Recuperación de fallas (versión nueva, sin conexión, permisos) | Hecho |
| Sistema visual: escala tipográfica, foco, movimiento, esqueletos | Hecho — **mirá el tablero y el reporte**, ver 7 |
| Saneado de filas en el borde de Supabase | Hecho |
| Blanqueo de contraseña por el jefe | Hecho — **falta desplegar la Edge Function** |
| Mensajes de login que explican qué pasó | Hecho |
| Historial de una tarea acotado al período que se está mirando | Hecho |
| Al crear una tarea, elegir si es de una sola vez o si se repite (por defecto, una sola vez) | Hecho |
| "En qué anda el equipo": qué tiene abierto cada persona y desde cuándo, para jefe y encargado | Hecho |
| Criterio de orden configurable (vencimiento, prioridad, tareas que esperan, rapidez) con el motivo explicado | Hecho |
| Arranque más liviano: se sacó la librería de animación que se usaba en una sola pantalla | Hecho |
| Presupuesto de peso de arranque, verificado en cada push (falla el CI si se pasa) | Hecho |
| Pruebas de las tres pantallas donde un error duele más (tablero, en qué anda el equipo, blanqueo de clave) | Hecho |
| Workflow para instalar y quitar dependencias desde el CI, sin depender de esta máquina | Hecho — **falta correrlo por primera vez** |

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
2. **Sacar el lastre de dependencias — pero NO las siete que decía antes.** Esta instrucción
   estaba mal y la corrigió una auditoría el 07/08/2026. Decía que había que quitar siete
   paquetes, e incluía `class-variance-authority`, `clsx` y `tailwind-merge`. **Esas tres las
   necesita la Fase B del plan**: `Button.tsx` se construye con `cva`, y `cn` pasa a ser
   `twMerge(clsx(...))` para arreglar las colisiones de clases. Si se ejecutaba la instrucción
   vieja, se borraba la base del trabajo siguiente.

   Lo que **sí** hay que sacar son cuatro: `@base-ui/react`, `shadcn`, `tw-animate-css` y `motion`.

   Y ya no hace falta el workflow: **hay npm en esta máquina** (ver el punto siguiente).

   ```bash
   npm uninstall @base-ui/react shadcn tw-animate-css motion
   ```

3. **Se puede instalar y desinstalar acá, directamente.** Durante semanas se dio por sentado que
   no había npm en esta máquina, y se construyó un workflow entero de GitHub Actions para
   resolverlo. Era falso: `npm 10.9.2` está instalado en
   `C:\Users\Vmagni\tools\node-v22.17.0-win-x64`, con acceso al registro, y el hook de
   pre-commit lo viene usando en cada commit.

   ```bash
   export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
   ```

   El workflow `Dependencias` sigue sirviendo —corre lint, tests y build antes de commitear el
   lock, que es una red útil— pero ya no es el único camino. Detalle del error y su lección en
   `CLAUDE.md` §1.
3. **Correr `migracion-38-registrar-35-36.sql`** en Supabase → SQL Editor. Tarda un segundo y no
   toca ningún dato: sólo hace que el chip de "Base de datos al día" deje de dar por faltantes a
   la 35 y la 36. El porqué está en la sección 2.2.
4. ~~Avisarme para publicar los commits nuevos.~~ **Hecho el 04/08/2026.**
5. **Verificación visual del PDF**: Reporte → Imprimir/PDF → confirmar que la vista previa
   tiene contenido. Los tests garantizan que el documento se arma bien, **no** que el
   navegador lo imprima bien — esa es exactamente la falla que tuve la vez pasada.
6. **Si querés que analicemos las consultas juntos**: crear `.env.consultas.local` con el
   email y la contraseña de la cuenta de administración, y correr `node scripts/consultas.mjs`.
   Instrucciones en `docs/CONSULTAS-PARA-ANALISIS.md`.
7. **Decisiones abiertas**: ¿va el cronómetro? (desaconsejado en `docs/PROPUESTA-ICR.md`).
   ¿Sentry para monitoreo de errores? (el Error Boundary ya está preparado).
8. **Rotación de credenciales** — diferida por decisión tuya hasta salir de beta.

## 6. Bloqueado, para que conste

> Detalle completo, junto con qué documentos se sacaron y cuáles se dejaron a propósito, en
> `docs/LIMPIEZA-2026-08.md`.

- ~~**Sacar 6 dependencias que nadie usa.**~~ **DESBLOQUEADO el 04/08/2026.** Estaba trabado
  porque no hay npm en esta máquina para regenerar el `package-lock.json` — pero el runner del
  CI sí tiene npm. El workflow **Dependencias** lo hace. Quedan por sacar `@base-ui/react`,
  `class-variance-authority`, `clsx`, `shadcn`, `tailwind-merge`, `tw-animate-css` y ahora
  también `motion`, que dejó de usarse. Ver el punto correspondiente en la sección 5.
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
