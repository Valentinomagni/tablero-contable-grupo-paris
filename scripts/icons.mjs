// Genera icon-192.png e icon-512.png para la PWA: isologo blanco sobre negro marca.
import puppeteer from "puppeteer-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const logo = `
<svg width="62%" height="62%" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 49 V15 H40 C47 15 51 19.5 51 25.5 C51 31.5 47 36 40 36 H31 V49 Z M31 21.5 V29.5 H39 C42 29.5 44 28 44 25.5 C44 23 42 21.5 39 21.5 Z" fill="white" fill-rule="evenodd"/>
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
