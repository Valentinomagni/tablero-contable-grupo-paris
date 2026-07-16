// Isologo Grupo Paris — recreación vectorial fiel del logo oficial:
// P sólida en cuadrado redondeado, con el swoosh que ATRAVIESA el marco (entra por abajo,
// abraza la panza de la P y corta la esquina superior derecha) y el corte diagonal del asta.
// Técnica: mask recorta bandas a lo largo del arco y del corte; el arco se dibuja encima más fino.
const ARC = "M33 64 C 46 54 57 32 60.5 3";
const NOTCH = "M19.5 44 L32 40";
const P_PATH =
  "M23 51 V13 H41 C48.5 13 53 17.8 53 24.5 C53 31.2 48.5 36 41 36 H30.5 V51 Z " +
  "M30.5 20 V29 H40 C43.5 29 45.7 27.3 45.7 24.5 C45.7 21.7 43.5 20 40 20 Z";

export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  const uid = "cut-logo"; // id estable: un solo LogoMark visible por vista
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Grupo Paris">
      <defs>
        <mask id={uid}>
          <rect width="64" height="64" fill="white" />
          <path d={ARC} stroke="black" strokeWidth="9" fill="none" />
          <path d={NOTCH} stroke="black" strokeWidth="2.6" fill="none" />
        </mask>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="13" stroke="currentColor" strokeWidth="4.5" mask={`url(#${uid})`} />
      <path d={P_PATH} fill="currentColor" fillRule="evenodd" mask={`url(#${uid})`} />
      <path d={ARC} stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
