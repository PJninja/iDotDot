/**
 * Color helpers shared by elements.
 */

/** Clamp to a valid byte channel. */
function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, n));
}

/**
 * Deterministic per-channel shift in ±variance for one variant index.
 * Same (variant, channel) always yields the same shift, so colors are
 * stable across frames without storing anything per tile.
 */
export function shiftColorForVariant(
  baseColor: [number, number, number],
  variant: number,
  variance: number,
): [number, number, number] {
  const shift = (channel: number): number => {
    const hash = ((variant + 1) * 2654435761 + channel * 97) % (2 * variance + 1);
    return hash - variance;
  };
  const [r, g, b] = baseColor;
  return [
    clampChannel(r + shift(0)),
    clampChannel(g + shift(1)),
    clampChannel(b + shift(2)),
  ];
}

/** Precompute the shifted color for every variant in [0, count). */
export function buildVariantColors(
  baseColor: [number, number, number],
  count: number,
  variance: number,
): [number, number, number][] {
  const colors: [number, number, number][] = [];
  for (let v = 0; v < count; v++) {
    colors.push(shiftColorForVariant(baseColor, v, variance));
  }
  return colors;
}
