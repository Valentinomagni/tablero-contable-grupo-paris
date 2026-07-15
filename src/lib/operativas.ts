export function nuevaCantidad(actual: number, delta: number): number {
  return Math.max(0, actual + delta);
}
