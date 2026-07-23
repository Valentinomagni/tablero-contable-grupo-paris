import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

// Red de contención (docs/SEGURIDAD.md): un error de render en cualquier parte del árbol
// ya no deja la pantalla en blanco — se muestra una pantalla de recuperación sobria.
// Se usa en dos niveles: uno RAÍZ (main.tsx, toda la app) y uno por VISTA (App.tsx,
// con key={view} para que cambiar de vista resetee el boundary solo y el Shell/nav
// sigan andando aunque una vista puntual se rompa).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: cuando se enchufe Sentry (u otro servicio de monitoreo), reportar acá.
    console.error("ErrorBoundary capturó un error de render:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-warn-soft text-warn">
            <AlertTriangle size={20} />
          </span>
          <h2 className="text-base font-bold tracking-tight m-0 text-ink">Algo se rompió en esta pantalla</h2>
          <p className="text-ink2 text-[13px] m-0 max-w-[380px]">
            El resto del equipo puede seguir trabajando sin problema. Probá de nuevo o recargá la app si el error persiste.
          </p>
          <div className="flex gap-2.5 mt-1">
            <button onClick={this.reset}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-line bg-surface2 text-ink hover:bg-surface transition-colors">
              Reintentar
            </button>
            <button onClick={() => window.location.reload()}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)]">
              Recargar la app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
