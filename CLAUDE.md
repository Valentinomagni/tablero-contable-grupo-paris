# CLAUDE.md

## Ramas
Features nuevas van a la rama `dev` (Cloudflare genera una preview por rama); merge a `main` = deploy a producción, solo tras revisar la preview. Hotfixes chicos pueden ir directo a `main`. Ver `docs/FLUJO-DEV.md`. (Este flujo rige desde el spec 28 en adelante.)

## Release / Novedades

Antes de todo push a `main` que agregue funcionalidad visible: agregar una entrada arriba de `CHANGELOG` en `src/lib/version.ts` (versión semver + fecha + cambios en lenguaje de usuario). `APP_VERSION` se deriva sola de esa entrada — nunca se edita a mano. Ver `docs/RELEASE.md`.
