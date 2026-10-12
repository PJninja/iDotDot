import { Grid, T } from '../world-kit.ts';
import {
  BLOCK,
  COMPACT,
  KEEP_OUT_CELLS,
  NARROW,
  ROW_STRIP,
  WIDE,
  corridor,
  footprint,
  type CellRect,
} from '../../src/worlds/board-slots.ts';

/** Row of the first ground cell on the flat plateaus; every world is "above ground" up to here. */
export const SURFACE = 158;
/** Last open row of every underground pocket. */
export const POCKET_FLOOR = 337;

export interface Pocket {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The five underground pockets shared by all worlds. The portfolio board sits in the rock at
 * columns 211 to 429 (`BLOCK`) and runs from row 202 down to the floor with its gallery, so
 * no room fits under it: pocket 2 stands left of its hall and pocket 4 right of it, both
 * narrow. Pockets 1 and 6 keep their boxes; pocket 5 sits 8 columns further east than it
 * used to, to make room for pocket 4.
 */
export const POCKETS: Pocket[] = [
  { x: 14, y: 205, w: 126, h: 133 },
  { x: 152, y: 200, w: 52, h: 138 },
  { x: 436, y: 245, w: 52, h: 92 },
  { x: 494, y: 225, w: 70, h: 113 },
  { x: 570, y: 240, w: 64, h: 98 },
];

/** Soil over bedrock from the surface down, with a few earthy lenses. */
export function fillGround(g: Grid, surface: (x: number) => number, grassUntil = 640): void {
  for (let x = 0; x < 640; x++) {
    const top = surface(x);
    for (let y = top; y < 348; y++) g.set(x, y, y < top + 12 ? T.DIRT : T.STONE);
    g.set(x, top, x < grassUntil ? T.GRASS : T.DIRT);
    g.set(x, top + 1, x < grassUntil ? T.GRASS : T.DIRT);
  }
  for (let i = 0; i < 60; i++) {
    const type = [T.RUBBLE, T.DIRT, T.SAND, T.MUD][Math.floor(g.rand() * 4)];
    g.ellipse(Math.floor(g.rand() * 640), 175 + Math.floor(g.rand() * 165), 3 + g.rand() * 6, 2 + g.rand() * 3, type);
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
const HALL_MARGIN = 2;

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

/** Cells a scene must not put within `KEEP_OUT_CELLS` of a ring: anything that acts on its own. */
const ACTIVE_TYPES = new Set<number>([
  T.WATER, T.ACID, T.STEAM, T.METHANE, T.SMOKE, T.FLAME, T.EMBER, T.SPARK, T.EXPLOSION, T.BOMB, T.TORCH, T.SPRING,
  T.HOT_STEEL, T.COOLING_STEEL, T.MOLD, T.MUD,
]);

/** Turn the bedrock's random mud lenses near the board into dirt, then run `checkBoard`. Call last. */
export function finishBoard(g: Grid, world: string): void {
  const outer = corridor(WIDE.gallery);
  g.replace(BLOCK.x - 8, BLOCK.y - 8, BLOCK.w + 16, outer.y + outer.h - BLOCK.y + 16, T.MUD, T.DIRT);
  checkBoard(g, world);
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

function checkBoard(g: Grid, world: string): void {
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
  for (const [name, geometry] of [['wide', WIDE], ['narrow', NARROW], ['compact', COMPACT]] as const) {
    geometry.slots.forEach((slot, i) => scan(footprint(slot), `${name} slot ${i}`));
    const { x, y, w, h } = geometry.gallery;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) if (g.typeAt(x + i, y + j) !== T.AIR && !(j === h - 1 && g.typeAt(x + i, y + j) === T.STEEL)) problems.push(`${name} gallery: not air at (${x + i}, ${y + j})`);
    }
  }
  const hall = { x: BLOCK.x - HALL_MARGIN, y: BLOCK.y - HALL_MARGIN, w: BLOCK.w + 2 * HALL_MARGIN, h: BLOCK.h + 2 * HALL_MARGIN };
  problems.push(...leaks(g, 'hall', BLOCK.x + 5, BLOCK.y + 5, hall));
  problems.push(...leaks(g, 'gallery', WIDE.gallery.x + 2, WIDE.gallery.y + 2, WIDE.gallery));
  if (problems.length > 0) {
    const shown = problems.slice(0, 12).join('\n  ');
    throw new Error(`${world}: board check failed (${problems.length} problems)\n  ${shown}`);
  }
}
