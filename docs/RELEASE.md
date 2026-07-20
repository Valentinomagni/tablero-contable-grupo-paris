# Proceso de release

Antes de cada push a `main` que agregue funcionalidad visible:

1. Agregar una entrada arriba de `CHANGELOG` en `src/lib/version.ts` (versión semver + fecha + cambios redactados en lenguaje de usuario, sin jerga técnica).
2. El test de `version.test.ts` valida que el changelog esté ordenado en forma descendente y sin versiones duplicadas.
3. `APP_VERSION` se deriva automáticamente de `CHANGELOG[0].version` — no se edita a mano.
4. Al deployar, cada usuario ve el modal de Novedades una única vez de forma automática.
