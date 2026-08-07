# CLAUDE.md

Tablero Contable — Grupo Paris. App de gestión de tareas contables para concesionarias.

Este archivo se carga en cada sesión. Todo lo que está acá se aprendió rompiendo algo o
perdiendo tiempo. Leelo antes de tocar código.

---

## 1. Entorno

**SÍ hay npm en esta máquina.** `npm 10.9.2`, `npx` y `corepack`, con acceso al registro.

```sh
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm --version   # 10.9.2
npm ping        # PONG
```

**Esta sección decía exactamente lo contrario, con la palabra "Verificado" al lado, durante
semanas.** Vale dejar escrito cómo pasó, porque es el error más caro que tuvo el proyecto y no
fue técnico:

1. Se comprobó que no había npm **en el PATH por defecto** y se concluyó "no hay npm".
2. Se escribió acá con el sello "Verificado", y a partir de ahí nadie volvió a probarlo.
3. Se construyó un workflow entero de GitHub Actions (`Dependencias`) para instalar paquetes
   desde el CI, resolviendo un problema que no existía.
4. Cinco documentos más repitieron la afirmación. Uno llegó a decir *"no hace falta volver a
   evaluarlo"*, que es la frase que convierte un error en algo permanente.
5. Mientras tanto, `.githooks/pre-commit` —tres líneas más abajo en este mismo repositorio—
   hacía `export PATH="$HOME/tools/..."` y después `npx tsc` y `npx vitest`. **Si no hubiera
   npx, ningún commit se habría podido cerrar.** La evidencia estuvo a la vista todo el tiempo.

La lección no es "verificá el entorno". Es más específica: **una afirmación con el sello
"Verificado" deja de revisarse.** Si escribís esa palabra, escribí al lado el comando que lo
comprueba, para que el que venga pueda repetirlo en diez segundos en vez de confiar.

**Consecuencia práctica:** `npm install`, `npm ci` y regenerar `package-lock.json` se pueden
hacer acá, directamente. El workflow `Dependencias` sigue existiendo y sirve como alternativa
—corre lint, tests y build antes de commitear el lock, que es una red útil— pero **ya no es el
único camino**.

Antes de agregar una librería, **revisá si ya está instalada**. `zod` estaba y casi se
duplicó a mano.

**Ojo con los dos toolchains.** Hay dos `node` en la máquina y no son el mismo:

| Ruta | Versión | Trae npm |
|---|---|---|
| `$HOME/tools/node-v22.17.0-win-x64` | v22.17.0 | **sí** |
| `C:\Users\Vmagni\AppData\Local\OpenAI\Codex\bin` | v24.14.0 | no |

Para instalar, usá el primero. Para correr los comandos de la tabla de abajo, cualquiera sirve.

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

## 2. La rutina: orden, corrección, actualización, revisión

**Esta es la regla que ordena a todas las demás, y es nueva.** Salió de una frase del dueño del
proyecto: *"tenemos que dejar de funcionar como un kiosco"*.

Durante meses el trabajo fue por impulso: aparecía algo, se arreglaba, aparecía otra cosa. Eso
produce movimiento y no produce avance — y es cómo se llegó a tener 75 documentos sin saber
cuáles decían la verdad, 29 migraciones sueltas en la raíz, y una lista de pendientes que nadie
podía leer entera.

**Toda tanda de trabajo sigue estos cuatro pasos, en este orden. No se saltea ninguno, y no se
empieza el siguiente sin terminar el anterior.**

### 1. ORDENAR

Antes de tocar código: dejar el terreno legible. Clasificar lo que hay, separar lo vigente de lo
histórico, y **escribir dónde está cada cosa**.

Sale de acá: `docs/INDICE.md` actualizado.

*Por qué primero:* si no sabés qué está terminado, vas a arreglar dos veces lo mismo o a dejar
algo a mitad sin enterarte.

### 2. CORREGIR

Arreglar lo que está roto. **Nada nuevo hasta que esto esté en cero.**

Los defectos abiertos viven en `docs/AUDITORIA-*.md`. Se cierran por daño real, no por orden de
aparición ni por facilidad.

*Por qué antes de actualizar:* una función nueva encima de un cálculo roto produce números
falsos con más confianza. En Toyota es doctrina: **no se mejora un proceso inestable, primero se
lo estabiliza.**

### 3. ACTUALIZAR

Recién acá van las funciones nuevas y las herramientas. De `docs/PROPUESTAS-*.md` y de los planes.

Cada cosa que entra tiene que traer, escrito: **qué mide, a quién ayuda, y cuándo se descarta si
no sirvió.** Sin criterio de descarte, no entra — una propuesta sin fecha de revisión es un
compromiso permanente disfrazado de experimento.

### 4. REVISAR

Verificar que lo hecho es lo que se dijo. Los cuatro comandos con su código de salida, y
**alguien externo mirando lo que uno escribió**.

Ese último punto no es ceremonia. La matriz de cobertura del 06/08 se declaró completa a sí
misma; una revisión independiente encontró once hallazgos en las áreas que la matriz daba por
cerradas, incluida una contraseña en texto plano. **Una casilla marcada no es evidencia.**

Sale de acá: `docs/ESTADO-DEL-PROYECTO.md` actualizado, con los números contados de nuevo.

---

**El fallo típico de este proyecto es saltar del 1 al 3**: ordenar un poco, entusiasmarse con algo
nuevo, y dejar las correcciones para después. Cuando eso pasa, el paso 2 no desaparece: se
acumula, y aparece más caro tres semanas más tarde.

Si estás por escribir una función nueva y hay defectos abiertos en la auditoría, **estás en el
paso equivocado**.

### Cuándo un paso está terminado

Sin esto, la regla de arriba no sirve: *"terminado"* se vuelve una sensación, y la sensación
siempre dice que sí.

**Un paso está terminado cuando su chequeo pasa. No cuando alguien lo declara.**

| Paso | Chequeo que lo cierra | Quién puede correrlo |
|---|---|---|
| **1. Ordenar** | `docs/INDICE.md` existe y su lista "lo que falta terminar" no tiene ninguna fila en "sin verificar" | Claude |
| **2. Corregir** | Cero hallazgos abiertos en `docs/AUDITORIA-*.md`, **y** el chip de Administración en verde | Claude escribe · **el dueño corre las migraciones** |
| **3. Actualizar** | Cada cosa que entró trae escrito qué mide, a quién ayuda y cuándo se descarta | Claude |
| **4. Revisar** | `tsc`, lint, tests y build en 0, **y** una revisión independiente que contradiga o confirme | Claude escribe · **hace falta un segundo par de ojos** |

**Dos de los cuatro no los puedo cerrar solo, y eso no es una excusa: es la forma del problema.**
El paso 2 no cierra hasta que las migraciones se corren en Supabase, y eso pasa en una máquina a
la que no llego. El paso 4 no cierra con autoevaluación — la matriz de cobertura del 06/08 se
declaró completa a sí misma y una revisión independiente encontró once hallazgos adentro.

### Sobre pedir "100% de certeza"

Es la pregunta correcta y la respuesta honesta es que **nadie la puede dar**. Lo que sí se puede
es no mentir sobre el nivel de certeza que hay.

Este proyecto se lastimó cuatro veces por afirmaciones con tono de verificadas que no lo estaban:
*"NO hay npm. Verificado"*, *"el encuadre está verificado por tests"*, la matriz de cobertura que
decía "Revisada" sobre áreas que nadie miró, y la migración 40 que justificó su alcance con un
comportamiento del front que no existía.

Las cuatro tenían la misma forma: **se escribió la conclusión sin correr la comprobación.**

Por eso la regla operativa no es "estar seguro", es más chica y sí se puede cumplir:

> **Si escribís "verificado", escribí al lado el comando o el archivo:línea que lo comprueba.**
> Si no podés, escribí "sin verificar". Las dos son respuestas válidas; inventar la primera, no.

## 3. Reglas duras del producto

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

## 4. Sistema visual — leer `docs/SISTEMA-VISUAL.md`

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

## 5. Capa de datos

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

## 6. Errores y fallas

Todo error que vea un usuario pasa por `clasificarFalla` (`src/lib/fallas.ts`), que decide
**la acción que de verdad desatasca**. El orden de sus ramas importa: **sin conexión se evalúa
antes que versión vieja**, porque sin red un módulo también falla al bajar y ahí actualizar
deja la pantalla en blanco.

Ofrecer "Reintentar" cuando reintentar no puede funcionar es peor que no ofrecer nada.

## 7. Cómo trabajar acá

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

## 8. Ramas y release

Features nuevas van a `dev` (Cloudflare genera una preview por rama); merge a `main` = deploy a
producción, sólo tras revisar la preview. Hotfixes chicos pueden ir directo a `main`. Ver
`docs/FLUJO-DEV.md`.

Antes de todo push a `main` que agregue funcionalidad visible: agregar una entrada arriba de
`CHANGELOG` en `src/lib/version.ts` (semver + fecha + cambios **en lenguaje de usuario**).
`APP_VERSION` se deriva sola de esa entrada — nunca se edita a mano. Ver `docs/RELEASE.md`.

## 9. Publicar (y el límite que no se cruza)

`git push` **falla**: no hay credencial en un shell no interactivo. Publicar se hace con
**GitHub Desktop**, controlando la pantalla del usuario.

**Hay que pedirle permiso ANTES de cada vez que se usa su computadora**, no una vez por sesión.
Está trabajando y le interrumpe. El diálogo del sistema que pide acceso **no cuenta** como
haber preguntado. Nunca escribir sus credenciales.

Dos trampas ya conocidas al publicar: puede estar la sesión de GitHub equivocada, y GitHub
Desktop puede estar apuntando a **otro clon** del repo (`Documents\GitHub\...` en vez de la
carpeta del Escritorio).

## 10. Estado y pendientes

`docs/ESTADO-DEL-PROYECTO.md` es la fuente de verdad de qué falta, separado entre lo que
depende de Claude y lo que depende del usuario. Mantenerlo actualizado —incluidos los números
de tests y de commits sin publicar— es parte del trabajo, no un extra.
