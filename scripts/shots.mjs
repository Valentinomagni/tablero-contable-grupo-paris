// Capturas de las vistas logueadas con Edge headless (puppeteer-core, sin descargas).
// Uso: node scripts/shots.mjs <urlBase> <carpetaSalida> [light|dark]
import puppeteer from "puppeteer-core";

// Credenciales por entorno, NUNCA en el código.
//
// Acá estaban en claro el usuario y la contraseña de una cuenta con rol jefe. El commit
// "fix(seguridad): credenciales de e2e fuera del código" sacó las de `e2e/` y dio el tema por
// cerrado — pero estas tres copias quedaron, y `docs/SEGURIDAD.md` declaró el estado BIEN. Una
// corrección aplicada en 2 de 5 archivos y declarada completa es peor que ninguna: nadie vuelve
// a buscar el string.
const USUARIO = process.env.E2E_USER;
const CLAVE = process.env.E2E_PASSWORD;
if (!USUARIO || !CLAVE) {
  console.error("Faltan E2E_USER y E2E_PASSWORD en el entorno.");
  console.error("PowerShell:  $env:E2E_USER='...'; $env:E2E_PASSWORD='...'");
  process.exit(1);
}


const [, , base = "http://localhost:5173", out = ".", scheme = "light"] = process.argv;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--window-size=1440,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);

await page.goto(base, { waitUntil: "networkidle2" });
await page.screenshot({ path: `${out}/1-login.png` });

// login
await page.type('input[autocomplete="username"]', USUARIO);
await page.type('input[type="password"]', CLAVE);
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForFunction(() => document.body.innerText.includes("Resumen del equipo"), { timeout: 15000 }),
]);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${out}/2-resumen.png` });

// tablero de una persona
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Empleado 1"))?.click());
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${out}/3-tablero.png` });

// reporte ejecutivo
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reporte ejecutivo"))?.click());
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${out}/4-reporte.png` });

// dark mode del resumen
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Resumen")?.click());
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${out}/5-resumen-dark.png` });

// móvil 375px (sidebar off-canvas + tiles apiladas)
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
await page.setViewport({ width: 375, height: 812 });
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${out}/6-movil.png` });

await browser.close();
console.log("shots ok");
