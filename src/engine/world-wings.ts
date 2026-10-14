/**
 * Ground that continues a default world sideways when the window is wider than the world, so
 * ultrawide screens see countryside instead of the world's cut edge. Pure and import-free (type
 * ids are the stable constants of settings.ts), so it can be checked in Node.
 *
 * A wing is generated from the world's own edge: the surface continues from the edge column's
 * ground row along a gentle curve, the layers below (soil, then rock) are the edge column's, and
 * the tile colors come from the world's outer columns mirrored back and forth. Only grass, dirt
 * and stone are used, so nothing active is repeated and shafts or ledges near the edge do not
 * show up as stripes.
 */
const DIRT = 2;
const STONE = 15;
const GRASS = 16;
/** Ember, flame, spark, bomb, methane, torch, generator: grass beside these could start a fire that runs along the wing. */
const FIRE_SOURCES: ReadonlySet<number> = new Set([9, 10, 11, 13, 22, 27, 31]);

/** All sizes below are CSS px, so a wing looks the same at every tile size. */
const STRIP_CSS = 128;
const RAMP_CSS = 160;
const RIM_CSS = 24;
const FIRE_SCAN_CSS = 192;
const FIREBREAK_CSS = 256;
const CAP_ROWS = 2;
const MIN_SURFACE_ROW = 8;
const MIN_ROCK_ROWS = 24;

const RELIEF = [
  { amplitude: 36, wavelength: 720 },
  { amplitude: 8, wavelength: 240 },
];
const PHASES = { left: [0.8, 2.1], right: [3.4, 0.5] } as const;

const isGround = (type: number): boolean => type === GRASS || type === DIRT || type === STONE;

function hash(x: number, y: number): number {
  let h = Math.imul(x ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(y + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** First soil row of a column (grass or dirt, so posts and pillars above the ground are skipped), else its first stone row, else -1. */
function groundRow(grid: Uint32Array, width: number, height: number, x: number): number {
  for (let y = 0; y < height; y++) {
    const type = grid[y * width + x] & 0xff;
    if (type === GRASS || type === DIRT) return y;
  }
  for (let y = 0; y < height; y++) if ((grid[y * width + x] & 0xff) === STONE) return y;
  return -1;
}

/** A column with every non-ground cell replaced by the first ground type below it (stone at the bottom), as packed words. */
function groundColumn(grid: Uint32Array, width: number, height: number, x: number): Uint32Array {
  const column = new Uint32Array(height);
  let below = STONE;
  for (let y = height - 1; y >= 0; y--) {
    const word = grid[y * width + x];
    const type = word & 0xff;
    if (isGround(type)) {
      below = type;
      column[y] = type | (word & 0xff0000);
    } else {
      column[y] = below | ((hash(x, y) & 0xff) << 16);
    }
  }
  return column;
}

/** Surface offset in cells at each distance from the edge: two sines eased in from zero, never steeper than one cell per column. */
function reliefCurve(count: number, tileCss: number, phases: readonly number[]): Int32Array {
  const curve = new Int32Array(count + 1);
  for (let d = 1; d <= count; d++) {
    const css = d * tileCss;
    const t = Math.min(1, css / RAMP_CSS);
    const ease = t * t * (3 - 2 * t);
    let sum = 0;
    RELIEF.forEach(({ amplitude, wavelength }, i) => {
      sum += amplitude * Math.sin((2 * Math.PI * css) / wavelength + phases[i]);
    });
    const raw = Math.round((ease * sum) / tileCss);
    curve[d] = Math.max(curve[d - 1] - 1, Math.min(curve[d - 1] + 1, raw));
  }
  return curve;
}

interface Side {
  /** Grid column of the world's outermost column on this side. */
  edge: number;
  /** +1 for the right side, -1 for the left. */
  dir: 1 | -1;
  /** Columns to fill, from the edge outward. */
  count: number;
  /** World columns that lie inside the grid, counted inward from the edge. */
  available: number;
  phases: readonly number[];
}

function extendSide(grid: Uint32Array, width: number, height: number, tileCss: number, side: Side): void {
  const { edge, dir, count, available, phases } = side;
  const cells = (css: number): number => Math.max(1, Math.round(css / tileCss));
  const ground = groundRow(grid, width, height, edge);
  if (ground < 0) return;

  const strip: Uint32Array[] = [];
  for (let c = 0; c < Math.min(cells(STRIP_CSS), available); c++) strip.push(groundColumn(grid, width, height, edge - dir * c));
  const cap = Array.from({ length: CAP_ROWS }, (_, i) => strip[0][Math.min(height - 1, ground + i)] & 0xff);
  let rock = ground;
  while (rock < height - 1 && (strip[0][rock] & 0xff) !== STONE) rock++;

  let fireNearby = false;
  const scan = Math.min(cells(FIRE_SCAN_CSS), available);
  for (let c = 0; c < scan && !fireNearby; c++) {
    const x = edge - dir * c;
    for (let y = 0; y < height; y++) {
      if (FIRE_SOURCES.has(grid[y * width + x] & 0xff)) {
        fireNearby = true;
        break;
      }
    }
  }

  const relief = reliefCurve(count, tileCss, phases);
  const firebreak = fireNearby ? cells(FIREBREAK_CSS) : 0;
  const rim = count > 2 * cells(RIM_CSS) ? cells(RIM_CSS) : 0;
  const period = 2 * strip.length;
  for (let d = 1; d <= count; d++) {
    const x = edge + dir * d;
    const offset = relief[d];
    const surface = Math.max(MIN_SURFACE_ROW, Math.min(height - MIN_ROCK_ROWS, ground + offset));
    const phase = (d - 1) % period;
    const column = strip[phase < strip.length ? phase : period - 1 - phase];
    const rimmed = d > count - rim;
    for (let y = surface; y < height; y++) {
      const depth = y - surface;
      const row = Math.min(height - 1, y - offset);
      let type = row >= rock ? STONE : strip[0][row] & 0xff;
      if (rimmed) type = STONE;
      else if (depth < CAP_ROWS) type = cap[depth];
      if (type === GRASS && (depth >= CAP_ROWS || d <= firebreak)) type = DIRT;
      const sample = column[row];
      const variant = (sample & 0xff) === type ? sample & 0xff0000 : (hash(x, y) & 0xff) << 16;
      grid[y * width + x] = type | variant;
    }
  }
}

/**
 * Fill the grid columns beside a placed world (the world occupies columns `dx` to `dx + worldWidth
 * - 1`) with ground that continues its edge columns. A side with no spare columns, or whose edge
 * column is cropped by the window, gets nothing. The last few columns of a long wing are bare
 * stone, so a window wider than any wing ends in a clean rock face instead of slumping soil, and
 * a wing beside fire sources (torches, bombs, methane) starts with bare dirt so a spark cannot
 * carry a grass fire along it.
 */
export function extendWings(grid: Uint32Array, width: number, height: number, dx: number, worldWidth: number, tileCss: number): void {
  if (dx > 0 && dx < width) {
    extendSide(grid, width, height, tileCss, {
      edge: dx,
      dir: -1,
      count: dx,
      available: Math.min(worldWidth, width - dx),
      phases: PHASES.left,
    });
  }
  const rightEdge = dx + worldWidth - 1;
  if (rightEdge >= 0 && rightEdge < width - 1) {
    extendSide(grid, width, height, tileCss, {
      edge: rightEdge,
      dir: 1,
      count: width - 1 - rightEdge,
      available: Math.min(worldWidth, rightEdge + 1),
      phases: PHASES.right,
    });
  }
}
