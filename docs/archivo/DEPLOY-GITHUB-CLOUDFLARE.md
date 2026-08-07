# Conectar GitHub + Cloudflare Pages (una sola vez, ~10 min)

> ESTADO (15/07/2026): YA CONECTADO. Repo real: `Valentinomagni/tablero-contable-grupo-paris` (privado).
> Cloudflare Pages enlazado: cada `git push` a `main` despliega solo. Los pasos de abajo quedan como referencia histórica.

> Con esto muere el zip manual y el problema de créditos de Netlify: Cloudflare Pages es gratis sin límite de builds ni tráfico.

## 1. Crear la cuenta GitHub del proyecto (lo hacés vos)
1. En una ventana de incógnito: https://github.com/signup
2. Email sugerido: uno del proyecto (puede ser un alias tuyo, ej: valentino.magni+grupoparis@icloud.com). Usuario sugerido: `grupoparis-tablero`.
3. Creá un repositorio **privado** llamado `tablero-contable-v2` (sin README, vacío).
4. Generá un token: Settings → Developer settings → Personal access tokens → Fine-grained → Repository access: solo ese repo → Permissions: Contents Read/Write. Copiá el token.

## 2. Primer push (me lo pedís a mí con el token, o lo corrés vos)
```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
git remote add origin https://<TOKEN>@github.com/Valentinomagni/tablero-contable-grupo-paris.git
git push -u origin main
```

## 3. Cloudflare Pages (lo hacés vos)
1. https://dash.cloudflare.com → sign up gratis (mismo email).
2. Workers & Pages → Create → Pages → Connect to Git → autorizar GitHub → elegir `tablero-contable-v2`.
3. Build settings: Framework preset **Vite** · Build command `npm run build` · Output `dist`.
4. Deploy. La URL queda tipo `tablero-contable-v2.pages.dev` (después se puede poner dominio propio).

## Notas técnicas (ya resueltas en el repo)
- El proxy ARCA para Cloudflare ya está en `functions/arca-xml.js` (Pages Function). El `_redirects` de Netlify sigue en `public/` — conviven; cada plataforma usa el suyo.
- A partir de acá: cada `git push` a main = deploy automático. El equipo entra siempre a la misma URL.
- Netlify queda como plan B (los créditos free se renuevan cada mes).
