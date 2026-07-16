// Genera public/logo-1024.png (blanco, fondo transparente) y public/logo-1024-negro.png (#0b0b0d)
// desde el isologo SVG con navegador headless (Edge; fallback chromium de Playwright).
import puppeteer from "puppeteer-core";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// En Windows la limpieza del perfil temporal a veces tira EBUSY después de cerrar: no es error real.
process.on("unhandledRejection", (e) => { if (e?.code === "EBUSY") return; throw e; });

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const pwDir = join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
const pwChromium = existsSync(pwDir)
  ? readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().map((d) => join(pwDir, d, "chrome-win64/chrome.exe")).find(existsSync)
  : undefined;

// Geometría idéntica a src/components/Logo.tsx
const ARC = "M33 64 C 46 54 57 32 60.5 3";
const NOTCH = "M19.5 44 L32 40";
const P_PATH = "M23 51 V13 H41 C48.5 13 53 17.8 53 24.5 C53 31.2 48.5 36 41 36 H30.5 V51 Z M30.5 20 V29 H40 C43.5 29 45.7 27.3 45.7 24.5 C45.7 21.7 43.5 20 40 20 Z";

const mark = (color) => `
<svg width="1024" height="1024" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><mask id="cut"><rect width="64" height="64" fill="white"/>
    <path d="${ARC}" stroke="black" stroke-width="9" fill="none"/>
    <path d="${NOTCH}" stroke="black" stroke-width="2.6" fill="none"/></mask></defs>
  <rect x="4" y="4" width="56" height="56" rx="13" stroke="${color}" stroke-width="4.5" mask="url(#cut)"/>
  <path d="${P_PATH}" fill="${color}" fill-rule="evenodd" mask="url(#cut)"/>
  <path d="${ARC}" stroke="${color}" stroke-width="3.4" stroke-linecap="round"/>
</svg>`;
const html = (color) => `<body style="margin:0">${mark(color)}</body>`;

async function launch() {
  for (const exe of [EDGE, pwChromium]) {
    if (!exe || !existsSync(exe)) continue;
    try { return await puppeteer.launch({ executablePath: exe, headless: true }); } catch { /* siguiente */ }
  }
  throw new Error("No hay navegador headless disponible (Edge ni chromium de Playwright)");
}

const b = await launch();
const p = await b.newPage();
await p.setViewport({ width: 1024, height: 1024 });
for (const [color, out] of [["white", "public/logo-1024.png"], ["#0b0b0d", "public/logo-1024-negro.png"]]) {
  await p.setContent(html(color));
  await p.screenshot({ path: out, omitBackground: true });
  console.log(out, "ok");
}
await b.close().catch(() => { /* EBUSY al limpiar el perfil temporal en Windows: los PNG ya están */ });
