# Estado del proyecto — al 14/08/2026

Fuente de verdad de qué falta. Separado entre **lo que depende de mí** y **lo que depende de
vos**, porque mezclarlo fue lo que hizo ilegible la versión anterior de este documento.

Los números de acá se contaron de nuevo hoy; al lado de cada uno está el comando.

---

## 1. Dónde estamos

| Qué | Cuánto | Cómo se cuenta |
|---|---|---|
| Tests | **1361** en 116 archivos | `npx vitest run` |
| Tipos, lint, build | **0, 0, 0** | `npx tsc -b` · `npx oxlint` · `npx vite build` |
| Commits sin publicar | **0** — todo en producción | `git rev-list --count origin/main..HEAD` |
| Migraciones escritas | hasta la **50** | `ls db/migraciones/` |
| Documentos vigentes | 24 | `ls docs/*.md` |
| Agentes de revisión | 3 | `ls .claude/agents/` |

**La etapa que se cierra hoy** son dos cosas juntas: los diez reportes del equipo (la minuta de
Yani, Mathi, Enzo, Patricia y Valentino) y la auditoría del 05/08, que estaba entera abierta.

---

## 2. Lo que se cerró en esta tanda

### Los reportes del equipo

| Quién | Qué reportó | Estado |
|---|---|---|
| Yani, Mathi, Enzo | La tarea de los jueves no volvía | cerrado — el motor estaba escrito y el cron apuntaba a una versión vieja |
| Mathi | La tarea del 14 aparecía el 13 | cerrado — no estaba mal la fecha: es prioridad alta y Mi día muestra las urgentes |
| Patricia | Una tarea por cada día hábil, lista interminable | cerrado — una tarjeta con "6 de 21" y los días adentro |
| Patricia | Transferencias por PDFs sueltos, sin detectar repetidas | cerrado — registro con aviso de duplicado (migración 49) |
| Valentino | Fines de semana y feriados contaban como demora | cerrado — días hábiles + pantalla de feriados (migración 48) |
| Valentino | Scroll vertical interminable | cerrado — columnas plegables |
| Mathi | No se puede adjuntar una captura al reportar | **abierto** — ver sección 4 |

### La auditoría del 05/08

Estaba **entera abierta** nueve días después de escribirse. Detalle y evidencia por hallazgo en
`docs/AUDITORIA-2026-08-05.md`, que ahora tiene tabla de estado — no la tenía, y ésa es
exactamente la razón por la que nadie notó que seguía abierta.

Cerrados: 2, 3, 5, 6, 7, 8, el reinicio que destruía el archivo (1), y siete de los chicos del
punto 9.

**Abierto: el hallazgo 4**, que necesita una decisión tuya. Sección 5.

---

## 3. Pendiente TUYO, en orden de urgencia

### 3.1 Correr dos migraciones en Supabase

```
db/migraciones/migracion-49-transferencias.sql
db/migraciones/migracion-50-reinicio-idempotente.sql
```

SQL Editor, completas. Las dos son idempotentes: se pueden correr dos veces sin romper nada, y
traen al final las consultas para comprobar que quedaron bien.

**La 50 es la urgente.** Hasta que se corra, volver a apretar "Reiniciar mes" **destruye el
archivo del mes**: lo deja guardado con todo en pendiente, o sea 0% de cumplimiento para siempre
en el historial, el promedio y la comparativa. No se puede recuperar.

Para saber si faltan, sin preguntarme:

```bash
npm run migraciones
```

### 3.2 Redesplegar la Edge Function `blanquear-clave`

Supabase Dashboard → Edge Functions → **blanquear-clave** → Edit → reemplazar todo con
`edge-functions/blanquear-clave.ts` → Deploy.

Sin esto queda **arreglado en el código y roto en producción**, que es la peor combinación. Lo
que cierra: hoy el jefe no puede darse el rol de administración, pero sí puede blanquearle la
clave a esa cuenta y entrar como ella. El canal de Consultas existe para que alguien pueda
reportar algo contando con que su jefe no lo lee.

### 3.3 ~~Publicar los commits~~ — HECHO el 14/08/2026

Los 30 commits están publicados. `git push origin main` → `3ee80ea..3a1583e`.

**Y esto dejó de ser tarea tuya.** Decía "con GitHub Desktop, cuando me digas", porque
`CLAUDE.md` afirmaba que `git push` no funcionaba desde acá. Es falso: funciona. La afirmación
era vieja, estaba escrita sin el comando al lado, y nadie la volvió a probar.

Lo caro no fue el tiempo de cada publicación, sino la consecuencia: como publicar costaba
interrumpirte, se publicaba poco, y se acumularon 30 commits —incluido el arreglo de un defecto
de seguridad— mientras vos abrías la app, veías la 2.13 y creías que nada funcionaba.

**Si después de publicar no ves los cambios**, la primera pregunta es la caché de la PWA:
cerrar y volver a abrir la app fuerza la última versión. No es la última pregunta, es la primera.

### 3.4 Mirar la app

Nada de lo de esta tanda se abrió en un navegador. Los tests cubren la lógica; **no cubren la
percepción**. Lo que más conviene mirar:

- La tarjeta de arqueo: ¿el "6 de 21" coincide con lo que Patricia ya sabe?
- Las columnas plegables: al soltar una tarjeta en una plegada, ¿se siente bien que se vuelva a
  plegar sola?
- La sección de feriados en Administración.

### 3.5 Decisiones que siguen abiertas

- **El hallazgo 4** (sección 5) — es la única que bloquea algo.
- ¿Va el cronómetro? Desaconsejado en `docs/PROPUESTA-ICR.md`.
- ¿Sentry para monitoreo? El Error Boundary ya está preparado.
- **Rotación de credenciales**: diferida por decisión tuya hasta salir de beta.

---

## 4. Pendiente MÍO (código)

1. **Adjuntar una captura al reportar un problema** (reporte de Mathi). Es lo único del plan de
   los reportes que queda. Necesita una migración (`consultas.adjunto_path`), permiso de Storage
   —que **sólo la cuenta de administración pueda leer**, porque una captura puede mostrar más de
   lo que el texto dice— y pegar desde el portapapeles con Ctrl+V.
2. **El hallazgo 4**, cuando decidas (sección 5).
3. **Grilla OWASP + STRIDE** para el agente `revisor-seguridad`. Sale de la evaluación de gstack
   (`docs/EVALUACION-GSTACK.md`): media hora, sin dependencias nuevas.
4. **`mv_resumen_mensual`**: la vista materializada existe y **no la usa nadie**. Le faltan
   `sucursal`, `categoria` y el filtro de operativas.
5. **Las variantes de `Panel` que faltan.** De 41 superficies, 18 son la tarjeta canónica y ya
   usan `Panel`. Las otras 23 son 4 o 5 superficies distintas. Unificarlas necesita que mires la
   pantalla y digas cuáles son la misma cosa.
6. **Propuestas de adopción que quedan**: P6 (recordatorio contextual) y P10 (sincronizar antes
   de la reunión), en `docs/PROPUESTAS-ADOPCION.md`.

---

## 5. La decisión que falta: el trabajo adelantado

**Tiene fecha: lo que hoy se adelante de septiembre desaparece el 1/9.**

El diseño de períodos es asimétrico a propósito: se **escribe** en `card_periodos` cuando el mes
que mirás no es el vigente, y se **lee** de `cards` cuando sí lo es. Mientras septiembre es
futuro, lo adelantado va a `card_periodos`. Cuando septiembre pasa a ser el mes vigente, la
lectura cambia de fuente y esas filas quedan huérfanas.

Adelantar trabajo era el motivo declarado de todo el diseño de períodos.

Las tres salidas, con lo que cuesta cada una:

| Opción | Qué implica |
|---|---|
| **A. Aplicar las filas del período sobre `cards` cuando el mes pasa a ser vigente** | Respeta el propósito de la función. Es una migración que toca las mismas funciones que el reinicio. **Es la que recomiendo.** |
| B. Mergear `card_periodos` también en el mes vigente | Más chico y **peor**: las ediciones del mes vigente van a `cards`, así que la lectura mergeada mostraría el estado adelantado encima del trabajo nuevo, para siempre |
| C. Sacar el mes siguiente del selector | Cierra el agujero en una línea y elimina la única función por la que existen los períodos |

Si no me decís nada, hago la A.

---

## 6. Riesgos abiertos

- **Los números del Reporte van a cambiar, y es lo correcto.** Dos cosas los mueven: el
  cumplimiento del mes ahora acota por mes (antes subía solo con el paso del tiempo y no bajaba
  de 90%), y "entregado a tiempo" pasó a una única definición en día calendario argentino (la
  puntualidad puede subir uno o dos puntos, porque deja de contar como tarde algo entregado a
  horario). Si el equipo ve el reporte distinto, es por esto.
- **Verificación visual acumulada**: hay bastante entregado que no viste funcionando.
- **Deploy vs. caché**: si algo "no se ve" después de publicar, puede ser la PWA vieja cacheada.
  Cerrar y reabrir la app fuerza la última versión.
- **Adopción del equipo**: el modo de falla más probable de este proyecto no es técnico. Si se
  percibe como control, van a trabajar para la foto y todos los datos van a ser mentira.

---

## 7. Lo que aprendimos esta tanda, y conviene no perder

**Una auditoría sin tabla de estado no se cierra: se archiva.** La del 05/08 estuvo nueve días
entera abierta mientras entraban doce migraciones y siete funciones nuevas. No fue por falta de
tiempo — fue porque nada obligaba a volver a mirarla. Ahora tiene una fila por hallazgo, y
"cerrado" exige el commit o el `archivo:línea` al lado.

**Un guardián vale más que un arreglo.** `TransferenciasSection`, escrito esta misma semana,
nació con "va a estar disponible tras la migración 49" — el mismo defecto que se estaba
arreglando en otros seis archivos, sin que nadie lo pidiera. El patrón vuelve solo porque
escribir el número es lo más cómodo. Por eso ahora hay un test que lo impide.

**La documentación envejece y hay que verificarla, no citarla.** Este documento decía que tres
dependencias no se podían sacar porque las necesitaba la Fase B. Fui a mirar: `Button.tsx` no
existe y `cn` es una función de tres líneas sin `clsx`. Esa fase nunca se construyó.
