// Isologo Grupo Paris — recreación vectorial del logo oficial:
// P sólida dentro de cuadrado redondeado, con arco dinámico que barre el cuadrante inferior.
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Grupo Paris">
      <rect x="4" y="4" width="56" height="56" rx="13" stroke="currentColor" strokeWidth="4.5" />
      <path d="M4 40 C 18 58 46 56 60 32" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M24 49 V15 H40 C47 15 51 19.5 51 25.5 C51 31.5 47 36 40 36 H31 V49 Z M31 21.5 V29.5 H39 C42 29.5 44 28 44 25.5 C44 23 42 21.5 39 21.5 Z"
        fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
