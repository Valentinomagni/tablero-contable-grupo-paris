# ¿Sirve gstack para este proyecto? — 14/08/2026

**Respuesta corta: no para instalarlo, sí para robarle dos ideas.**

`gstack` es un repositorio de Garry Tan (CEO de Y Combinator): 69 skills en Markdown para Claude
Code, MIT, gratis. Convierte a Claude en "un equipo de ingeniería virtual" — CEO, jefe de
ingeniería, diseñador, revisor, QA, oficial de seguridad, release manager.

Está bien hecho y es serio. El problema no es la calidad: es que casi todo lo que aporta ya está
resuelto acá, y lo que no, esta máquina no lo puede correr.

---

## Lo que verifiqué antes de opinar

| Qué | Cómo lo comprobé | Resultado |
|---|---|---|
| Necesita Bun | `README.md:472` | Sí, además de Node, en Windows |
| ¿Hay Bun en esta máquina? | `command -v bun` | **No** |
| `/browse` y `/qa` levantan servidor local | `README.md:462`, usa Playwright | Sí |
| ¿El proyecto ya tiene Playwright? | `package.json` | **Sí**: `@playwright/test` y `@axe-core/playwright` |
| ¿Ya hay pruebas de navegador? | `e2e/app.spec.ts`, `e2e/a11y.spec.ts` | Sí, y corren en CI |
| Skills ya instaladas | `ls ~/.claude/skills/` | 12 (superpowers y otras) |

---

## Los tres motivos por los que no lo instalo

### 1. Lo más valioso es justo lo que esta máquina no puede correr

Las dos skills que atacarían el agujero real de este proyecto —`/browse` y `/qa`, abrir la app
en un navegador de verdad— **levantan un servidor local con Playwright**. Esta computadora no
tiene permisos de administrador: un servidor escuchando en un puerto dispara el aviso del
firewall de Windows, y ese aviso no se puede aprobar.

Es exactamente la restricción por la que el proyecto ya evita servidores locales.

### 2. Lo que sí se puede correr, ya está

El agujero de verificación de navegador está **parcialmente cubierto**: `@playwright/test` y
`@axe-core/playwright` están instalados, hay dos specs en `e2e/`, y corren en CI. Lo que falta
no es la herramienta, es mirar la app con ojos humanos — y eso ninguna skill lo resuelve.

Lo mismo con el resto: `/review` y `/cso` hacen lo que ya hacen los tres agentes de
`.claude/agents/` (`revisor-contable`, `revisor-producto`, `revisor-seguridad`), pero sin conocer
las reglas duras de este proyecto.

### 3. Sesenta y nueve skills encima de doce es el problema que este proyecto ya tuvo

Este repositorio llegó a tener **75 documentos sin saber cuáles decían la verdad**. La lección
está escrita en `CLAUDE.md` §2. Sumar 69 comandos nuevos —cada uno con su preámbulo, su
versionado y su chequeo de actualización— reproduce ese problema en otra capa.

Y hay un detalle concreto: la instrucción de instalación pide agregar a `CLAUDE.md` que
**nunca** se usen las herramientas `mcp__claude-in-chrome__*`. Eso pisaría el flujo de navegador
que ya está en uso.

---

## Lo que SÍ vale la pena, y es gratis

### Una idea para robar: la retro periódica

`/retro` analiza el historial de commits y saca conclusiones sobre cómo se viene trabajando.
**El fallo más caro de este proyecto no es técnico, es de proceso**: la auditoría del 05/08 se
escribió, se archivó y quedó nueve días entera abierta mientras entraban doce migraciones. Nadie
la volvió a mirar porque nada obligaba a hacerlo.

Una revisión periódica de "¿qué quedó abierto y por qué?" ataca eso directamente.

**PERO OJO, Y ESTO ES IMPORTANTE.** La descripción de `/retro` dice, textual, que es
*"team-aware: breaks down per-person contributions with praise and growth areas"* — desglosa
aportes por persona con elogios y áreas de mejora.

Eso **viola la regla más dura del producto**: las métricas describen procesos, nunca juzgan
personas. Hay un guardián (`encuadre.guard.test.ts`) que hace fallar la suite si alguna pantalla
arma un podio. Si se adopta la idea de la retro, tiene que ser **sobre el trabajo y los
defectos, nunca sobre quién los cometió**.

Es un buen ejemplo de por qué copiar herramientas de otro contexto sin leerlas es riesgoso: lo
que en una startup de una persona es motivación, acá es el mecanismo que hace que el equipo
empiece a trabajar para la foto.

### La otra: el checklist de seguridad

`/cso` corre auditorías OWASP + STRIDE. No hace falta la skill, pero **sí conviene meterle esa
grilla al agente `revisor-seguridad` que ya existe**: darle un marco conocido en vez de que
busque a ojo. Es media hora de trabajo y no agrega ninguna dependencia.

---

## Recomendación

**No instalar.** Dejar `gstack-main/` donde está (ya está en `.gitignore`, así que no ensucia
`git status` ni entra a ningún commit) por si algún día hay una máquina con permisos donde
`/qa` sí pueda correr.

**Sí hacer estas dos cosas**, que no dependen de instalar nada:

1. Agregar la grilla OWASP + STRIDE al agente `revisor-seguridad`.
2. Definir una revisión periódica de hallazgos abiertos — **sobre defectos, no sobre personas**.
   La tabla de estado que se acaba de agregar a `docs/AUDITORIA-2026-08-05.md` es la mitad de
   eso; falta la costumbre de mirarla.

---

## Cuándo revisar esta decisión

Si aparece una máquina con permisos de administrador —o si el proyecto se mueve a un entorno de
nube donde levantar un servidor no requiere aprobar nada—, `/qa` y `/browse` pasan a ser
interesantes de verdad, porque atacan el único hueco de verificación que este proyecto no puede
cerrar solo.

Hasta entonces, esta evaluación se mantiene.
