# Estado del proyecto — al 14/08/2026

Fuente de verdad de qué falta. Separado entre **lo que depende de mí** y **lo que depende de
vos**, porque mezclarlo fue lo que hizo ilegible la versión anterior de este documento.

Los números de acá se contaron de nuevo hoy; al lado de cada uno está el comando.

---

## 1. Dónde estamos

| Qué | Cuánto | Cómo se cuenta |
|---|---|---|
| Tests | **1381** en 117 archivos | `npx vitest run` |
| Tipos, lint, build | **0, 0, 0** | `npx tsc -b` · `npx oxlint` · `npx vite build` |
| Commits sin publicar | **0** — todo en producción | `git rev-list --count origin/main..HEAD` |
| Migraciones escritas | hasta la **52** | `ls db/migraciones/` |
| Documentos vigentes | 25 | `ls docs/*.md` |
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
| Mathi | No se puede adjuntar una captura al reportar | cerrado — Ctrl+V, bucket privado (migración 52) |

### La auditoría del 05/08

Estaba **entera abierta** nueve días después de escribirse. Detalle y evidencia por hallazgo en
`docs/AUDITORIA-2026-08-05.md`, que ahora tiene tabla de estado — no la tenía, y ésa es
exactamente la razón por la que nadie notó que seguía abierta.

**Cerrada entera.** Los ocho hallazgos grandes y los once chicos del punto 9. El último en
cerrarse fue el 4, el del trabajo adelantado — sección 5.

---

## 3. Pendiente TUYO, en orden de urgencia

### 3.1 Correr dos migraciones en Supabase

La 49 y la 50 ya las corriste. Quedan estas dos:

```
db/migraciones/migracion-51-volcar-adelantado.sql
db/migraciones/migracion-52-consultas-adjunto.sql
```

SQL Editor, completas. Las dos son idempotentes y traen al final las consultas para comprobar
que quedaron bien.

**La 51 tiene fecha: el 1 de septiembre.** Hasta que se corra, lo que alguien adelante de
septiembre desaparece cuando septiembre pase a ser el mes en curso. Su prueba de punta a punta
**no espera al 1/9** — usa un mes inventado, está escrita al final del archivo.

**La 52 tiene una comprobación que conviene hacer de verdad**, y no es un formalismo: mandá una
consulta con captura desde una cuenta de empleado y confirmá que **el jefe no puede abrirla**.
Si el jefe la ve, la promesa del canal de Consultas es falsa y hay que parar todo.

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

- ¿Va el cronómetro? Desaconsejado en `docs/PROPUESTA-ICR.md`.
- ¿Sentry para monitoreo? El Error Boundary ya está preparado.
- **Rotación de credenciales**: diferida por decisión tuya hasta salir de beta.

---

## 4. Pendiente MÍO (código)

**Nada que bloquee.** Lo que sigue es mejora, no deuda:

1. **Grilla OWASP + STRIDE** para el agente `revisor-seguridad`. Sale de la evaluación de gstack
   (`docs/EVALUACION-GSTACK.md`): media hora, sin dependencias nuevas.
2. **`mv_resumen_mensual`**: la vista materializada existe y **no la usa nadie**. Le faltan
   `sucursal`, `categoria` y el filtro de operativas.
3. **Las variantes de `Panel` que faltan.** De 41 superficies, 18 son la tarjeta canónica y ya
   usan `Panel`. Las otras 23 son 4 o 5 superficies distintas. Unificarlas necesita que mires la
   pantalla y digas cuáles son la misma cosa.
4. **Propuestas de adopción que quedan**: P6 (recordatorio contextual) y P10 (sincronizar antes
   de la reunión), en `docs/PROPUESTAS-ADOPCION.md`.

---

## 5. El trabajo adelantado — resuelto con la opción A

**Tenía fecha: lo que se adelantara de septiembre desaparecía el 1/9.** Está hecho, falta correr
la migración 51.

El diseño de períodos es asimétrico a propósito: se **escribe** en `card_periodos` cuando el mes
que mirás no es el vigente, y se **lee** de `cards` cuando sí lo es. Mientras septiembre era
futuro, lo adelantado iba a `card_periodos`; al pasar septiembre a ser vigente, la lectura
cambiaba de fuente y esas filas quedaban huérfanas. Y adelantar trabajo era el motivo declarado
de todo el diseño de períodos.

**Se hizo la opción A**, que era la recomendada: el reinicio mensual vuelca las filas del mes que
arranca sobre `cards`, **después** de reiniciar. Al revés, el reinicio pisaría lo recién volcado.

Las otras dos quedan anotadas por si alguna vez hay que revisar la decisión: mergear
`card_periodos` también en el mes vigente era más chico y **peor** (mostraría el estado
adelantado encima del trabajo nuevo, para siempre), y sacar el mes siguiente del selector cerraba
el agujero en una línea eliminando la única función por la que existen los períodos.

### La arista que apareció implementándola

Volcar no alcanzaba. Si la fila volcada se seguía pudiendo leer, el día que ese mes dejara de ser
vigente la vista mergearía la foto adelantada **por encima** de todo lo hecho durante el mes: se
salvaba el trabajo adelantado a costa de tapar el real, que es cambiar un bug por otro peor.

Por eso la fila queda marcada con `aplicado_at` y el front la ignora. Se marca y no se borra:
borrar sería irreversible, y así se puede ver qué se volcó y cuándo el día que alguien pregunte
por qué una tarea figura terminada.

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
