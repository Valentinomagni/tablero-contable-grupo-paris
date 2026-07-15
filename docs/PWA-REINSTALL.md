# Reinstalar la PWA en el nuevo dominio (Cloudflare)

## Qué pasó

La aplicación instalada (PWA) del Tablero Contable quedó atada al dominio **viejo** de Netlify (`contablegrupoparis.netlify.app`). Ahora el tablero vive en el dominio **nuevo** de Cloudflare Pages:

**https://tablero-contable-grupo-paris.pages.dev/**

Por eso, aunque abras la app instalada, seguís viendo la versión vieja. Hay que **desinstalar** la PWA actual y **reinstalarla** desde el dominio nuevo.

## Pasos

1. **Desinstalar la app instalada actual.**
   En Edge o Chrome, abrí la PWA instalada. En el menú de la aplicación (los tres puntos `...` arriba a la derecha) elegí **Desinstalar** (o *App settings → Uninstall*). Confirmá la desinstalación.

2. **Abrir el dominio nuevo en el navegador.**
   Entrá a **https://tablero-contable-grupo-paris.pages.dev/**

3. **Instalarla desde ahí.**
   Hacé clic en el ícono de **instalar** que aparece en la barra de direcciones (a la derecha, un ícono de monitor con una flecha), o desde el menú `...` → **Instalar Tablero Paris**. Confirmá la instalación.

Listo: la app instalada ahora apunta al dominio nuevo y recibe las actualizaciones.

## Nota técnica

Una PWA queda atada al **dominio (origin)** desde el que se instala. El navegador guarda la app, su service worker y su cache bajo ese origin específico. Cuando el sitio se muda a otro dominio, la instalación vieja no "sigue" al sitio: hay que reinstalar desde el nuevo origin para que la app y su cache se creen ahí.
