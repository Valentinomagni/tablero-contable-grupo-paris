import { clasificarFalla } from "./fallas";
import { actualizarApp, estaOnline } from "./recuperacion";

// Fallas que NO pasan por el árbol de React y por lo tanto el ErrorBoundary no ve:
// una promesa rechazada en segundo plano, un error suelto en un listener, o el evento propio
// de Vite cuando un módulo diferido no se puede bajar.
//
// Sin esto, ese tipo de falla no deja rastro en ninguna parte: la acción simplemente no pasa
// y la persona se queda esperando sin saber que algo falló.
//
// `avisar` se inyecta en vez de importar el toast directo: así se testea sin montar la UI, y
// la lib no queda atada a la librería de notificaciones del momento.

type Accion = { texto: string; hacer: () => void };
type Avisar = (mensaje: string, accion?: Accion) => void;

export function instalarRedGlobal(avisar: Avisar): () => void {
  // Un aviso por fallo idéntico convierte una falla en una avalancha de carteles y la persona
  // deja de leerlos. Se recuerda lo ya avisado y se muestra una sola vez por falla distinta.
  const yaAvisado = new Set<string>();

  const manejar = (e: unknown) => {
    const falla = clasificarFalla(e, estaOnline());
    const clave = falla.tipo + "|" + falla.titulo;
    if (yaAvisado.has(clave)) return;
    yaAvisado.add(clave);

    const accion: Accion | undefined = falla.accion === "actualizar"
      ? { texto: "Actualizar", hacer: () => { void actualizarApp(); } }
      : undefined;
    avisar(falla.titulo + ". " + falla.explicacion, accion);
  };

  const onRejection = (ev: Event) => manejar((ev as PromiseRejectionEvent).reason);
  const onError = (ev: Event) => manejar((ev as ErrorEvent).error ?? (ev as ErrorEvent).message);
  // Vite avisa por su cuenta cuando falla el preload de un módulo diferido, y ese evento
  // llega antes (y con mejor información) que el error genérico.
  const onPreload = (ev: Event) => manejar((ev as Event & { payload?: unknown }).payload);

  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  window.addEventListener("vite:preloadError", onPreload);

  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
    window.removeEventListener("vite:preloadError", onPreload);
  };
}
