// Isologo Grupo Paris — asset OFICIAL procesado desde logo.jpg (fondo negro removido,
// alpha = luminancia; ver scripts/logo-from-jpg.py). Nada redibujado: fidelidad 1:1.
// Variante blanca: para fondos oscuros (sidebar, login). Para fondos claros existe
// /brand/isotipo-negro.png.
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <img src="/brand/isotipo-blanco.png" width={size} height={size} alt="Grupo Paris"
      className={className} style={{ display: "block" }} />
  );
}
