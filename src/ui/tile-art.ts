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

export interface TextMask {
  width: number;
  height: number;
  /** 1 where the glyphs cover the cell. */
  mask: Uint8Array;
}

const FONT_PER_ROW = 1.28;
const fontFor = (rows: number): string => `800 ${rows * FONT_PER_ROW}px system-ui, "Segoe UI", Arial, sans-serif`;

/**
 * Tallest lettering, at most `desired` rows, whose width fits in `availableCells`; 0 when it
 * would be under `minRows` tall and so unreadable.
 */
export function fitRows(text: string, desired: number, availableCells: number, minRows: number): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (ctx === null) return desired;
  ctx.font = fontFor(100);
  const cellsPerRow = (ctx.measureText(text).width / 100) + 0.02;
  const rows = Math.min(desired, Math.floor(availableCells / cellsPerRow));
  return rows >= minRows ? rows : 0;
}

/** Rasterize `text` in a heavy sans-serif to a mask exactly `rows` cells tall. */
export function textMask(text: string, rows: number): TextMask {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return { width: 0, height: 0, mask: new Uint8Array(0) };
  const font = fontFor(rows);
  ctx.font = font;
  const width = Math.max(1, Math.ceil(ctx.measureText(text).width) + 2);
  canvas.width = width;
  canvas.height = rows;
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 1, rows * 0.8);
  const data = ctx.getImageData(0, 0, width, rows).data;
  const mask = new Uint8Array(width * rows);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
  return { width, height: rows, mask };
}

/**
 * Letter tiles from a mask, layered by depth: stone in the middle of each stroke, steel
 * along its edge and the occasional wood accent, so burning leaves a visible skeleton.
 */
export function letterCells(source: TextMask, random: () => number): Uint32Array {
  const { width, height, mask } = source;
  const cells = new Uint32Array(width * height);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (at(x, y) === 0) continue;
      const interior = at(x - 1, y) === 1 && at(x + 1, y) === 1 && at(x, y - 1) === 1 && at(x, y + 1) === 1;
      let type: number = SETTINGS.STEEL_TYPE;
      if (interior) type = random() < 0.18 ? SETTINGS.WOOD_TYPE : SETTINGS.STONE_TYPE;
      cells[y * width + x] = tile(type, Math.floor(random() * 256));
    }
  }
  return cells;
}
