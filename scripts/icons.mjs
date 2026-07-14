// Genera icon-192.png e icon-512.png para la PWA: isologo blanco sobre negro marca.
import puppeteer from "puppeteer-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const logo = `
<svg width="60%" height="60%" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="56" height="56" rx="13" stroke="white" stroke-width="4.5"/>
  <path d="M23 47 L23 17 H39.5 C46 17 49.5 21 49.5 26.5 C49.5 32.5 45 36.5 38 36.5 H30" stroke="white" stroke-width="6.5" stroke-linecap="square"/>
  <path d="M8 54 C 18 51 27 46 34 39" stroke="white" stroke-width="3" stroke-linecap="round"/>
</svg>`;
const html = `<body style="margin:0;background:#0b0b0d;display:grid;place-items:center;width:100vw;height:100vh">${logo}</body>`;

const b = await puppeteer.launch({ executablePath: EDGE, headless: true });
for (const size of [192, 512]) {
  const p = await b.newPage();
  await p.setViewport({ width: size, height: size });
  await p.setContent(html);
  await p.screenshot({ path: `public/icon-${size}.png` });
  await p.close();
}
await b.close();
console.log("icons ok");
