import { Grid, T, shades } from '../world-kit.ts';
import { MOBILE, MOBILE_WORLD_CELLS, corridor } from '../../src/worlds/board-slots.ts';
import { MOBILE_LAYOUT, finishBoard, naturalCavern } from './underground.ts';

/**
 * Meadow for phones: the same idea as `meadow` (a thin meadow over rock, the chips in a quiet
 * natural cavern) cut to a phone's grid. A 404 px wide phone shows about 100 columns of the
 * 640-wide world, which left the chips in a mostly empty hall; this world is 106 columns wide
 * and 248 rows tall, with the chips and their gallery in the bottom 110 rows and a landscape
 * above them: sky, a tree, a rabbit, a pond, and fossils and a chest in the
 * rock. Everything is dry and still within the quiet zone of the cavern.
 */
const W = MOBILE_WORLD_CELLS.width;
/** The landscape is drawn 106 columns wide in its own coordinates and centered in the world, which is wider so windows up to the narrow layout's width fill it. */
const SCENE_W = 106;
const OFFSET = (W - SCENE_W) / 2;
const H = MOBILE_WORLD_CELLS.height;
/** Cells around the cavern that hold nothing that acts on its own. */
const QUIET = 12;
/** Row of the pond's surface, flat across the pond and its beaches. */
const POND_ROW = 88;

const SURFACE_POINTS: [number, number][] = [[0, 76], [14, 84], [30, 89], [52, 89], [58, POND_ROW], [SCENE_W, POND_ROW]];

/** Row of the first soil cell along x (cosine-eased between control points). */
function surface(sceneX: number): number {
  const x = Math.min(Math.max(sceneX, 0), SCENE_W);
  for (let i = 0; i + 1 < SURFACE_POINTS.length; i++) {
    const [x0, y0] = SURFACE_POINTS[i];
    const [x1, y1] = SURFACE_POINTS[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return Math.round(y0 + (y1 - y0) * (1 - Math.cos(t * Math.PI)) / 2);
    }
  }
  return SURFACE_POINTS[SURFACE_POINTS.length - 1][1];
}

/** First stone row under the topsoil along x. */
const rockTop = (x: number): number => Math.round(108 + Math.sin(x / 9) + 0.5 * Math.sin(x / 3.1));

/** Topsoil over stone with gently banded strata; grass on top except where `bare` says. */
function terrain(g: Grid, bare: (x: number) => boolean): void {
  const stone = shades(T.STONE);
  for (let x = 0; x < W; x++) {
    const top = surface(x - OFFSET);
    const rock = rockTop(x - OFFSET);
    for (let y = top; y < H; y++) {
      if (y < rock) {
        g.set(x, y, T.DIRT);
        continue;
      }
      const band = Math.floor((y + 3 * Math.sin(x / 17) + 2 * Math.sin(x / 7)) / 8) % 2;
      g.set(x, y, T.STONE, { variant: stone[band === 0 ? 1 + Math.floor(g.rand() * 3) : Math.floor(g.rand() * 3)] });
    }
    if (!bare(x - OFFSET)) {
      g.set(x, top, T.GRASS);
      g.set(x, top + 1, T.GRASS);
    }
  }
}

/** A tree: a bark trunk with two branches into a round leaf crown (leaves are static, so it needs no support), and bark roots spreading into the soil. */
function tree(g: Grid, x: number, h: number): void {
  const top = surface(x);
  g.rect(x - 1, top - h, 3, h + 2, T.BARK);
  g.ellipse(x, top - h - 3, 11, 8, T.LEAVES);
  g.line(x, top - h + 6, x - 7, top - h - 1, T.BARK, 1);
  g.line(x, top - h + 8, x + 7, top - h, T.BARK, 1);
  g.line(x, top - h, x, top - h - 7, T.BARK, 1);
  for (const dir of [-1, -0.5, 0, 0.5, 1]) {
    let rx = x;
    for (let y = top + 2; y < top + 10 + Math.floor(g.rand() * 8); y++) {
      if (g.rand() < 0.6) rx += Math.sign(dir) * (g.rand() < Math.abs(dir) ? 1 : 0);
      if (g.typeAt(rx, y) === T.DIRT) g.set(rx, y, T.BARK);
    }
  }
}

// Every ash row is at least a cell narrower on each side than the row under it, down to a foot
// plate wider than the body, so no grain has an open cell diagonally below it.
const RABBIT = [
  '......W.W..',
  '......WW...',
  '....AAAC...',
  '..AAAAAAA..',
  '.AAAAAAAAA.',
  'PPPPPPPPPPP',
];

/** A rabbit standing with its feet on row `floor`: an ash body on a wooden foot plate, wooden ears, a charcoal eye. */
function rabbit(g: Grid, x: number, floor: number): void {
  g.stamp(x, floor - RABBIT.length, RABBIT, { A: T.ASH, C: T.CHARCOAL, W: T.WOOD, P: T.WOOD });
}

/** A skeleton of ash set in dark rock: spine, ribs, legs, a tail and a skull, with its head to the right. */
function skeleton(g: Grid, x: number, y: number): void {
  const dark = shades(T.STONE)[0];
  for (let i = 0; i < 8; i++) g.ellipse(x + i * 4.5, y + 2 * Math.sin(i), 6, 6 + 2 * Math.cos(i * 1.7), T.STONE, { variant: dark });
  const spine = (t: number): [number, number] => [x + 30 * t, Math.round(y - 3 * Math.sin(Math.PI * t))];
  for (let i = 0; i <= 30; i++) g.set(...spine(i / 30), T.ASH);
  for (let t = 0.3; t <= 0.7; t += 0.1) {
    const [sx, sy] = spine(t);
    g.line(sx, sy + 1, sx - 1, sy + 4 + Math.round(2 * Math.sin(Math.PI * t)), T.ASH, 1);
  }
  for (const t of [0.2, 0.8]) {
    const [sx, sy] = spine(t);
    g.line(sx, sy + 1, sx + 1, sy + 5, T.ASH, 1);
    g.line(sx + 1, sy + 5, sx, sy + 9, T.ASH, 1);
    g.line(sx, sy + 9, sx + 2, sy + 9, T.ASH, 1);
  }
  g.line(x, y, x - 6, y + 4, T.ASH, 1);
  g.line(x + 30, y, x + 34, y - 6, T.ASH, 1);
  g.ring(x + 36, y - 8, 3, 1, T.ASH);
  g.line(x + 38, y - 6, x + 41, y - 6, T.ASH, 1);
}

/** A coiled shell of ash in a disc of dark rock. */
function ammonite(g: Grid, cx: number, cy: number): void {
  g.disc(cx, cy, 8, T.STONE, { variant: shades(T.STONE)[0] });
  g.ring(cx, cy, 5, 1, T.ASH);
  g.ring(cx, cy, 3, 1, T.ASH);
  g.set(cx, cy, T.ASH);
}

/**
 * A small pond on a stone basin. Dirt and sand within their soak radius (4) of water turn wet and
 * drink it, and grass touching water turns into mud, so every cell within 4 of the water becomes stone
 * (the basin and a rocky rim right beside it) or wet sand (the beach); the bed is mud.
 */
function pond(g: Grid, x0: number, x1: number): void {
  const water: [number, number][] = [];
  for (let x = x0; x <= x1; x++) {
    const depth = Math.min(8, Math.floor(Math.min(x - x0, x1 - x) / 2.2));
    for (let d = 0; d <= depth; d++) g.set(x, POND_ROW + d, T.AIR);
    for (let d = 1; d <= depth; d++) water.push([x, POND_ROW + d]);
  }
  const isWater = new Set(water.map(([x, y]) => y * W + x));
  const near = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isWater.has((y + dy) * W + x + dx)) return true;
    return false;
  };
  for (let y = POND_ROW - 6; y < POND_ROW + 14; y++) {
    for (let x = x0 - 8; x <= x1 + 8; x++) {
      const t = g.typeAt(x, y);
      if (t === T.AIR || isWater.has(y * W + x) || !near(x, y, 4)) continue;
      if (isWater.has((y - 1) * W + x)) g.set(x, y, T.MUD);
      else if (near(x, y, 1) || y > POND_ROW + 1) g.set(x, y, T.STONE);
      else g.set(x, y, T.WET_SAND);
    }
  }
  for (const [x, y] of water) g.set(x, y, T.WATER);
  for (const x of [x0 - 4, x0 - 2, x1 + 2, x1 + 4]) g.rect(x, 78 - (x % 3), 1, POND_ROW - 78 + (x % 3), T.WOOD);
}

/** A wooden chest with steel bands and a lid ajar, copper coins heaped in it and spilled on the floor of its pocket. */
function chest(g: Grid, cx: number, cy: number): void {
  g.ellipse(cx, cy, 17, 8, T.AIR);
  g.rect(cx - 19, cy + 6, 40, 4, T.STONE);
  g.planks(cx - 10, cy - 2, 20, 8, 3);
  for (const x of [cx - 7, cx + 6]) g.rect(x, cy - 2, 1, 8, T.STEEL);
  for (const [x, y] of [[cx - 10, cy - 2], [cx + 8, cy - 2], [cx - 10, cy + 4], [cx + 8, cy + 4]]) g.rect(x, y, 2, 2, T.STEEL);
  g.rect(cx - 1, cy, 2, 2, T.STEEL);
  for (let i = 0; i < 3; i++) g.rect(cx - 8 + i, cy - 3 - i, 16 - 2 * i, 1, T.COPPER);
  g.line(cx + 9, cy - 4, cx - 8, cy - 9, T.WOOD, 2);
  g.rect(cx + 9, cy - 4, 2, 1, T.STEEL);
  for (const [x, y] of [[cx + 12, cy + 5], [cx + 14, cy + 5], [cx + 13, cy + 4], [cx - 13, cy + 5], [cx + 17, cy + 5]]) g.set(x, y, T.COPPER);
  g.scatter(cx - 16, cy + 4, 6, 2, T.RUBBLE, 0.4, T.AIR);
}

export function buildMeadowMobile(): Grid {
  const g = new Grid(4243, W, H);
  terrain(g, (x) => x >= 54 && x <= 102);
  g.at(OFFSET, 0, () => {
    for (const [x, y, rx, ry] of [[101, 168, 4, 3], [4, 196, 3, 2], [101, 205, 4, 2]]) g.ellipse(x, y, rx, ry, T.SAND);
    for (let i = 0; i <= 9; i++) g.line(i, 146 + i * 1.5, i, 147 + i * 1.5 + Math.sin((i / 9) * Math.PI) * 2, T.CHARCOAL, 1);
    chest(g, 70, 120);
    pond(g, 62, 94);
    tree(g, 24, 22);
    skeleton(g, 14, 118);
    ammonite(g, 97, 122);
    rabbit(g, 36, surface(40));
  });
  for (let i = 0; i < 14; i++) g.setIfAir(Math.floor(g.rand() * W), 20 + Math.floor(g.rand() * 45), T.ICE);

  const hall = naturalCavern(g, 3, 4, 3, MOBILE_LAYOUT);
  const outer = corridor(MOBILE.gallery);
  g.rect(outer.x, outer.y, outer.w, outer.h, T.STONE);
  g.air(MOBILE.gallery.x, MOBILE.gallery.y, MOBILE.gallery.w, MOBILE.gallery.h);
  finishBoard(g, 'meadow-mobile', [], { hall, quiet: QUIET, layout: MOBILE_LAYOUT });
  return g;
}
