# Cómo instalar o sacar una dependencia

En esta máquina no hay npm. El runner de GitHub Actions sí, así que se delega ahí.

## Los pasos

1. GitHub → pestaña **Actions** → workflow **Dependencias** → **Run workflow**
2. Elegí:
   - **Qué hacer**: `instalar` o `quitar`
   - **Paquetes**: separados por espacio, por ejemplo `@sentry/react`
   - **¿Es dependencia de desarrollo?**: marcar si es sólo para tests o herramientas
3. Run workflow. Tarda unos 3 minutos.
4. Cuando termina, hacé **Fetch** en GitHub Desktop para traer el commit.
5. Acá corré `git pull` — y listo, `node_modules` local queda desactualizado pero eso no
   importa: el proyecto ya trae las dependencias instaladas y el CI usa las suyas.

**Si el workflow falla en rojo, no commitea nada.** Corre lint, tests y build antes de
commitear justamente para que una dependencia que rompe el proyecto no entre.

## Por qué no se hace solo

Instalar una dependencia es una decisión: agrega superficie, peso y algo más que mantener.
El workflow se dispara a mano a propósito.

## Lo que esto desbloquea

Durante semanas la conclusión fue "no se puede instalar nada, no hay npm". Era falsa: no hay
npm **acá**. Con esto se pueden agregar herramientas de monitoreo, de pruebas y de análisis, y
también **sacar** las que no se usan — que estaban bloqueadas por no poder regenerar el
`package-lock.json`.
