import { Grid, T } from '../world-kit.ts';

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

/** The six underground pockets shared by all worlds (same places and sizes as the farm's). */
export const POCKETS: Pocket[] = [
  { x: 14, y: 205, w: 126, h: 133 },
  { x: 156, y: 200, w: 106, h: 138 },
  { x: 272, y: 210, w: 76, h: 128 },
  { x: 366, y: 245, w: 102, h: 93 },
  { x: 486, y: 225, w: 70, h: 113 },
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

/** Line each pocket with bricks and open it; draw each pocket's contents with its local origin at the pocket corner. */
export function carvePockets(g: Grid, draws: ((g: Grid) => void)[]): void {
  for (const p of POCKETS) {
    g.bricks(p.x - 3, p.y - 3, p.w + 6, p.h + 3, T.STONE, 8, 4);
    g.air(p.x, p.y, p.w, p.h);
  }
  POCKETS.forEach((p, i) => g.at(p.x, p.y, () => draws[i](g)));
}

/** Carve a vertical shaft and wall it with stone through the soil, so loose dirt cannot slump into it. */
export function shaft(g: Grid, x: number, y0: number, w: number, y1: number): void {
  g.rect(x, y0, w, y1 - y0, T.AIR);
  for (let y = Math.max(y0, SURFACE - 2); y < SURFACE + 16; y++) {
    g.set(x - 1, y, T.STONE);
    g.set(x + w, y, T.STONE);
  }
}
