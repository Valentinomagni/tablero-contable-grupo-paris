// Isologo Grupo Paris — VECTOR real trazado desde logo.jpg con potrace
// (scripts/logo-vector.py): curvas Bezier, nítido a cualquier tamaño, 2 KB.
// Variante blanca para fondos oscuros (sidebar, login); para fondos claros
// existe /brand/isotipo-negro.svg (y los lockups equivalentes).
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <img src="/brand/isotipo-blanco.svg" width={size} height={size} alt="Grupo Paris"
      className={className} style={{ display: "block" }} />
  );
}
