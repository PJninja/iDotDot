import { SETTINGS } from '../settings';

/** Pack a tile the way the GPU stores it (type, variant; value and age zero). */
const tile = (type: number, variant: number): number => (type & 0xff) | ((variant & 0xff) << 16);

/** Small deterministic PRNG so a chip's ring looks the same after every rebuild. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed for a string. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Cells of a rectangular ring: `width * height` words, the border `thickness` cells wide
 * made of `type` and the inside left as air. A lit ring swaps a few top-edge cells for
 * torches, which emit flames upward.
 */
export function ringCells(
  width: number,
  height: number,
  thickness: number,
  type: number,
  lit: boolean,
  random: () => number,
): Uint32Array {
  const cells = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onRing = x < thickness || y < thickness || x >= width - thickness || y >= height - thickness;
      if (onRing) cells[y * width + x] = tile(type, Math.floor(random() * 256));
    }
  }
  if (lit) {
    for (const x of [0, Math.floor(width / 2), width - 1]) {
      cells[x] = tile(SETTINGS.TORCH_TYPE, Math.floor(random() * 256));
    }
  }
  return cells;
}
