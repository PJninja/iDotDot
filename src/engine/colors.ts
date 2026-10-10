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

/** A color at a position (0..1) along a gradient. */
export interface ColorStop {
  at: number;
  color: [number, number, number];
}

/**
 * Sample a piecewise-linear gradient at `count` evenly spaced points (first stop
 * at index 0, last at count - 1); aging elements use it as their per-age ramp.
 */
export function buildGradient(stops: readonly ColorStop[], count = 256): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const f = i / (count - 1);
    let k = 1;
    while (k < stops.length - 1 && f > stops[k].at) k++;
    const a = stops[k - 1];
    const b = stops[k];
    const m = Math.max(0, Math.min(1, (f - a.at) / (b.at - a.at)));
    return [0, 1, 2].map((c) => Math.round(a.color[c] + (b.color[c] - a.color[c]) * m)) as [
      number,
      number,
      number,
    ];
  });
}
