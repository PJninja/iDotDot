/**
 * Drawing kit for authoring default worlds as code. A world is a grid of packed tile
 * words exactly as the GPU stores them (type 0-7, value 8-15, variant 16-23, age 24-31),
 * written out as a .idw file (see src/engine/world-file.ts for the format).
 * Run with `node tools/make-worlds.ts` (Node 22.18+ strips the types itself).
 */
import { deflateSync, gzipSync } from 'node:zlib';

export const T = {
  AIR: 0,
  SAND: 1,
  DIRT: 2,
  WOOD: 3,
  SMOKE: 4,
  WATER: 5,
  STEAM: 6,
  WET_SAND: 7,
  MUD: 8,
  EMBER: 9,
  FLAME: 10,
  SPARK: 11,
  EXPLOSION: 12,
  BOMB: 13,
  CHARCOAL: 14,
  STONE: 15,
  GRASS: 16,
  STEEL: 17,
  HOT_STEEL: 18,
  COOLING_STEEL: 19,
  ACID: 20,
  ICE: 21,
  METHANE: 22,
  MOLD: 23,
  ASH: 24,
  RUBBLE: 25,
  SPRING: 26,
  TORCH: 27,
} as const;

export const TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(T).map(([name, id]) => [id, name.toLowerCase()]),
);

/** Authoring size: 1440p at 4 px tiles. Worlds anchor bottom-center and crop on smaller screens. */
export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 348;
const TILE_CSS = 4;

/** Base color, variant count and variance per type (mirrors the element classes) for previews and shade picking. */
const LOOKS: Record<number, { color: [number, number, number]; count: number; variance: number }> = {
  [T.SAND]: { color: [194, 178, 128], count: 4, variance: 15 },
  [T.DIRT]: { color: [134, 96, 67], count: 4, variance: 15 },
  [T.WOOD]: { color: [139, 90, 54], count: 4, variance: 15 },
  [T.SMOKE]: { color: [150, 150, 158], count: 1, variance: 0 },
  [T.WATER]: { color: [52, 120, 200], count: 1, variance: 0 },
  [T.STEAM]: { color: [238, 242, 248], count: 1, variance: 0 },
  [T.WET_SAND]: { color: [150, 132, 88], count: 4, variance: 12 },
  [T.MUD]: { color: [92, 64, 44], count: 4, variance: 10 },
  [T.EMBER]: { color: [240, 110, 30], count: 1, variance: 0 },
  [T.FLAME]: { color: [255, 160, 40], count: 1, variance: 0 },
  [T.SPARK]: { color: [255, 224, 120], count: 1, variance: 0 },
  [T.EXPLOSION]: { color: [255, 190, 70], count: 1, variance: 0 },
  [T.BOMB]: { color: [62, 62, 72], count: 4, variance: 10 },
  [T.CHARCOAL]: { color: [38, 36, 40], count: 4, variance: 8 },
  [T.STONE]: { color: [118, 116, 112], count: 4, variance: 12 },
  [T.GRASS]: { color: [74, 142, 52], count: 4, variance: 14 },
  [T.STEEL]: { color: [158, 168, 182], count: 4, variance: 8 },
  [T.HOT_STEEL]: { color: [255, 150, 60], count: 1, variance: 0 },
  [T.COOLING_STEEL]: { color: [150, 60, 40], count: 1, variance: 0 },
  [T.ACID]: { color: [140, 214, 48], count: 4, variance: 14 },
  [T.ICE]: { color: [176, 224, 248], count: 4, variance: 10 },
  [T.METHANE]: { color: [188, 214, 104], count: 1, variance: 0 },
  [T.MOLD]: { color: [96, 168, 140], count: 1, variance: 0 },
  [T.ASH]: { color: [148, 146, 150], count: 4, variance: 14 },
  [T.RUBBLE]: { color: [112, 104, 98], count: 6, variance: 24 },
  [T.SPRING]: { color: [74, 132, 196], count: 4, variance: 10 },
  [T.TORCH]: { color: [196, 112, 44], count: 4, variance: 14 },
};

function variantColor(type: number, variant: number): [number, number, number] {
  const look = LOOKS[type];
  if (!look) return [255, 0, 255];
  const v = variant % look.count;
  return [0, 1, 2].map((c) => {
    const shift = (((v + 1) * 2654435761 + c * 97) % (2 * look.variance + 1)) - look.variance;
    return Math.max(0, Math.min(255, look.color[c] + shift));
  }) as [number, number, number];
}

const luma = (c: [number, number, number]): number => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

/** Variant indices of a type ordered dark to light, so a pattern can pick a real shade (mortar, grain). */
export function shades(type: number): number[] {
  const look = LOOKS[type];
  return Array.from({ length: look?.count ?? 1 }, (_, v) => v).sort(
    (a, b) => luma(variantColor(type, a)) - luma(variantColor(type, b)),
  );
}

export interface TileOptions {
  value?: number;
  variant?: number;
  age?: number;
}

export type Legend = Record<string, number | [number, TileOptions]>;

/** Small deterministic PRNG so a world file regenerates byte-identical. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Grid {
  readonly cells: Uint32Array;
  readonly rand: () => number;
  private originX = 0;
  private originY = 0;

  readonly width: number;
  readonly height: number;

  constructor(seed: number, width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    this.rand = makeRng(seed);
    this.width = width;
    this.height = height;
    this.cells = new Uint32Array(width * height);
  }

  /** Run `draw` with all coordinates shifted by (ox, oy), so a vignette can be drawn in its own local space. */
  at(ox: number, oy: number, draw: () => void): void {
    const saved: [number, number] = [this.originX, this.originY];
    this.originX += ox;
    this.originY += oy;
    draw();
    [this.originX, this.originY] = saved;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  typeAt(x: number, y: number): number {
    x += this.originX;
    y += this.originY;
    return this.inBounds(x, y) ? this.cells[y * this.width + x] & 0xff : -1;
  }

  /** Raw tile word at a local coordinate (0 out of bounds). */
  wordAt(x: number, y: number): number {
    x += this.originX;
    y += this.originY;
    return this.inBounds(x, y) ? this.cells[y * this.width + x] : 0;
  }

  /** Write one tile, overwriting; out-of-bounds is ignored. Variant defaults to random. */
  set(x: number, y: number, type: number, opts: TileOptions = {}): void {
    x = Math.round(x) + this.originX;
    y = Math.round(y) + this.originY;
    if (!this.inBounds(x, y)) return;
    if (type === T.AIR) {
      this.cells[y * this.width + x] = 0;
      return;
    }
    const variant = opts.variant ?? Math.floor(this.rand() * 256);
    this.cells[y * this.width + x] =
      (type | ((opts.value ?? 0) << 8) | (variant << 16) | ((opts.age ?? 0) << 24)) >>> 0;
  }

  /** Write only where the cell is air. */
  setIfAir(x: number, y: number, type: number, opts: TileOptions = {}): void {
    if (this.typeAt(x, y) === T.AIR) this.set(x, y, type, opts);
  }

  rect(x: number, y: number, w: number, h: number, type: number, opts: TileOptions = {}): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, type, opts);
  }

  /** Rectangle spanning x0..x1, y0..y1 inclusive. */
  span(x0: number, y0: number, x1: number, y1: number, type: number, opts: TileOptions = {}): void {
    this.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, type, opts);
  }

  air(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h, T.AIR);
  }

  /** Hollow rectangle with a wall `t` thick. */
  box(x: number, y: number, w: number, h: number, t: number, type: number, opts: TileOptions = {}): void {
    this.rect(x, y, w, t, type, opts);
    this.rect(x, y + h - t, w, t, type, opts);
    this.rect(x, y, t, h, type, opts);
    this.rect(x + w - t, y, t, h, type, opts);
  }

  /** Line from (x0,y0) to (x1,y1), `thick` cells wide. */
  line(x0: number, y0: number, x1: number, y1: number, type: number, thick = 1, opts: TileOptions = {}): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const r = (thick - 1) / 2;
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + ((x1 - x0) * s) / steps;
      const cy = y0 + ((y1 - y0) * s) / steps;
      for (let j = Math.floor(-r); j <= Math.ceil(r); j++) {
        for (let i = Math.floor(-r); i <= Math.ceil(r); i++) this.set(Math.round(cx + i), Math.round(cy + j), type, opts);
      }
    }
  }

  disc(cx: number, cy: number, r: number, type: number, opts: TileOptions = {}): void {
    this.ellipse(cx, cy, r, r, type, opts);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, type: number, opts: TileOptions = {}): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, type, opts);
      }
    }
  }

  /** Filled polygon (even-odd scanline). */
  poly(points: [number, number][], type: number, opts: TileOptions = {}): void {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.set(x, y, type, opts);
      }
    }
  }

  /** Random sprinkle over a rectangle: each cell becomes `type` with chance p (only onto cells of `onto`, any if omitted). */
  scatter(x: number, y: number, w: number, h: number, type: number, p: number, onto?: number, opts: TileOptions = {}): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (this.rand() >= p) continue;
        if (onto !== undefined && this.typeAt(x + i, y + j) !== onto) continue;
        this.set(x + i, y + j, type, opts);
      }
    }
  }

  /** Replace cells of type `from` inside a rectangle with `to`, each with chance p. */
  replace(x: number, y: number, w: number, h: number, from: number, to: number, p = 1, opts: TileOptions = {}): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (this.typeAt(x + i, y + j) === from && this.rand() < p) this.set(x + i, y + j, to, opts);
      }
    }
  }

  /** Fill a column band from a ground height function down to `bottom` (exclusive). */
  terrain(x0: number, x1: number, bottom: number, height: (x: number) => number, type: number): void {
    for (let x = x0; x < x1; x++) {
      for (let y = Math.round(height(x)); y < bottom; y++) this.set(x, y, type);
    }
  }

  /** Stamp ASCII art: ' ' and '.' leave the grid alone, other characters map through the legend. */
  stamp(x: number, y: number, art: string[], legend: Legend): void {
    art.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === ' ' || ch === '.') return;
        const entry = legend[ch];
        if (entry === undefined) throw new Error(`stamp: no legend entry for "${ch}"`);
        if (typeof entry === 'number') this.set(x + i, y + j, entry);
        else this.set(x + i, y + j, entry[0], entry[1]);
      });
    });
  }

  /** Brick wall with shaded mortar courses. */
  bricks(x: number, y: number, w: number, h: number, type = T.STONE, brickW = 8, brickH = 4): void {
    const order = shades(type);
    const mortar = order[0];
    const faces = order.slice(1);
    for (let j = 0; j < h; j++) {
      const course = Math.floor(j / brickH);
      const offset = course % 2 === 0 ? 0 : Math.floor(brickW / 2);
      for (let i = 0; i < w; i++) {
        const seam = j % brickH === brickH - 1 || (i + offset) % brickW === brickW - 1;
        const face = faces[Math.floor(this.rand() * faces.length)];
        this.set(x + i, y + j, type, { variant: seam ? mortar : face });
      }
    }
  }

  /** Brick pattern clipped to a polygon (roofs, domes). */
  brickPoly(points: [number, number][], type = T.STONE, brickW = 8, brickH = 4): void {
    const order = shades(type);
    const mortar = order[0];
    const faces = order.slice(1);
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const crossings: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      crossings.sort((p, q) => p - q);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        for (let x = Math.round(crossings[i]); x <= Math.round(crossings[i + 1]); x++) {
          const course = Math.floor(y / brickH);
          const offset = course % 2 === 0 ? 0 : Math.floor(brickW / 2);
          const seam = y % brickH === brickH - 1 || (x + offset) % brickW === brickW - 1;
          this.set(x, y, type, { variant: seam ? mortar : faces[Math.floor(this.rand() * faces.length)] });
        }
      }
    }
  }

  /** Ring (annulus) of outer radius r and thickness `thick`. */
  ring(cx: number, cy: number, r: number, thick: number, type: number, opts: TileOptions = {}): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.4 && d > r - thick + 0.4) this.set(x, y, type, opts);
      }
    }
  }

  /** Gear: a ring with a hub, spokes and square teeth. */
  gear(cx: number, cy: number, r: number, teeth: number, type: number, spokes = 4): void {
    this.ring(cx, cy, r, 2, type);
    this.disc(cx, cy, Math.max(1, Math.floor(r / 5)), type);
    for (let s = 0; s < spokes; s++) {
      const a = (Math.PI * 2 * s) / spokes;
      this.line(cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), type, 1);
    }
    for (let t = 0; t < teeth; t++) {
      const a = (Math.PI * 2 * t) / teeth;
      const x = cx + Math.cos(a) * (r + 1);
      const y = cy + Math.sin(a) * (r + 1);
      this.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, type);
    }
  }

  /** Horizontal planks (wood) with darker seams. */
  planks(x: number, y: number, w: number, h: number, plankH = 4): void {
    const order = shades(T.WOOD);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const seam = j % plankH === plankH - 1;
        this.set(x + i, y + j, T.WOOD, { variant: seam ? order[0] : order[1 + Math.floor(this.rand() * (order.length - 1))] });
      }
    }
  }

  /** Vertical boards (wood). */
  boards(x: number, y: number, w: number, h: number, boardW = 4): void {
    const order = shades(T.WOOD);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const seam = i % boardW === boardW - 1;
        this.set(x + i, y + j, T.WOOD, { variant: seam ? order[0] : order[1 + Math.floor(this.rand() * (order.length - 1))] });
      }
    }
  }

  /** Open-top vessel: walls on the sides and bottom, filled with `fill` up to `level` rows from the inside bottom. */
  vessel(x: number, y: number, w: number, h: number, wall: number, type: number, fill?: number, level = 0): void {
    this.rect(x, y, wall, h, type);
    this.rect(x + w - wall, y, wall, h, type);
    this.rect(x, y + h - wall, w, wall, type);
    if (fill !== undefined && level > 0) this.rect(x + wall, y + h - wall - level, w - 2 * wall, level, fill);
  }

  /** Hollow pipe along a polyline: a `type` hull `wall` thick around an air bore `bore` wide. */
  pipe(points: [number, number][], bore: number, wall: number, type: number): void {
    for (let i = 0; i + 1 < points.length; i++) {
      this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], type, bore + 2 * wall);
    }
    for (let i = 0; i + 1 < points.length; i++) {
      this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], T.AIR, bore);
    }
  }

  typesUsed(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const c of this.cells) {
      const t = c & 0xff;
      if (t !== 0) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  }

  /** Serialize to the .idw format. */
  encode(): Buffer {
    const header = Buffer.alloc(16);
    header.writeUInt32LE(0x31574449, 0);
    header.writeUInt16LE(this.width, 4);
    header.writeUInt16LE(this.height, 6);
    header.writeFloatLE(TILE_CSS, 8);
    const payload = gzipSync(Buffer.from(this.cells.buffer, this.cells.byteOffset, this.cells.byteLength), { level: 9 });
    return Buffer.concat([header, payload]);
  }

  /** Flat-color PNG preview (no simulation), `scale` px per tile. */
  png(scale = 2, crop?: { x: number; y: number; w: number; h: number }): Buffer {
    const c = crop ?? { x: 0, y: 0, w: this.width, h: this.height };
    const pw = c.w * scale;
    const ph = c.h * scale;
    const raw = Buffer.alloc((pw * 4 + 1) * ph);
    const bg: [number, number, number] = [26, 26, 46];
    for (let py = 0; py < ph; py++) {
      raw[py * (pw * 4 + 1)] = 0;
      for (let px = 0; px < pw; px++) {
        const cell = this.cells[(c.y + Math.floor(py / scale)) * this.width + c.x + Math.floor(px / scale)];
        const type = cell & 0xff;
        const col = type === 0 ? bg : variantColor(type, (cell >>> 16) & 0xff);
        const o = py * (pw * 4 + 1) + 1 + px * 4;
        raw[o] = col[0];
        raw[o + 1] = col[1];
        raw[o + 2] = col[2];
        raw[o + 3] = 255;
      }
    }
    return encodePng(pw, ph, raw);
  }
}

function crc32(buf: Buffer): number {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodePng(w: number, h: number, raw: Buffer): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
