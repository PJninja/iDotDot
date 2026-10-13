import { Grid, T, shades } from '../world-kit.ts';
import { checkCircuits, type Circuit } from './circuits.ts';
import {
  BLOCK,
  COMPACT,
  KEEP_OUT_CELLS,
  MOBILE,
  MOBILE_BLOCK,
  NARROW,
  ROW_STRIP,
  WIDE,
  corridor,
  footprint,
  type BoardGeometry,
  type CellRect,
} from '../../src/worlds/board-slots.ts';

/** Where the chips of one world sit: the block of slots (rings included), the gallery, and the layouts to check. */
export interface BoardLayout {
  block: CellRect;
  gallery: CellRect;
  geometries: readonly (readonly [string, BoardGeometry])[];
}

/** The 640-wide worlds. */
export const DESKTOP_LAYOUT: BoardLayout = {
  block: BLOCK,
  gallery: WIDE.gallery,
  geometries: [['wide', WIDE], ['narrow', NARROW], ['compact', COMPACT]],
};

/** The phone world. */
export const MOBILE_LAYOUT: BoardLayout = { block: MOBILE_BLOCK, gallery: MOBILE.gallery, geometries: [['mobile', MOBILE]] };

/** Row of the first ground cell on the flat plateaus; every world is "above ground" up to here. */
export const SURFACE = 158;
/** Last open row of every underground pocket. The world runs 42 rows further down, under the board's gallery. */
export const POCKET_FLOOR = 337;

export interface Pocket {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The five underground pockets shared by all worlds. The portfolio board sits in the rock at
 * columns 184 to 456 (`BLOCK`) and runs from row 202 down to the floor with its gallery, so
 * no room fits under it: pocket 2 stands left of its hall and pocket 4 right of it, both
 * 33 and 31 cells wide, so the 30% larger chips fit between them. Pockets 1, 5 and 6 keep
 * their boxes.
 */
export const POCKETS: Pocket[] = [
  { x: 14, y: 205, w: 126, h: 133 },
  { x: 146, y: 200, w: 33, h: 138 },
  { x: 460, y: 245, w: 31, h: 92 },
  { x: 494, y: 225, w: 70, h: 113 },
  { x: 570, y: 240, w: 64, h: 98 },
];

/** Soil over bedrock from the surface down, with a few earthy lenses. */
export function fillGround(g: Grid, surface: (x: number) => number, grassUntil = 640): void {
  for (let x = 0; x < 640; x++) {
    const top = surface(x);
    for (let y = top; y < g.height; y++) g.set(x, y, y < top + 12 ? T.DIRT : T.STONE);
    g.set(x, top, x < grassUntil ? T.GRASS : T.DIRT);
    g.set(x, top + 1, x < grassUntil ? T.GRASS : T.DIRT);
  }
  for (let i = 0; i < 60; i++) {
    const type = [T.RUBBLE, T.DIRT, T.SAND, T.MUD][Math.floor(g.rand() * 4)];
    g.ellipse(Math.floor(g.rand() * 640), 175 + Math.floor(g.rand() * (g.height - 183)), 3 + g.rand() * 6, 2 + g.rand() * 3, type);
  }
}

/**
 * Line each pocket with bricks and open it; draw each pocket's contents with its local origin at the pocket corner.
 * `tweaks` changes a pocket's box for one world (keyed by pocket index), for scenes that route a duct past it.
 */
export function carvePockets(g: Grid, draws: ((g: Grid) => void)[], tweaks: Record<number, Partial<Pocket>> = {}): void {
  const pockets = POCKETS.map((p, i) => ({ ...p, ...tweaks[i] }));
  for (const p of pockets) {
    g.bricks(p.x - 3, p.y - 3, p.w + 6, p.h + 3, T.STONE, 8, 4);
    g.air(p.x, p.y, p.w, p.h);
  }
  pockets.forEach((p, i) => g.at(p.x, p.y, () => draws[i](g)));
}

/**
 * Carve joined rectangles as one stone-lined cavity filled with `fill`: every hull first, then
 * every bore, so the joints stay open and loose rock lenses cannot slump in. Carve vertical
 * shafts afterwards where a cavity must open into one.
 */
export function lined(g: Grid, rects: [number, number, number, number][], fill: number = T.AIR): void {
  for (const [x, y, w, h] of rects) g.rect(x - 1, y - 1, w + 2, h + 2, T.STONE);
  for (const [x, y, w, h] of rects) g.rect(x, y, w, h, fill);
}

/** Carve a vertical shaft and wall it with stone through the soil, so loose dirt cannot slump into it. */
export function shaft(g: Grid, x: number, y0: number, w: number, y1: number): void {
  g.rect(x, y0, w, y1 - y0, T.AIR);
  for (let y = Math.max(y0, SURFACE - 2); y < SURFACE + 16; y++) {
    g.set(x - 1, y, T.STONE);
    g.set(x + w, y, T.STONE);
  }
}

/** Cells of air between the block and the walls of its hall. */
const HALL_MARGIN = 1;

/**
 * The gallery corridor under the chips: a brick-lined gallery whose air interior is where the
 * search, tag words and pager are drawn, with a steel rail along its floor. `rail` leaves
 * out the rail for worlds that want something else there.
 */
export function galleryCorridor(g: Grid, lining: number = T.STONE, rail = true): void {
  const outer = corridor(WIDE.gallery);
  g.bricks(outer.x, outer.y, outer.w, outer.h, lining, 8, 4);
  g.air(WIDE.gallery.x, WIDE.gallery.y, WIDE.gallery.w, WIDE.gallery.h);
  if (rail) g.rect(WIDE.gallery.x, WIDE.gallery.y + WIDE.gallery.h - 1, WIDE.gallery.w, 1, T.STEEL);
}

/**
 * The hall the chips hang in: a brick-lined cavity around the whole block, so every ring
 * material (stone included) shows against a dark recess instead of against rock. Draw it
 * before `pipeLattice`, which attaches to its walls.
 */
export function boardHall(g: Grid): void {
  const x = BLOCK.x - HALL_MARGIN;
  const y = BLOCK.y - HALL_MARGIN;
  const w = BLOCK.w + 2 * HALL_MARGIN;
  const h = BLOCK.h + 2 * HALL_MARGIN;
  g.bricks(x - 2, y - 2, w + 4, h + 4, T.STONE, 8, 4);
  g.air(x, y, w, h);
}

/**
 * A pipe along the strip between the two chip rows, wall to wall of the hall. The strip is
 * clear of every ring in all three layouts, so no hull touches a keep-out zone. `hull` and
 * `bore` give the pipe's material and what is inside it (air by default). There are no
 * vertical pipes between the columns: the narrow and compact layouts put a chip across that gap.
 */
export function pipeLattice(g: Grid, hull: number = T.STEEL, bore: number = T.AIR): void {
  const x = BLOCK.x - HALL_MARGIN;
  g.rect(x, ROW_STRIP.y, BLOCK.w + 2 * HALL_MARGIN, ROW_STRIP.h, hull);
  g.rect(x, ROW_STRIP.y + 1, BLOCK.w + 2 * HALL_MARGIN, ROW_STRIP.h - 2, bore);
}

/** Smooth random offsets in [0, amp] along `length` cells, through a random value every `step` cells. */
function wobble(g: Grid, length: number, amp: number, step: number): number[] {
  const knots = Array.from({ length: Math.ceil(length / step) + 2 }, () => g.rand() * amp);
  return Array.from({ length }, (_, i) => {
    const k = Math.floor(i / step);
    const t = (1 - Math.cos(((i % step) / step) * Math.PI)) / 2;
    return Math.round(knots[k] + (knots[k + 1] - knots[k]) * t);
  });
}

/**
 * A natural cavern around the board instead of the brick hall: open air from `side` cells left
 * and right of the block and `top` cells above it down to the floor under the gallery, with a
 * rough outline up to `rough` cells further out and a darker rock face. Returns its bounds,
 * which `finishBoard` takes as `hall`. Draw the gallery corridor afterwards.
 */
export function naturalCavern(g: Grid, side = 8, top = 4, rough = 4, layout: BoardLayout = DESKTOP_LAYOUT): CellRect {
  const { block } = layout;
  const outer = corridor(layout.gallery);
  const x0 = block.x - side;
  const x1 = block.x + block.w + side;
  const y0 = block.y - top;
  const y1 = outer.y + outer.h;
  const rows = y1 - y0 + rough;
  const left = wobble(g, rows, rough, 9);
  const right = wobble(g, rows, rough, 9);
  const ceiling = wobble(g, x1 - x0 + 2 * rough, rough, 11);
  const floor = wobble(g, x1 - x0 + 2 * rough, 2, 7);
  const bounds = { x: x0 - rough, y: y0 - rough, w: x1 - x0 + 2 * rough, h: y1 - y0 + rough + 2 };
  const open = (x: number, y: number): boolean => {
    const i = x - bounds.x;
    const j = y - bounds.y;
    if (i < 0 || i >= bounds.w || j < 0 || j >= rows) return false;
    const underGallery = x >= outer.x && x < outer.x + outer.w;
    const bottom = underGallery ? y1 : y1 + floor[i];
    return x >= x0 - left[j] && x < x1 + right[j] && y >= y0 - ceiling[i] && y < bottom;
  };
  const order = shades(T.STONE);
  for (let y = bounds.y - 2; y < bounds.y + bounds.h + 2; y++) {
    for (let x = bounds.x - 2; x < bounds.x + bounds.w + 2; x++) {
      if (open(x, y)) {
        g.set(x, y, T.AIR);
        continue;
      }
      if (g.typeAt(x, y) !== T.STONE) continue;
      let near = 3;
      for (let d = 1; d <= 2 && near === 3; d++) {
        for (let dy = -d; dy <= d && near === 3; dy++) for (let dx = -d; dx <= d; dx++) if (open(x + dx, y + dy)) near = d;
      }
      if (near <= 2) g.set(x, y, T.STONE, { variant: order[near === 1 ? 0 : Math.floor(g.rand() * 2)] });
    }
  }
  return bounds;
}

/** Cells a scene must not put within `KEEP_OUT_CELLS` of a ring: anything that acts on its own. */
const ACTIVE_TYPES = new Set<number>([
  T.WATER, T.ACID, T.STEAM, T.METHANE, T.SMOKE, T.FLAME, T.EMBER, T.SPARK, T.EXPLOSION, T.BOMB, T.TORCH, T.SPRING,
  T.HOT_STEEL, T.COOLING_STEEL, T.MOLD, T.MUD, T.GENERATOR, T.ARC, T.LIVE_STEEL, T.LIVE_COPPER, T.SHOCKED_WATER, T.LIVE_FUSE,
]);

export interface BoardOptions {
  /** Bounds of the cavity the chips hang in (default: the brick hall of `boardHall`). */
  hall?: CellRect;
  /** Cells around `hall` that must hold nothing that acts on its own (default 0: only the rings' keep-out zones are checked). */
  quiet?: number;
  /** Where the chips sit in this world (default: the 640-wide worlds). */
  layout?: BoardLayout;
}

/** Turn the bedrock's random mud lenses near the board into dirt, then run `checkBoard` and `checkCircuits` for the scene's electric `circuits`. Call last. */
export function finishBoard(g: Grid, world: string, circuits: Circuit[] = [], options: BoardOptions = {}): void {
  const { block, gallery } = options.layout ?? DESKTOP_LAYOUT;
  const outer = corridor(gallery);
  g.replace(block.x - 8, block.y - 8, block.w + 16, outer.y + outer.h - block.y + 16, T.MUD, T.DIRT);
  checkBoard(g, world, options);
  checkCircuits(g, world, circuits);
}

/**
 * Throws when the rock around any chip slot (ring plus `KEEP_OUT_CELLS`) holds a type that
 * acts on its own, when a gallery interior cell is not air, or when a slot's footprint
 * leaves the grid. Run after a world is built.
 */
/** Flood the air connected to (x, y); a cell outside `bounds` means the cavity leaks into the rest of the world. */
function leaks(g: Grid, label: string, x: number, y: number, bounds: CellRect): string[] {
  const seen = new Set<number>();
  const stack: [number, number][] = [[x, y]];
  const key = (cx: number, cy: number): number => cy * 4096 + cx;
  seen.add(key(x, y));
  while (stack.length > 0) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < bounds.x || cy < bounds.y || cx >= bounds.x + bounds.w || cy >= bounds.y + bounds.h) {
      return [`${label}: air escapes the cavity at (${cx}, ${cy})`];
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || seen.has(key(nx, ny)) || g.typeAt(nx, ny) !== T.AIR) continue;
      seen.add(key(nx, ny));
      stack.push([nx, ny]);
    }
  }
  return [];
}

function checkBoard(g: Grid, world: string, options: BoardOptions): void {
  const { block, gallery, geometries } = options.layout ?? DESKTOP_LAYOUT;
  const problems: string[] = [];
  const scan = (rect: CellRect, label: string): void => {
    for (let y = rect.y - KEEP_OUT_CELLS; y < rect.y + rect.h + KEEP_OUT_CELLS; y++) {
      for (let x = rect.x - KEEP_OUT_CELLS; x < rect.x + rect.w + KEEP_OUT_CELLS; x++) {
        const t = g.typeAt(x, y);
        if (t < 0) problems.push(`${label}: (${x}, ${y}) is outside the grid`);
        else if (ACTIVE_TYPES.has(t)) problems.push(`${label}: type ${t} at (${x}, ${y})`);
      }
    }
  };
  for (const [name, geometry] of geometries) {
    geometry.slots.forEach((slot, i) => scan(footprint(slot), `${name} slot ${i}`));
    const { x, y, w, h } = geometry.gallery;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) if (g.typeAt(x + i, y + j) !== T.AIR && !(j === h - 1 && g.typeAt(x + i, y + j) === T.STEEL)) problems.push(`${name} gallery: not air at (${x + i}, ${y + j})`);
    }
  }
  const hall = options.hall ?? { x: block.x - HALL_MARGIN, y: block.y - HALL_MARGIN, w: block.w + 2 * HALL_MARGIN, h: block.h + 2 * HALL_MARGIN };
  problems.push(...leaks(g, 'hall', block.x + 5, block.y + 5, hall));
  const quiet = options.quiet ?? 0;
  if (quiet > 0) {
    for (let y = hall.y - quiet; y < hall.y + hall.h + quiet; y++) {
      for (let x = hall.x - quiet; x < hall.x + hall.w + quiet; x++) {
        const t = g.typeAt(x, y);
        if (ACTIVE_TYPES.has(t)) problems.push(`quiet zone: type ${t} at (${x}, ${y})`);
      }
    }
  }
  problems.push(...leaks(g, 'gallery', gallery.x + 2, gallery.y + 2, gallery));
  if (problems.length > 0) {
    const shown = problems.slice(0, 12).join('\n  ');
    throw new Error(`${world}: board check failed (${problems.length} problems)\n  ${shown}`);
  }
}
