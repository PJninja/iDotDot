/** Fixed-point scale for fall rates: 1 cell per step = 256. */
export const GRAVITY_QUANTUM_SCALE = 256;

/**
 * Effective fall rate in fixed-point quanta, derived from the shared
 * base gravity and a per-element scale/offset:
 *   effective = base * scale + offset   (cells per step, clamped at 0)
 * scale > 1 = heavier (falls faster), scale < 1 = lighter; offset
 * shifts the rate directly.
 */
export function computeGravityQuantum(base: number, scale: number, offset: number): number {
  return Math.round(Math.max(0, base * scale + offset) * GRAVITY_QUANTUM_SCALE);
}
