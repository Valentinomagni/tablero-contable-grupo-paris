# Guion del orador — Presentación ejecutiva del Tablero Contable

Versión 2.3.0 · Equipo contable Grupo Paris · Duración objetivo: 12 a 15 minutos + preguntas

Leé esto una vez completo antes de entrar. No lo lleves a la sala para leerlo en vivo: llevá como mucho la hoja de tiempos y la lista de demos.

---

## 1. Antes de empezar (checklist de 6 puntos)

1. **Abrí el archivo de la presentación** y dejalo cargado en la primera diapositiva. Nada de buscarlo con la sala mirando.
2. **F11 para pantalla completa.** Silenciá notificaciones de Windows, del mail y del celular (dejá el celu en silencio, no en vibrador).
3. **Probá el proyector antes**, con la sala vacía si se puede. Verificá resolución, que no se corten los bordes y que los grises se distingan (si el proyector lava los colores, pasá el sistema a modo claro para la demo).
4. **Tené el sistema abierto en otra pestaña**, ya logueado, con el usuario que vas a usar para la demo. Pestaña 1: slides. Pestaña 2: Tablero. No más pestañas.
5. **Cargá el celular al 100 % con la PWA instalada** y el ícono a la vista en la pantalla de inicio. Lo vas a levantar en la diapositiva 12.
6. **Decidí HOY si corrés las migraciones 26, 27 y 28.** Si las corrés y las probás con tiempo, sucursales/segmentación, adjuntos en tareas, chip de estado de la base y resumen semanal automático pasan a ser logro presente. Si no las corrés, **van sí o sí como roadmap**. No hay punto medio: no muestres ni prometas nada que no esté activo en producción cuando hablás.

> Regla de oro del día: si algo no lo probaste esta mañana, no lo mostrás.

---

## 2. Estructura de 16 diapositivas con guion

Los tiempos son objetivo. Si te atrasás, recortá de las diapositivas 7, 9 y 13 — no del cierre.

### Slide 1 — Tablero Contable (portada)
**Decir:** "Buenas. Les quiero mostrar el Tablero Contable, la plataforma que armé para el trabajo diario del equipo. Ya está en producción, versión 2.3, y el equipo la está usando. En quince minutos les cuento qué resuelve, qué ganamos cada uno y qué viene después."
**Tiempo:** 30 s

### Slide 2 — Cómo trabajábamos antes
**Decir:** "Hasta hace poco la operación vivía repartida entre planillas, WhatsApp y memoria. Quién hizo qué, cuándo se cerró el mes, si el arqueo dio diferencia: todo eso existía, pero disperso. Cuando alguien faltaba o entraba gente nueva, el conocimiento se iba con la persona. No era falta de trabajo, era falta de un lugar donde el trabajo quedara registrado."
**Tiempo:** 60 s

### Slide 3 — Qué construimos
**Decir:** "El Tablero es una sola plataforma web con quince módulos que cubren el ciclo completo: la tarea diaria, el arqueo, el cierre mensual y el reporte al jefe. Es propia, hecha a medida de cómo trabajamos nosotros, no un producto genérico al que hay que adaptarse. Y se accede desde el navegador o desde el celular."
**Tiempo:** 60 s

### Slide 4 — Qué gana el empleado
**Decir:** "Para el que está en la trinchera, el cambio es simple: entrás y sabés exactamente qué tenés que hacer hoy, priorizado. Las tareas recurrentes aparecen solas, no hay que acordarse. Y cuando terminás, queda registrado, así que tu trabajo se ve. Acá les muestro Mi día."
**Tiempo:** 60 s → **Demo 1**

### Slide 5 — Qué gana el encargado
**Decir:** "El encargado deja de perseguir gente para saber cómo viene el día. Tiene el kanban con dependencias entre tareas, así que ve qué está trabado y por qué. Puede delegar con un clic, usar plantillas para lo que se repite todos los meses y ver la cobertura cuando alguien se toma vacaciones. Menos preguntar, más resolver."
**Tiempo:** 60 s

### Slide 6 — Qué gana el jefe
**Decir:** "Para ustedes dos, la pieza central es el reporte ejecutivo. Análisis mensual con cumplimiento por marca, por sucursal y por persona, carga de trabajo, rendimiento promedio histórico y puntualidad. Todo exportable a Excel. Es la foto del equipo sin tener que pedirle un informe a nadie."
**Tiempo:** 75 s → **Demo 3** (o dejala para el final de la slide 7 si vas apretado)

### Slide 7 — Control y trazabilidad
**Decir:** "Todo lo que pasa queda registrado. El arqueo de caja guarda las diferencias con su registro, el cierre mensual tiene un semáforo de tres pasos así se ve de un vistazo si el mes está cerrado, y hay bitácora de auditoría de las acciones. Además queda el historial mensual archivado, así que se puede comparar contra meses anteriores."
**Tiempo:** 60 s

### Slide 8 — Seguridad y roles
**Decir:** "Hay tres roles: jefe, encargado y empleado. Y lo importante es que los permisos se aplican en la base de datos, no solo en la pantalla. Es la diferencia entre esconder un botón y que el dato realmente no se pueda tocar. Un empleado no puede ver ni modificar lo que no le corresponde, aunque quisiera."
**Tiempo:** 60 s

### Slide 9 — Multi-marca y sucursales
**Decir:** "El sistema ya trabaja por marca: hay organigrama por marca y el reporte discrimina el cumplimiento marca por marca. La segmentación completa por sucursal está construida y es lo primero que entra en el próximo release." *(Si corriste las migraciones: "…y desde hoy está activa la segmentación por sucursal.")*
**Tiempo:** 45 s

### Slide 10 — Calidad de ingeniería
**Decir:** "Algunos números, no para impresionar sino para que sepan qué tan sólido es lo que están usando: ciento noventa y tres commits en diez días, quince módulos, cuarenta y nueve librerías de dominio, trescientas sesenta y ocho pruebas automatizadas y diecisiete migraciones de base de datos aplicadas. Las pruebas son la parte que más me importa: son las que avisan si algo se rompe antes de que lo vea el equipo."
**Tiempo:** 60 s

### Slide 11 — Costo de licencias: cero
**Decir:** "El costo de licencias es cero. Corre sobre las capas gratuitas de Supabase y Cloudflare. Las herramientas comerciales de gestión cobran por usuario y por mes: acá, sumar gente al equipo no suma costo. Y no hay contrato ni renovación que negociar."
**Tiempo:** 45 s

### Slide 12 — Funciona en el celular
**Decir:** "Se instala como app en el teléfono. No hay que bajar nada de una tienda: se agrega desde el navegador y queda con su ícono como cualquier otra app." *(Levantás el celu y lo mostrás.)* "Modo oscuro incluido, para el que revisa el cierre a las once de la noche."
**Tiempo:** 45 s

### Slide 13 — Lo que viene
**Decir:** "En el próximo release: segmentación por sucursal, adjuntos en las tareas, un indicador de estado de la base y un resumen semanal automático. Está desarrollado, falta aplicarlo en producción, y prefiero decirles eso a venderles algo que hoy no pueden tocar." *(Si ya corriste las migraciones, reemplazá por lo que sigue después de eso: más analítica del reporte, mejoras de cierre.)*
**Tiempo:** 45 s

### Slide 14 — Qué significa esto para el equipo
**Decir:** "Resumiendo: menos tiempo perdido coordinando, cierre mensual con un proceso claro, y ustedes con visibilidad real sin pedirla. El sistema ya está funcionando, no es un proyecto a futuro."
**Tiempo:** 40 s

### Slide 15 — El pedido
**Decir:** *(ver sección 5 para las dos formulaciones — elegí una y decila entera, sin rodeos ni disculpas)*
**Tiempo:** 60 s

### Slide 16 — Gracias / preguntas
**Decir:** "Eso es todo. Les dejo el acceso y los manuales por mail hoy mismo. ¿Qué dudas les quedaron?" *(Y ahí te callás. Aguantá el silencio, no lo llenes vos.)*
**Tiempo:** 20 s + preguntas

**Total hablado: ~13 minutos.**

---

## 3. Las tres demos en vivo

Regla general: **narrá lo que hacés mientras lo hacés.** Nada de silencio con el mouse dando vueltas. Y todo con datos reales, no de prueba.

### Demo 1 — Mi día de un empleado (en la slide 4, ~90 s)
1. Pasás a la pestaña del sistema, ya logueado como empleado.
2. Entrás a **Mi día**. Señalás la lista priorizada del día.
3. Mostrás una tarea recurrente que apareció sola.
4. Marcás una tarea como cumplida y mostrás que el cumplimiento diario se actualiza.
5. Volvés a las slides.

**Qué decís mientras:** "Esto es lo que ve un empleado a las ocho de la mañana. No tiene que decidir por dónde empezar."

### Demo 2 — Arqueo con diferencia (dentro de la slide 7, ~90 s)
1. Abrís **Arqueo de caja**.
2. Cargás un arqueo con una diferencia chica a propósito.
3. Mostrás que el sistema exige registrar la diferencia y que queda asentada.
4. Mostrás el registro histórico de diferencias.

**Qué decís mientras:** "El punto no es que no haya diferencias. El punto es que ninguna diferencia se pierde."

### Demo 3 — Análisis mensual + exportar a Excel (en la slide 6, ~2 min — es la demo que más le importa a los jefes)
1. Abrís **Reporte ejecutivo** → análisis mensual.
2. Mostrás cumplimiento por marca, después por persona.
3. Mostrás carga de trabajo y puntualidad.
4. Clic en **Exportar a Excel** y abrís el archivo descargado en pantalla.

**Qué decís mientras:** "Esto lo tienen todos los meses sin pedirlo, y sale en Excel para que lo crucen con lo que quieran."

### Plan B si falla internet o el sistema
- **Tené capturas de pantalla de las tres demos** en una carpeta y en las últimas diapositivas del archivo (ocultas o al final). Es el plan B que sí funciona siempre.
- Segunda red: **compartí datos del celular a la notebook** y probalo antes de entrar, no en el momento.
- Tercera opción: mostrá la demo directamente **desde el celular con la PWA** y datos móviles.
- Si igual falla: no pidas disculpas tres veces. Decís "se cayó la conexión de la sala, sigo con capturas y después de la reunión se lo muestro en vivo a quien quiera" y avanzás. La sala juzga cómo reaccionás, no la caída.
- **Tené el Excel exportado ya descargado en el escritorio** antes de empezar, por si la exportación no corre en vivo.

---

## 4. Preguntas difíciles y respuestas preparadas

Respondé corto y mirando a quien preguntó. Si no sabés algo, decí "no lo sé, lo averiguo y te contesto hoy". Eso suma, no resta.

**1. ¿Qué pasa si te vas de la empresa?**
"Es la pregunta correcta. Por eso el código está en el GitHub de la empresa, no en una cuenta mía, está documentado, tiene trescientas sesenta y ocho pruebas automatizadas que le explican a cualquier desarrollador cómo debe comportarse el sistema, y dejé manuales escritos de uso y de despliegue. Cualquier programador con experiencia en React lo toma. No inventé nada exótico justamente para eso."

**2. ¿Cuánto nos cuesta?**
"Cero en licencias. Corre en las capas gratuitas de Supabase y Cloudflare. Si algún día el volumen supera esos límites, el salto es a un plan pago de infraestructura, no a una licencia por usuario. Y lo vamos a ver venir con anticipación."

**3. ¿Los datos están seguros?**
"Están en Postgres con seguridad a nivel de fila: los permisos se aplican en la base, no en la pantalla. Tres roles definidos. Cada acción queda en la bitácora de auditoría. El acceso es con usuario propio, no hay cuentas compartidas."

**4. ¿Esto no lo hace mejor un sistema comprado?**
"Un sistema comprado hace muchas más cosas, sí, y también te obliga a trabajar como el sistema quiere. Nosotros tenemos arqueo, cierre mensual con semáforo y cumplimiento por marca: eso no viene en ningún producto de góndola, hay que configurarlo o pagarlo aparte. Si en algún momento conviene comprar algo, este sistema ya nos deja claro exactamente qué necesitamos pedirle."

**5. ¿Quién lo mantiene?**
"Hoy yo, y quiero que eso esté conversado y no dado por supuesto. Con la documentación y las pruebas, un desarrollador externo puede tomarlo. Mi propuesta es que el mantenimiento quede formalmente asignado, con horas reconocidas, en vez de ser algo que hago de más."

**6. ¿Y si se cae?**
"La aplicación está en Cloudflare y la base en Supabase, los dos con alta disponibilidad; no dependemos de una máquina de la oficina. Si se cae, el trabajo del día no se pierde: los datos están en la base. En el próximo release entra el indicador de estado de la base para verlo de un vistazo. Y hay procedimiento de backup y restauración documentado."

**7. ¿Cuánto tiempo le dedicaste en horario laboral?**
*(Respondé con la verdad exacta, no la maquilles. Estructura sugerida:)* "El grueso lo hice fuera de horario, sobre todo la parte de desarrollo. En horario usé tiempo para probarlo con el equipo y corregir lo que salía del uso real, que es lo que no se puede hacer de otra manera. Si les parece, lo dejamos formalizado de acá en adelante."

**8. ¿El equipo lo está usando de verdad?**
"Sí, y lo pueden verificar sin creerme a mí: el reporte muestra el cumplimiento diario cargado por persona y la bitácora tiene la actividad. Los que están acá lo usan todos los días." *(Y si podés, chequealo antes de entrar: si el uso está flojo esta semana, decilo vos primero y explicá por qué.)*

**9. ¿Por qué lo hiciste solo, sin avisar?**
"Empecé resolviendo un problema mío del día a día y creció. Reconozco que debería haberlo puesto sobre la mesa antes; por eso estoy acá ahora, antes de que sea más grande, para que ustedes decidan cómo sigue."

**10. ¿Qué pasa si crece el equipo o sumamos una concesionaria?**
"El sistema ya está pensado por marca, con organigrama y reportes discriminados. Sumar gente no cuesta más plata. Sumar una marca o una sucursal es configuración, no desarrollo desde cero."

**11. ¿No es riesgoso depender de algo hecho en casa?**
"El riesgo real es depender de una sola persona, y eso lo estamos atacando con documentación, pruebas y código en el repositorio de la empresa. La tecnología en sí es estándar y muy usada; no hay nada acá que un desarrollador no reconozca."

**12. ¿Podemos verlo antes de decidir algo?**
"Obvio. Les doy acceso hoy con su usuario y lo usan una o dos semanas. Prefiero que la decisión salga de que lo probaron, no de esta presentación."

---

## 5. El pedido final (slide 15)

Tres reglas: **pedí una sola cosa**, no la envuelvas en disculpas, y no hables después de terminar la frase.

### Formulación A — directa
"Quiero ser claro con lo que vengo a pedir. Este sistema ya está funcionando y le ahorra tiempo al equipo todos los días, sin costo de licencias. Me gustaría que se refleje en mi posición y en mi remuneración, y que el mantenimiento del Tablero quede formalmente dentro de mis responsabilidades, con el tiempo asignado. ¿Cómo lo ven ustedes?"

### Formulación B — consultiva
"Con esto sobre la mesa, la pregunta que quiero dejarles es qué lugar tiene esto dentro de mi rol. Hoy lo hice por fuera de lo que se me pide. Me gustaría que lo conversemos: si tiene sentido que sea parte formal de mi trabajo, y qué implicaría eso en términos de posición y de remuneración. ¿Qué les parece a ustedes?"

**Cerrá con pregunta abierta y callate.** "¿Cómo lo ven ustedes?" / "¿Qué les parece?" El silencio incómodo después del pedido juega a tu favor. El primero que habla debería ser uno de los jefes. Si te contestan "lo vemos", no insistas ahí: preguntá "¿les parece que lo retomemos la semana que viene?" y cerrás con fecha.

---

## 6. Cinco errores a evitar

1. **No entres en detalle técnico.** Nadie en esa sala quiere saber qué es un hook, una migración o la seguridad a nivel de fila por dentro. Traducí siempre a consecuencia: "los permisos se aplican en la base" → "el dato no se puede tocar, aunque quieras".
2. **No prometas lo que no está activo.** Sucursales/segmentación, adjuntos, chip de estado y resumen semanal van como próximo release si no corriste las migraciones 26, 27 y 28. Prometer algo que después no aparece te borra la credibilidad de todo lo demás.
3. **No te achiques con falsa modestia.** Nada de "es una boludez que armé en los ratos libres". Ciento noventa y tres commits y trescientas sesenta y ocho pruebas en diez días no es un rato libre. Decí los números en tono neutro y dejá que hablen solos.
4. **No leas las slides.** Las slides son el respaldo visual; el contenido sos vos. Mirá a la gente, no a la pantalla. Si tenés que mirar algo, mirá el monitor de la notebook, no te des vuelta.
5. **Manejá el tiempo.** Poné un cronómetro visible solo para vos. Si a los 8 minutos no llegaste a la slide 10, recortá las demos 1 y 2 y andá directo al reporte ejecutivo, el costo cero y el pedido. **La slide 15 se dice siempre**, aunque tengas que sacar todo lo demás.

---

### Última nota antes de entrar
Respirá antes de la primera frase. Hablá más lento de lo que te sale. Y acordate de por qué estás ahí: no venís a pedir un favor, venís a mostrar algo que ya está funcionando y a conversar qué lugar ocupa.
