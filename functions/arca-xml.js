// Cloudflare Pages Function: proxy del feed XML de ARCA (mismo rol que el _redirects de Netlify).
// Ruta automática: /arca-xml
export async function onRequest() {
  const r = await fetch("https://www.arca.gob.ar/vencimientos/xml/vencimientos.xml");
  return new Response(r.body, {
    status: r.status,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
