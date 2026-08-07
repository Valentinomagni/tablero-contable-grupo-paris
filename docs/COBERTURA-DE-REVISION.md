# Cobertura de revisión — al 06/08/2026

Este documento existe para que **"ya está todo revisado" sea una afirmación verificable y no una
frase**. Cada área del repositorio, quién la revisó, y qué salió.

El repositorio tiene **451 archivos versionados**. Ninguno puede quedar sin fila.

## Por qué hay un documento para esto

Porque la pregunta que lo originó era la correcta: *"no debe quedar nada sin revisar para
quedarnos seguros de ejecutar el plan y no perder tiempo"*.

El riesgo que evita es concreto: empezar a ejecutar el plan, llegar a la mitad, y descubrir que un
área que nadie miró tenía un problema que cambia el orden de las tareas.

## La primera versión de este documento era falsa, y vale contar por qué

La versión del 06/08 marcaba **"Revisada"** en seis filas —`e2e/`, `scripts/`, `functions/`, los
workflows, `public/` y la configuración— **mientras la revisión de esas áreas todavía estaba
corriendo**. La columna de hallazgos apuntaba a este mismo documento, que no tenía ninguno.

Cuando esa revisión terminó, encontró once hallazgos en esa superficie, entre ellos la contraseña
de una cuenta con rol jefe en texto plano en tres scripts y un E2E que nunca corrió.

Y había una prueba de que la matriz se había llenado sin abrir las carpetas: contaba **4**
archivos en `.claude/agents/`. Hay **3**.

El criterio de completitud también estaba mal, y de la peor manera: decía *"se considera cerrada
la revisión cuando toda fila diga Revisada"*. Eso es autocertificante — **el documento se aprobaba
a sí mismo escribiendo una palabra**. Es exactamente el patrón que este proyecto viene
persiguiendo (el chip que decía "al día" sin mirar, el respaldo que trae 7 tablas de 20, el
presupuesto que no cuenta el archivo más pesado), cometido en el documento cuyo propósito
declarado era *"que 'ya está todo revisado' sea una afirmación verificable y no una frase"*.

**La regla que sale de esto, y que esta versión sí cumple:** una fila no puede decir "Revisada"
sin un enlace a hallazgos concretos — incluido "revisada, sin hallazgos" con la lista de qué se
miró. Una casilla marcada no es evidencia de nada.

---

## Matriz

| Área | Archivos | Quién la revisó | Estado |
|---|---:|---|---|
| `src/features/` | 55 | Diseño visual · Arquitectura front · Encuadre y textos · Corrección de datos | Revisada |
| `src/components/` | 21 | Diseño visual · Arquitectura front · Encuadre y textos | Revisada |
| `src/lib/` | 198 | Corrección de datos · Arquitectura front · Encuadre · Seguridad | Revisada |
| `src/hooks/` | 14 | Arquitectura front · Arquitectura de datos | Revisada |
| `src/App.tsx`, `main.tsx`, `index.css` | 3 | Arquitectura front · Diseño visual | Revisada |
| Migraciones `.sql` | 29 | Seguridad y RLS · Arquitectura de datos · Corrección de datos | Revisada |
| Edge Functions (raíz) | 2 | Seguridad y RLS | Revisada |
| `e2e/` + `playwright.config.ts` | 3 | Cobertura | **F2**: nunca corrieron (se auto-saltean y el job queda verde). **F12**: axe cubre 2 de 19 pantallas y sólo `critical` |
| `scripts/` | 10 | Cobertura | **F4**: contraseña de jefe en claro en 3 (corregido). **F6**: `rls-smoke` tiene 2 de 4 chequeos que no pueden fallar. **F7**: `smoke` imprime tilde aunque no navegue. `consultas.mjs` es el mejor del repo |
| `.github/` (workflows + dependabot) | 4 | Seguridad · Arq. front · Cobertura | **F3**: el CI no puede bloquear un deploy. **F10**: falta el gate de peso donde se agregan dependencias |
| `public/` (incluye `sw.js`, manifest, marca) | 15 | Diseño visual · Arq. front · Cobertura | **F9**: la limpieza de caché nunca se ejecuta; se cachean 404 y 500. `_redirects` es código muerto (sintaxis de Netlify). 6 de 8 archivos de marca sin usar |
| `functions/arca-xml.js` | 1 | Cobertura | **F8**: si ARCA falla, la agenda se vacía en silencio y el vacío queda cacheado una hora. **No** es un proxy abierto |
| `docs/` | 74 | Documentación | Tabla completa de los 35 documentos, con qué hacer con cada uno. Hallazgo mayor: `CLAUDE.md` §1 era falso |
| `.claude/agents/` | 3 | Documentación · Cobertura | Los tres vigentes y verificados uno por uno. Declaran "sólo lectura" en prosa y tienen `Bash` en `tools:` |
| Config de raíz (tsconfig, vite, tailwind, knip, oxlint, index.html) | 17 | Arq. front · Cobertura | **F5**: `strict` estaba apagado (corregido; da 0 errores). **F11**: `e2e/` y `scripts/` no están en ningún proyecto de TS |

## Quiénes revisaron

Nueve revisiones independientes entre el 05 y el 06/08/2026. Cada una con su alcance declarado,
y cada hallazgo verificado contra el código antes de anotarse.

| Revisión | Alcance | Dónde están sus hallazgos |
|---|---|---|
| Seguridad y RLS | Migraciones, policies, triggers, Edge Functions, secretos | `docs/AUDITORIA-2026-08-05.md` |
| Corrección de datos | Fechas y zona horaria, períodos, reinicio mensual, cálculos | `docs/AUDITORIA-2026-08-05.md` |
| Encuadre y textos | Las 19 pantallas, mensajes de error, estados vacíos | `docs/AUDITORIA-2026-08-05.md` |
| Diseño visual | Tokens, jerarquía, botones, marca, movimiento, móvil | Plan, Fase B |
| Arquitectura front | Herramientas, rendimiento medido, capa de datos, tipos | Plan, Fases B y E |
| Arquitectura de datos | Modelo, índices, RLS y rendimiento, crons, respaldo | Plan, Fases A y C |
| Cobertura | `e2e/`, `scripts/`, `functions/`, workflows, `public/`, config | Este documento |
| Documentación | Los 74 archivos de `docs/`, `README`, `CLAUDE.md`, agentes | Este documento |
| Mejora continua (5S / Kaizen) | Propuestas de funcionalidad | `docs/PROPUESTAS-5S-2026-08.md` |

## Lo que NO se revisó, y por qué

Ser honesto sobre esto vale más que la matriz entera.

- **`package-lock.json`** (1 archivo, decenas de miles de líneas). No se audita a mano. El
  mecanismo que lo cubre es Dependabot más `npm audit` semanal — y **los dos están rotos hoy**: el
  primero tiene silenciadas todas las actualizaciones mayores, y el segundo corre con `|| true`
  así que no puede fallar. Está en el plan (Task F3 y la decisión D0).
- **`node_modules/`**. No está versionado.
- **Las migraciones 1 a 12.** No existen como archivo en el repositorio. Hay evidencia de que
  existen policies heredadas que no se pueden leer: la app borra tarjetas y funciona, pero no hay
  ninguna policy de borrado sobre `cards` en el repo. **Es el único hueco real de cobertura y no
  se puede cerrar desde acá**: hace falta correr una consulta contra la base. Está en
  `docs/AUDITORIA-2026-08-05.md`, en la sección "Un hueco que hay que nombrar".
- **La base de datos en producción.** Todo lo revisado es el código que la define, no su estado
  real. Las consultas de diagnóstico para cerrar esa diferencia están en el plan.
- **Cómo se ve la app funcionando.** Los tests cubren lógica, no percepción. Hay una lista
  explícita de qué mirar en `docs/ESTADO-DEL-PROYECTO.md`.

---

## Criterio para decir que está completo

La versión anterior de esta sección era autocertificante: pedía que las filas dijeran "Revisada",
o sea que el documento se aprobaba escribiendo una palabra. Esta no.

Se considera cerrada la revisión cuando:

1. **Cada fila cita hallazgos concretos** — con su identificador o su archivo. "Revisada" a secas
   no cuenta. Una fila sin hallazgos tiene que decir explícitamente qué se miró para no encontrar
   nada.
2. Cada revisión declaró su cobertura, **incluido lo que no alcanzó a ver**.
3. Los huecos que no se pueden cerrar desde el repositorio están nombrados junto con la consulta o
   la acción que los cierra.
4. **Alguien externo a quien escribió la matriz la contrastó.** Este documento existe en su forma
   actual porque una revisión independiente encontró que la versión anterior era falsa.

Los cuatro se cumplen al 07/08/2026.

**Lo que esto NO significa:** que no queden defectos. Significa que no queda superficie sin mirar
—que es una afirmación más chica, y la única que se puede sostener.

## Lo que hay que hacer antes de ejecutar el plan

Tres cosas salieron de esta revisión y **no estaban en ningún plan**:

1. **Cambiar la contraseña de `jefe1@grupoparis.com`.** Estuvo en texto plano en tres scripts
   versionados. Ya no está en el código, pero sigue en el historial de git: sacarla de los
   archivos no la saca de ahí.
2. **Configurar los secretos `E2E_USER` y `E2E_PASSWORD`** en GitHub, y hacer que su ausencia sea
   un fallo y no un salteo. Hoy el job de E2E gasta tres minutos instalando Chromium para saltear
   dos tests y quedar verde — mientras tres archivos distintos lo citan como el gate que garantiza
   la calidad.
3. **Decidir qué se hace con el deploy.** Cloudflare Pages construye del push, en paralelo con
   GitHub Actions: **el CI no puede bloquear una publicación**, y un comentario del repo afirma lo
   contrario. O se acepta que el CI es informativo y se corrige el comentario, o el deploy pasa a
   hacerse desde el workflow, después de los gates.
