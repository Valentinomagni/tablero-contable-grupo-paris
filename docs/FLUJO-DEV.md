# Flujo de trabajo: dev → main (staging gratis con Cloudflare)

## El problema que resuelve
Hasta ahora, cada push a `main` iba directo a producción: cualquier error lo veían
los jefes antes que nosotros. Cloudflare Pages genera automáticamente una **URL de
vista previa** por cada rama que no sea `main` — staging sin costo ni configuración.

## El flujo

1. **Las features nuevas se trabajan en la rama `dev`** (ya está creada y pusheada).
2. Al pushear `dev`, Cloudflare arma un deploy de preview. La URL aparece en:
   **Cloudflare Dashboard → Workers & Pages → tablero-contable → Deployments**
   (los de `dev` figuran como "Preview"; la URL es del estilo
   `https://<hash>.tablero-contable-XXX.pages.dev`).
3. Se revisa la preview: se prueba la feature con datos reales (la preview apunta a
   la MISMA base de Supabase que producción — ojo con datos de prueba destructivos).
4. Si está todo bien: merge a `main` (`git checkout main && git merge dev && git push`)
   → deploy real a producción.
5. Hotfixes urgentes de una línea pueden ir directo a `main` con los gates verdes.

## Reglas
- `main` = producción. Solo se mergea lo que ya se vio funcionando en una preview.
- `dev` se rebasea/mergea desde `main` antes de empezar una tanda nueva.
- Los gates (tsc + tests del pre-commit, CI de GitHub) rigen igual en ambas ramas.
- El changelog (`src/lib/version.ts`) se actualiza en `dev`, y la versión nueva
  llega a los usuarios recién con el merge a `main` (regla de `CLAUDE.md`).
