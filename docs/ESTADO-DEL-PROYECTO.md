# Estado del proyecto — al 22/07/2026

Documento de situación pedido por el propietario. Separa lo que depende de mí (código)
de lo que depende de él (decisiones y acciones externas). Honesto y sin adornos.

---

## 1. Dónde estamos

- **Tablero Contable v2.7.0**, en producción (Cloudflare), con **736 pruebas automáticas** verdes.
- Migración a React completa; 31 migraciones de base de datos escritas.
- Specs entregados: 24, 25, 26 y el spec 28 completo (fases A, B, C, D).
- Repositorio en GitHub de la empresa, con CI (lint + tests + build en cada push).

## 2. Lo que YO di por hecho y en realidad está mal (lo más importante)

Estas son correcciones, no funcionalidades nuevas. Las reconozco como fallas mías de
interpretación o de verificación:

| # | Qué dije | Qué pasa en realidad | Causa |
|---|----------|----------------------|-------|
| 1 | "PDF arreglado" (spec 26) | Sigue en blanco al imprimir/exportar | Lo verifiqué con una captura estática, no con una impresión real. El enfoque `@media print` es frágil. **Decisión tomada: rehacerlo con una vista de impresión dedicada.** |
| 3 | "Usuario oculto listo" (Fase A) | Era una *marca* sobre un perfil existente (ej. Juan), no un usuario aparte | Interpreté de menos. Se quería un usuario propio e independiente del dueño. |
| 7 | "Agrupación por carriles" (Fase A) | Agrupa TODO el tablero a la vez | Se quería control **por columna**, independiente. |

## 3. Bugs nuevos reportados (verificados en el código)

| # | Síntoma | Diagnóstico preliminar |
|---|---------|------------------------|
| 2 | Recurrencia diaria borra los checklist anteriores | El checklist vive en la card (uno solo); las ejecuciones diarias lo comparten. Falta historial por ejecución. Es parte del cambio de modelo de datos (ver punto 8). |
| 4 | Las consultas van al jefe, no a un buzón de administración | La policy de `consultas` usa `es_jefe()`. Debe apuntar al usuario fantasma. |
| 5 | Al entrar, pantalla vacía hasta apretar "Mi tablero" | A diagnosticar y reproducir; el estado inicial de la vista no carga el tablero directo. |

## 4. Funcionalidades pedidas todavía no hechas

| # | Qué | Tamaño |
|---|-----|--------|
| 6 | Automatizar el mantenimiento (dependencias, pipeline, análisis estático) | Medio — es configuración |
| 7 | Menú de orden/agrupación por columna | Medio — rediseño de lo que hice |
| 8 | Períodos de trabajo por empleado (varios meses abiertos, cada uno con sus datos sin pisarse) | **Grande — cambio de modelo de datos.** Va con diseño previo y tu OK. |

## 5. Pendiente MÍO (lo resuelvo yo, sin que hagas nada)

Todo lo de las secciones 2, 3 y 4 de este documento se implementa por código y lo deployo yo.
El orden y el detalle están en el plan `docs/superpowers/plans/2026-07-22-28-correcciones.md`.

## 6. Pendiente TUYO (solo lo que depende de credenciales o decisiones)

Acordamos que las tareas de mantenimiento las automatizo; acá queda solo lo que NO puedo hacer yo:

1. **Correr la migración 31** (Supabase → SQL Editor) — habilita etiquetas y empresas, y elimina un doble fetch de tareas que hoy ocurre en cada evento en tiempo real. Sin apuro, pero cuanto antes mejor para el rendimiento.
2. **Activar el trigger de notificaciones** — con el orden estricto de `docs/PASOS-MANUALES.md` (reload de schema → verificar el RPC desde la app → recién ahí el `enable trigger`).
3. **Rotación de credenciales** (clave de `jefe1`, PAT de GitHub) — **diferida por tu decisión** hasta salir de beta. Anotado, sin riesgo mientras sea beta cerrada.
4. **Decisiones de producto abiertas**: ¿va el ICR (índice de calidad del registro) y mostrado cómo? ¿el cronómetro se descarta? (la propuesta lo desaconseja). Ver `docs/PROPUESTA-ICR.md`.
5. **Sentry** (monitoreo de errores en producción): cuando quieras, creás el proyecto gratis y me pasás el DSN; el Error Boundary ya está preparado para enchufarlo. Ver `docs/SEGURIDAD.md`.

## 7. Riesgos abiertos que quiero dejar por escrito

- **Verificación de la impresión**: no tengo forma perfecta de simular "Imprimir → PDF" de un navegador real. Por eso el nuevo enfoque (vista dedicada) es intrínsecamente más simple de validar, y te voy a pedir una confirmación visual tuya antes de darlo por cerrado.
- **Deploy vs. caché**: si alguna corrección "no se ve" después de que la suba, puede ser la PWA vieja cacheada. La forma segura de forzar la última versión es cerrar y reabrir la app (o reinstalar la PWA). Lo tengo presente al verificar.
- **Cambio de modelo de datos (períodos)**: es el cambio más grande del proyecto. Por eso va con diseño y tu aprobación antes de tocar la base — para no rehacer trabajo pesado.
