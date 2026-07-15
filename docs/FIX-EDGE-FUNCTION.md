# Fix: Edge Function crear-usuario — DIAGNÓSTICO FINAL (15/07/2026)

## El problema exacto (verificado por API)
La función `crear-usuario` **SÍ está desplegada** (OPTIONS responde 204). Pero al llamarla devuelve:

```
{"message":"Hello Test!"}
```

Eso es el **código de EJEMPLO "Hello World"** que Supabase pone por defecto al crear una función.
El código real de `crear-usuario` NUNCA reemplazó a ese ejemplo (o se pegó pero no se apretó "Deploy").

Por eso "no funciona": la función existe, pero corre el código equivocado. Es el error #1 del dashboard, no es culpa tuya.

## La solución (5 minutos, exacta)
1. Supabase Dashboard → proyecto `yyyrlopgwmuvfbzwxiwp` → **Edge Functions** → clic en **`crear-usuario`**.
2. Botón **Edit function** (o el ícono de código `</>`).
3. **BORRÁ TODO el código que hay** (el que dice `Hello` / `Deno.serve(...)` de ejemplo). Que quede vacío.
4. Abrí el archivo `tablero-contable/edge-function-crear-usuario.ts` y **copiá TODO su contenido** (desde `import` hasta el último `});`).
5. Pegalo en el editor de la función.
6. **APRETÁ "Deploy"** (arriba a la derecha). Este paso es el que faltó — editar no despliega solo. Esperá el tilde verde de "Deployed".

## Cómo verificar que quedó bien (sin crear usuarios)
Después de re-desplegar, probá desde la app: Administración → Crear usuario nuevo, con una contraseña corta a propósito (ej: "123"). Si la función quedó bien, tiene que decir algo como **"Email y contraseña (mínimo 8) son obligatorios"** (eso significa que el código real está corriendo). Si dice "Hello ..." o crea igual, todavía está el ejemplo.

## Nota
El código de `tablero-contable/edge-function-crear-usuario.ts` es correcto y no necesita configurar ningún
secret (usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase ya inyecta solo). El único paso que
faltaba es reemplazar el ejemplo por ese código y apretar Deploy.

---

# Desplegar la Edge Function `eliminar-usuario` (borrado seguro)

Mismo flujo que `crear-usuario`. Antes de nada, corré la **migración 17** (`tablero-contable-v2/migracion-17-sin-asignar.sql`)
en SQL Editor: crea el perfil centinela "Sin asignar" al que van a parar las tareas de un empleado eliminado.

1. Supabase Dashboard → proyecto `yyyrlopgwmuvfbzwxiwp` → **Edge Functions** → **Deploy new function**.
2. Nombre exacto: **`eliminar-usuario`**.
3. Borrá el código de ejemplo. Abrí `edge-function-eliminar-usuario.ts` (raíz del proyecto) y copiá TODO su contenido
   (desde `import` hasta el último `});`).
4. Pegalo en el editor y apretá **Deploy**. Esperá el tilde "Deployed".

No requiere configurar secrets (usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta solo).

## Qué hace
Recibe `{ userId }`, valida que quien llama sea **jefe**, reasigna las `cards` y `objectives` de ese usuario al centinela
`SIN_ASIGNAR_ID`, borra el auth user y el profile. Devuelve `{ ok: true, reasignadas: N }`. Hasta que esté desplegada,
la app muestra un toast de error claro y no rompe.
