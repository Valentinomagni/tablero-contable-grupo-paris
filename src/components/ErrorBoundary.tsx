import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy } from "lucide-react";
import { clasificarFalla, detalleTecnico } from "../lib/fallas";
import { actualizarApp, estaOnline } from "../lib/recuperacion";

interface Props { children: ReactNode }
interface State { error: Error | null }

// Red de contención (docs/SEGURIDAD.md): un error de render en cualquier parte del árbol
// ya no deja la pantalla en blanco — se muestra una pantalla de recuperación sobria.
// Se usa en dos niveles: uno RAÍZ (main.tsx, toda la app) y uno por VISTA (App.tsx,
// con key={view} para que cambiar de vista resetee el boundary solo y el Shell/nav
// sigan andando aunque una vista puntual se rompa).
//
// La acción que se ofrece NO es fija: la decide `clasificarFalla`. Antes había un
// "Reintentar" para todo, y para el caso más frecuente —una versión nueva publicada
// mientras la app estaba abierta— reintentar no puede funcionar nunca, porque el archivo
// que pide el navegador ya no existe en el servidor. Ver el comentario de `lib/fallas.ts`.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sin servicio de monitoreo externo: el canal para que un error llegue a quien lo puede
    // resolver es Consultas, y para eso la persona necesita poder COPIAR el detalle. Por eso
    // el detalle se muestra en pantalla y no sólo en la consola, que nadie va a abrir.
    console.error("ErrorBoundary capturó un error de render:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  copiarDetalle = (detalle: string) => {
    navigator.clipboard?.writeText(detalle).catch(() => { /* sin permiso de portapapeles */ });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const falla = clasificarFalla(error, estaOnline());
    const detalle = detalleTecnico(error);

    return (
      <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
        <span className="grid place-items-center w-11 h-11 rounded-full bg-warn-soft text-warn">
          <AlertTriangle size={20} />
        </span>
        <h2 className="text-lg font-bold m-0 text-ink">{falla.titulo}</h2>
        <p className="text-ink2 text-sm m-0 max-w-[420px]">{falla.explicacion}</p>

        <div className="flex flex-wrap gap-2.5 justify-center mt-1">
          {falla.accion === "actualizar" && (
            <button onClick={() => { void actualizarApp(); }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)]">
              <RefreshCw size={14} /> Actualizar
            </button>
          )}
          {falla.accion === "reintentar" && (
            <button onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)]">
              <RotateCcw size={14} /> Reintentar
            </button>
          )}
          <button onClick={() => this.copiarDetalle(detalle)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-line bg-surface2 text-ink hover:bg-surface transition-colors">
            <Copy size={14} /> Copiar detalle
          </button>
        </div>

        <p className="text-2xs text-ink2 m-0 mt-2 max-w-[460px] break-words font-mono opacity-70">{detalle}</p>
      </div>
    );
  }
}
