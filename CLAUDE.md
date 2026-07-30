# CLAUDE.md

Tablero Contable — Grupo Paris. App de gestión de tareas contables para concesionarias.

Este archivo se carga en cada sesión. Todo lo que está acá se aprendió rompiendo algo o
perdiendo tiempo. Leelo antes de tocar código.

---

## 1. Entorno (esto invalida los reflejos habituales)

**NO hay npm, pnpm, yarn ni corepack en esta máquina.** Verificado. Consecuencias:

- **No se puede instalar ninguna dependencia.** Si algo se resuelve "agregando una librería",
  hay que hacerlo a mano o no hacerlo.
- **No se puede regenerar `package-lock.json`.** Tocar `package.json` sin el lock rompe el
  `npm ci` del CI. Por eso siguen 6 dependencias sin usar que no se pueden sacar.
- Antes de descartar una librería, **revisá si ya está instalada**. `zod` estaba y casi
  escribí un validador a mano duplicándolo.

`node` está en `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin\node.exe`.
Con Bash: `export PATH="/c/Users/Vmagni/AppData/Local/OpenAI/Codex/bin:$PATH"`

| Qué | Comando |
|---|---|
| Tests | `node node_modules/vitest/vitest.mjs run` |
| Tipos | `node node_modules/typescript/bin/tsc -b` |
| Lint | `node node_modules/oxlint/bin/oxlint` |
| Build | `node node_modules/vite/bin/vite.js build` |

**El hook de pre-commit corre tsc + toda la suite: 90 a 180 segundos.** Al llamar
`git commit` desde una herramienta, pasale un timeout de **420000 ms** o se corta a la mitad.

**Códigos de salida.** `comando | tail` devuelve el estado de `tail`, no del comando. Siempre:
`comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`

## 2. Reglas duras del producto

- **Cero emojis** en cualquier texto que vea un usuario. Iconos sólo de `lucide-react`.
- **Encuadre no punitivo.** Las métricas describen situaciones y procesos, **nunca juzgan
  personas**. No hay rankings, ni conteos por persona, ni comparaciones entre gente. Hay tests
  que lo verifican con asertos explícitos; si uno te estorba, el problema es tu cambio.
  El modo de falla más probable de este proyecto no es técnico: si el equipo lo percibe como
  control, va a trabajar para la foto y todos los datos van a ser mentira.
- **Español de Argentina**, tono directo, sin jerga técnica en la UI. Un error nunca muestra
  el mensaje crudo de la base.
- **Comentarios en español que explican el POR QUÉ**, no el qué. La densidad alta de
  comentarios es deliberada: este código lo mantiene una sola persona que no es programadora.

## 3. Sistema visual — leer `docs/SISTEMA-VISUAL.md`

Lo mínimo para no romperlo:

- **Tamaños de texto: sólo la escala** `text-2xs` … `text-4xl` de `tailwind.config.js`. Nunca
  `text-[Npx]`. Hay un test guardián (`src/lib/tipografia.guard.test.ts`).
- **Tarjetas: `<Panel>`**. Hay un guardián angosto (`src/components/Panel.guard.test.ts`) que
  cubre la tarjeta canónica y **lo declara**. El escape es `panel-guard-ok` en el fuente, con
  el motivo escrito al lado. Si aparecen varios marcadores, falta una variante de `Panel`.
- **Trampa que costó cinco pantallas sin sombra durante meses:** `--ring` es un **color**
  (`var(--accent)`), `--ring-sh` es una **sombra**. `box-shadow: var(--ring),var(--shadow)` es
  CSS inválido y el navegador **descarta la declaración entera**, en silencio. El segundo
  chequeo del guardián de `Panel` existe por esto.
- Colores sólo de las variables de `src/index.css`. La marca es monocroma; el color aparece
  únicamente en estados (`--done`, `--warn`, `--danger`).
- Carga: `<Skeleton>` / `<SkeletonVista>`. Nunca la palabra "Cargando".

## 4. Capa de datos

- **`src/lib/esquema.ts` es el gateado defensivo.** `payloadCards`, `payloadProfiles`,
  `payloadOccurrences` y `COLUMNAS_CARDS` sacan columnas cuando la migración correspondiente
  no está aplicada. Sin eso, PostgREST falla el update **entero** con 42703/PGRST204 por una
  columna que falta. Si agregás una columna en una migración, tiene que aparecer acá.
- **Dos pasos en `src/lib/schemas.ts`, con roles distintos:** `validateRows` avisa del drift
  sin tocar nada; `saneaCards` arregla lo arreglable y descarta lo inservible. Usa
  `looseObject` para que las columnas que el esquema no nombra sobrevivan.
- **RLS: nunca una subconsulta a `profiles` dentro de una policy de `profiles`** — eso da
  recursión infinita (42P17). Se usan helpers `SECURITY DEFINER`: `es_jefe()`,
  `es_encargado_de()`, `es_admin_sistema()`.
- **Las migraciones son idempotentes**: `if not exists`, `drop policy if exists`. Se tienen que
  poder correr dos veces.
- **Períodos (alternativa C):** `cards` = definición estable; `card_periodos` = estado por mes;
  `task_occurrences` = por día. El único lugar donde se escribe una fila de `card_periodos` es
  `guardarPeriodo` en `src/lib/periodo-escritura.ts`.

## 5. Errores y fallas

Todo error que vea un usuario pasa por `clasificarFalla` (`src/lib/fallas.ts`), que decide
**la acción que de verdad desatasca**. El orden de sus ramas importa: **sin conexión se evalúa
antes que versión vieja**, porque sin red un módulo también falla al bajar y ahí actualizar
deja la pantalla en blanco.

Ofrecer "Reintentar" cuando reintentar no puede funcionar es peor que no ofrecer nada.

## 6. Cómo trabajar acá

- **Nunca editar JSX con expresiones regulares ni `sed`.** Ya pasó: dejó un `</div>` donde iba
  un `</Panel>` y rompió el archivo. Ediciones puntuales y exactas, mirando cada cierre.
- **TDD.** Test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto de un plan resulta incorrecto, no lo ajustes para que pase.** Pará y reportalo.
  Ya pasó dos veces que el test estaba mal y el código bien, y una que el test mal habría
  forzado justo el bug que se quería evitar.
- **Verificá antes de afirmar.** Los cuatro comandos con exit code explícito. "Los tests pasan"
  sin la salida no vale.
- **Antes de escribir una función, buscá si ya existe.** Aparecieron dos `ordenarConsultas`
  exportadas con la misma firma y comportamiento distinto. 5S/Kaizen son valores del proyecto:
  la duplicación es un defecto, no un detalle.

## 7. Ramas y release

Features nuevas van a `dev` (Cloudflare genera una preview por rama); merge a `main` = deploy a
producción, sólo tras revisar la preview. Hotfixes chicos pueden ir directo a `main`. Ver
`docs/FLUJO-DEV.md`.

Antes de todo push a `main` que agregue funcionalidad visible: agregar una entrada arriba de
`CHANGELOG` en `src/lib/version.ts` (semver + fecha + cambios **en lenguaje de usuario**).
`APP_VERSION` se deriva sola de esa entrada — nunca se edita a mano. Ver `docs/RELEASE.md`.

## 8. Publicar (y el límite que no se cruza)

`git push` **falla**: no hay credencial en un shell no interactivo. Publicar se hace con
**GitHub Desktop**, controlando la pantalla del usuario.

**Hay que pedirle permiso ANTES de cada vez que se usa su computadora**, no una vez por sesión.
Está trabajando y le interrumpe. El diálogo del sistema que pide acceso **no cuenta** como
haber preguntado. Nunca escribir sus credenciales.

Dos trampas ya conocidas al publicar: puede estar la sesión de GitHub equivocada, y GitHub
Desktop puede estar apuntando a **otro clon** del repo (`Documents\GitHub\...` en vez de la
carpeta del Escritorio).

## 9. Estado y pendientes

`docs/ESTADO-DEL-PROYECTO.md` es la fuente de verdad de qué falta, separado entre lo que
depende de Claude y lo que depende del usuario. Mantenerlo actualizado —incluidos los números
de tests y de commits sin publicar— es parte del trabajo, no un extra.
