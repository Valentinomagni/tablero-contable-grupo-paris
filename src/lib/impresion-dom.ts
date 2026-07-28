// Única parte de la impresión que toca el navegador (spec 28-correcciones, item 1).
// Se mantiene aparte de impresion.ts para que TODA la lógica de armado siga siendo pura y
// testeable; acá sólo queda lo que inevitablemente necesita `window`.

/**
 * Abre el documento de impresión en una ventana nueva y dispara el diálogo de impresión.
 *
 * POR QUÉ UNA VENTANA NUEVA: imprimir la app en el lugar obligaba a deshacer con CSS todo
 * el armazón (contenedores flex, height:100vh, overflow:hidden) y eso es lo que dejaba la
 * hoja en blanco. Un documento propio no tiene nada de eso que deshacer.
 *
 * Devuelve `false` si el navegador bloqueó la ventana emergente, para que la UI pueda
 * avisar. Sin esto la falla es silenciosa: el usuario aprieta el botón, no pasa nada, y
 * concluye que la app se colgó.
 */
export function abrirImpresion(html: string): boolean {
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
    if (!win) return false;
    // El write va DENTRO del try: si la ventana se cierra en ese instante, o un bloqueador
    // devuelve un stub no escribible, la excepción escapaba del onClick y el aviso al
    // usuario nunca corría — volvía la falla silenciosa que este `return false` evita.
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    return false;
  }

  // El print va DESPUÉS del load. Si se dispara antes de que el documento termine de
  // renderizar, Chrome imprime una hoja vacía — que es justo el síntoma que estamos
  // corrigiendo. El timeout es el plan B por si `load` ya pasó cuando se asigna el handler
  // (documento escrito de forma síncrona: el evento puede haber corrido antes).
  // `yaImprimio` evita que salgan DOS diálogos de impresión cuando disparan los dos
  // caminos (el evento y el timeout de respaldo).
  let yaImprimio = false;
  const imprimir = () => {
    if (yaImprimio) return;
    yaImprimio = true;
    try { win?.focus(); win?.print(); } catch { /* la ventana pudo cerrarse antes */ }
  };
  win.onload = imprimir;
  setTimeout(imprimir, 400);
  return true;
}
