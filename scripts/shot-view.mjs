// Captura CUALQUIER vista logueada, en claro u oscuro y en el viewport que quieras.
// Herramienta de verificación visual reutilizable (evita improvisar un script por captura).
// Uso: node scripts/shot-view.mjs <urlBase> <carpetaSalida> "<texto del botón de nav>" [light|dark] [ancho] [alto]
// Ej:  node scripts/shot-view.mjs http://localhost:8124 ./out "Cierre mensual" dark 1440 900
import puppeteer from "puppeteer-core";

const [, , base = "http://localhost:8124", out = ".", navText = "Resumen", scheme = "light", w = "1440", h = "900"] = process.argv;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const slug = navText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: [`--window-size=${w},${h}`] });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h) });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);

await page.goto(base, { waitUntil: "networkidle2" });
await page.type('input[type="email"]', "jefe1@grupoparis.com");
await page.type('input[type="password"]', "Paris2026!");
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForFunction(() => document.body.innerText.includes("Resumen del equipo"), { timeout: 15000 }),
]);
await new Promise((r) => setTimeout(r, 1000));

if (navText !== "Resumen") {
  const clicked = await page.evaluate((t) =>
    !![...document.querySelectorAll("button")].find((b) => b.textContent.includes(t))?.click(), navText);
  if (!clicked) { console.error(`No encontré el botón de nav "${navText}"`); await browser.close(); process.exit(1); }
  await new Promise((r) => setTimeout(r, 1000));
}

const path = `${out}/view-${slug}-${scheme}.png`;
await page.screenshot({ path });
await browser.close();
console.log(`ok → ${path}`);
