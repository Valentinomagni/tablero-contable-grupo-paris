// Los ÚNICOS efectos impuros de la recuperación de fallas, aislados acá para que la
// clasificación (`fallas.ts`) siga siendo pura y testeable sin simular el navegador.

/** ¿Hay conexión? Envuelto para poder inyectarlo en los tests. */
export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Recarga de verdad, para el caso "hay una versión nueva".
 *
 * Un `location.reload()` pelado NO alcanza: el service worker puede devolver el shell viejo
 * desde la caché y volver a pedir el mismo módulo que no existe, dejando a la persona en un
 * bucle. Así que primero se borra la caché y se desregistra el service worker, y sólo
 * después se recarga. Cada paso va en su propio try: si el navegador no soporta uno, los
 * demás tienen que ejecutarse igual.
 */
export async function actualizarApp(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const nombres = await caches.keys();
      await Promise.all(nombres.map((n) => caches.delete(n)));
    }
  } catch { /* sin Cache API: seguimos */ }

  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* sin service worker: seguimos */ }

  try {
    window.location.reload();
  } catch { /* en tests no hay location real */ }
}
