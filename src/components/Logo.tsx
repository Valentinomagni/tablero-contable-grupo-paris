// Isologo Grupo Paris: monograma P en cuadrado redondeado con trazo dinámico,
// recreación vectorial del logo oficial (blanco sobre negro).
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Grupo Paris">
      <rect x="4" y="4" width="56" height="56" rx="13" stroke="currentColor" strokeWidth="4.5" />
      <path d="M23 47 L23 17 H39.5 C46 17 49.5 21 49.5 26.5 C49.5 32.5 45 36.5 38 36.5 H30"
        stroke="currentColor" strokeWidth="6.5" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M8 54 C 18 51 27 46 34 39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
