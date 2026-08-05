# Nivel del proyecto — medido al 05/08/2026

Este documento existe para responder con números la pregunta "¿qué tan serio es esto?".
Todo lo que sigue está medido, no estimado. Los comandos que lo producen están al final,
para que cualquiera pueda volver a correrlos y verificar.

Versión medida: **2.13.0**.

---

## 1. Pruebas

| Qué | Número |
|---|---|
| Pruebas automáticas, todas verdes | 1198 |
| Archivos de prueba | 107 |
| Duración de la corrida completa (local) | 77 s |
| Pruebas de punta a punta (Playwright) | 2 archivos (`app`, `a11y`) |

## 2. Cobertura de la lógica

| Qué | Número |
|---|---|
| Módulos de lógica en `src/lib` | 99 |
| Módulos con archivo de prueba propio | 94 |
| Archivos de prueba en `src/lib` | 97 |

Los 5 módulos sin prueba propia y el motivo:

| Módulo | Por qué no tiene prueba propia |
|---|---|
| `supabase.ts` | Es la creación del cliente. Probarlo sería probar la librería de terceros. |
| `types.ts` | Sólo declaraciones de tipos. TypeScript ya lo verifica en cada compilación. |
| `recuperacion.ts` | Se ejercita desde las pruebas de `fallas.ts` y de `ErrorBoundary`. |
| `settings-guardar.ts` | Se ejercita desde las pruebas de la pantalla de configuración. |
| `undo.ts` | Se ejercita desde las pruebas de las pantallas que ofrecen deshacer. |

## 3. Cobertura de la interfaz

| Qué | Número |
|---|---|
| Componentes y pantallas (`.tsx`, sin contar pruebas) | 67 |
| Con archivo de prueba propio | 8 |

Los 8: `Board`, `Carriles`, `EnQueAnda`, `BlanquearClave`, `ErrorBoundary`,
`NovedadesModal`, `Panel`, `Skeleton`.

No se persiguió un porcentaje. Se eligieron por dónde duele un error: el tablero es la
pantalla que todos ven todos los días, "en qué anda el equipo" muestra datos de personas, y
el blanqueo de clave toca credenciales. Ver la sección 6.

## 4. Peso de arranque

| Archivo | Comprimido |
|---|---|
| `index` (código de la app) | 153,1 kB |
| `vendor-supabase` | 50,7 kB |
| `vendor-query` | 11,3 kB |
| `index` (estilos) | 7,1 kB |
| **Total de arranque** | **222,2 kB** |
| Presupuesto | 240 kB |
| Margen | 17,8 kB |

El presupuesto no es un comentario en un documento: `scripts/peso.mjs` corre en el CI en
cada push y falla la compilación si el total se pasa. Un número que no se verifica solo deja
de ser cierto sin que nadie se entere.

## 5. Otros

| Qué | Número |
|---|---|
| Archivos con `console.log` en `src` | 0 |
| Usos de `any` en `src` | 0 |
| Errores de TypeScript | 0 |
| Errores de lint | 0 (quedan 5 advertencias, ninguna bloqueante) |
| Archivos de migración SQL | 27 |
| Archivos fuente en `src` (sin contar pruebas) | 182 |

## 6. Brechas abiertas

Lo que falta, con el motivo. Un documento de nivel que sólo lista lo que está bien no sirve
para decidir nada.

**El monitoreo de errores está a medio conectar.** `src/lib/monitoreo.ts` tiene la parte que
decide qué se manda y qué no —`anonimizar` y `debeReportar`, con 9 pruebas— pero no las dos
funciones que hablan con el servicio. Faltan porque dependen de `@sentry/react`, que todavía
no está instalado: la instalación se hace desde el CI con el workflow "Dependencias", que aún
no se corrió. Consecuencia hoy: si una pantalla se le rompe a alguien, seguimos dependiendo de
que esa persona lo cuente. El propio archivo documenta qué falta y cómo completarlo.

**La cobertura de interfaz es de 8 de 67 componentes.** Es baja y es deliberada. Perseguir un
porcentaje lleva a pruebas que verifican que el código hace lo que hace. Las 8 se eligieron
por consecuencia de un error, no por cantidad. La brecha real no es el número: es que las
pantallas de Períodos y de Reporte, que también son de uso diario, todavía no están en esa
lista.

**El workflow "Dependencias" nunca se corrió.** Está escrito y commiteado, pero hasta que no
se ejecute una vez no se sabe si funciona. Bloquea instalar `@sentry/react` y quitar las 6
dependencias sin uso que reporta `knip`.

**Quedan 6 dependencias sin uso instaladas.** `knip` las identifica. No hacen daño más allá
del tiempo de instalación, y salen con el workflow de arriba.

**La Edge Function del blanqueo de contraseña no está desplegada.** La pantalla y sus pruebas
están; el lado del servidor falta. Ver `docs/ESTADO-DEL-PROYECTO.md`.

**El tiempo de CI no está medido acá.** Los 77 s de la sección 1 son de esta máquina, no del
CI, que además instala dependencias, compila y corre Playwright. Para ponerlo hay que leerlo
de una corrida real en GitHub.

---

## Cómo se midió

```bash
node node_modules/vitest/vitest.mjs run                       # pruebas y archivos
ls src/lib/*.ts | grep -v test | wc -l                        # modulos de logica
ls src/lib/*.test.ts | wc -l                                  # archivos de prueba de logica
find src/features src/components -name "*.tsx" | grep -v test | wc -l
find src -name "*.test.tsx" | wc -l
node node_modules/vite/bin/vite.js build && node scripts/peso.mjs   # peso de arranque
grep -rc "console\.log" src --include=*.ts --include=*.tsx | grep -v ":0" | wc -l
node node_modules/typescript/bin/tsc -b                        # errores de tipos
node node_modules/oxlint/bin/oxlint                            # lint
```
