// Smoke test: loguea como jefe, recorre todas las vistas y falla si hay errores de consola.
// Uso: npm run dev (en otra terminal) y luego  node scripts/smoke.mjs [url]
// Sale con código 1 si algo se rompe → sirve de gate antes de generar el zip de deploy.
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://localhost:5173";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const errores = [];
const b = await puppeteer.launch({ executablePath: EDGE, headless: true });
const pg = await b.newPage();
await pg.setViewport({ width: 1440, height: 900 });
// Los 404 de recursos dependen del entorno (ej. /arca-xml solo existe con el proxy de producción):
// no son regresiones de código, así que no los tomamos como fallo del gate.
pg.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.startsWith("Failed to load resource")) return;
  errores.push("console.error: " + t.slice(0, 160));
});
pg.on("pageerror", (e) => errores.push("pageerror: " + String(e).slice(0, 160)));

const paso = (n) => console.log("  ✓ " + n);
try {
  await pg.goto(URL, { waitUntil: "networkidle2" });
  await pg.waitForSelector('input[autocomplete="username"]', { timeout: 10000 });
  paso("login carga");

  await pg.type('input[autocomplete="username"]', "jefe1@grupoparis.com");
  await pg.type("input[type=password]", "Paris2026!");
  await Promise.all([
    pg.click("button[type=submit]"),
    pg.waitForFunction(() => document.body.innerText.includes("Resumen del equipo"), { timeout: 15000 }),
  ]);
  paso("login + Resumen");

  const vistas = ["Reporte ejecutivo", "Cierre mensual", "Organigrama", "Tablón", "Calendario", "Bitácora", "Administración"];
  for (const v of vistas) {
    await pg.evaluate((t) => [...document.querySelectorAll("button,a")].find((x) => x.textContent.trim() === t)?.click(), v);
    await new Promise((r) => setTimeout(r, 900));
    paso(v);
  }

  // tablero de una persona + subtabs
  await pg.waitForFunction(() => [...document.querySelectorAll("aside button")].some((x) => x.textContent.includes("Empleado 1")), { timeout: 8000 });
  await pg.evaluate(() => [...document.querySelectorAll("aside button")].find((x) => x.textContent.includes("Empleado 1")).click());
  await new Promise((r) => setTimeout(r, 700));
  for (const sub of ["Semana", "Objetivos", "Su mes", "Tareas"]) {
    await pg.evaluate((t) => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t)?.click(), sub);
    await new Promise((r) => setTimeout(r, 700));
    paso("subtab " + sub);
  }
} catch (e) {
  errores.push("excepción de flujo: " + String(e).slice(0, 200));
}
await b.close();

if (errores.length) {
  console.error("\n✗ SMOKE FALLÓ (" + errores.length + "):");
  errores.forEach((e) => console.error("   - " + e));
  process.exit(1);
}
console.log("\n✓ SMOKE OK — todas las vistas cargan sin errores de consola.");
