// Confirmación de borrado: el jefe debe tipear el nombre EXACTO del empleado.
// Comparación exacta (case-sensitive), tolerando solo espacios al inicio/fin.
export function confirmacionValida(tipeado: string, real: string): boolean {
  const t = tipeado.trim();
  const r = real.trim();
  return r.length > 0 && t === r;
}
