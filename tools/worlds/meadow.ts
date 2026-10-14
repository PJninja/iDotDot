import { Grid, T, WORLD_HEIGHT, shades } from '../world-kit.ts';
import { corridor, WIDE } from '../../src/worlds/board-slots.ts';
import { finishBoard, naturalCavern } from './underground.ts';

/**
 * Meadow: the primary default world. Mostly underground under a thin meadow with a small lake;
 * a rabbit warren in the topsoil over the board, buried finds in the rock to either side, and
 * the chips in a wide, quiet cavern so they are the easiest thing on the screen to find.
 * Everything is natural except one buried chest. Design: plans/meadow.md.
 */
const W = 640;
const H = WORLD_HEIGHT;
/** Cells around the cavern that hold nothing that acts on its own. */
const QUIET = 16;

const SURFACE_POINTS: [number, number][] = [
  [0, 106], [50, 114], [90, 127], [170, 127], [260, 130], [340, 129], [420, 131], [446, 132], [532, 132],
  [566, 126], [610, 116], [640, 108],
];

/** Row of the first soil cell along x (cosine-eased between control points). */
function surface(x: number): number {
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
const rockTop = (x: number): number => Math.round(183 + 1.5 * Math.sin(x / 23) + Math.sin(x / 7.3));

/** Topsoil over stone with gently banded strata; grass on top except where `bare` says. */
function terrain(g: Grid, bare: (x: number) => boolean): void {
  const stone = shades(T.STONE);
  for (let x = 0; x < W; x++) {
    const top = surface(x);
    const rock = rockTop(x);
    for (let y = top; y < H; y++) {
      if (y < rock) {
        g.set(x, y, T.DIRT);
        continue;
      }
      const band = Math.floor((y + 5 * Math.sin(x / 41) + 2 * Math.sin(x / 13)) / 9) % 2;
      g.set(x, y, T.STONE, { variant: stone[band === 0 ? 1 + Math.floor(g.rand() * 3) : Math.floor(g.rand() * 3)] });
    }
    if (!bare(x)) {
      g.set(x, top, T.GRASS);
      g.set(x, top + 1, T.GRASS);
    }
  }
}

/** One clump of a crown: an ellipse of leaves with a ragged edge. */
function leafClump(g: Grid, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
      if (d <= 0.65 || (d <= 1 && g.rand() < 0.5)) g.setIfAir(x, y, T.LEAVES);
    }
  }
}

/**
 * A tree: a bark trunk flaring at its foot, branches forking into a crown of leaf clumps (both
 * static, so the crown needs nothing under it), and bark roots spreading into the soil. The
 * crown is shaded light at the top left to dark underneath. `lean` (-1..1) tilts the crown to
 * one side.
 */
function tree(g: Grid, x: number, h: number, spread: number, lean: number): void {
  const top = surface(x);
  const fork = top - h;
  const grain = shades(T.BARK);
  const columnShade = (cx: number): number => grain[(cx * 7 + 3) % grain.length];
  for (let y = fork; y < top + 2; y++) {
    const f = (y - fork) / (top + 2 - fork);
    const half = f > 0.86 ? 3 : f > 0.4 ? 2 : 1;
    for (let dx = -half; dx <= half; dx++) {
      g.set(x + dx, y, T.BARK, { variant: g.rand() < 0.12 ? grain[0] : columnShade(x + dx) });
    }
  }

  const cx = x + Math.round(lean * 4);
  const crownTop = fork - 2 * Math.round(spread * 0.55);
  const clumps: [number, number, number, number][] = [
    [cx, crownTop + 7, Math.round(spread * 0.6), 7],
    [cx - Math.round(spread * 0.55), fork - 7, Math.round(spread * 0.5), 6],
    [cx + Math.round(spread * 0.55), fork - 8, Math.round(spread * 0.5), 6],
    [cx - Math.round(spread * 0.2), fork - 2, Math.round(spread * 0.45), 4],
    [cx + Math.round(spread * 0.3), fork - 1, Math.round(spread * 0.4), 4],
  ];
  for (const [ex, ey, rx, ry] of clumps) leafClump(g, ex, ey, rx, ry);

  // branches over the leaves, from the fork about halfway to each clump, so they vanish into the crown
  for (const [ex, ey] of clumps.slice(0, 3)) {
    g.line(x, fork + 3, x + (ex - x) * 0.45, fork + (ey - fork) * 0.45, T.BARK, 2, { variant: grain[0] });
  }
  for (const [ex, ey] of clumps.slice(3)) {
    g.line(x, fork + 1, x + (ex - x) * 0.8, fork + (ey - fork) * 0.8, T.BARK, 1, { variant: grain[1] });
  }

  const leafShades = shades(T.LEAVES);
  const bottom = fork + 6;
  for (let y = crownTop - 1; y <= bottom; y++) {
    for (let lx = cx - spread - 2; lx <= cx + spread + 2; lx++) {
      if (g.typeAt(lx, y) !== T.LEAVES) continue;
      const light = 1 - (y - crownTop) / (bottom - crownTop) - 0.25 * (lx - cx) / spread + 0.35 * (g.rand() - 0.5);
      const k = Math.max(0, Math.min(leafShades.length - 1, Math.round(light * (leafShades.length - 1))));
      g.set(lx, y, T.LEAVES, { variant: leafShades[k] });
    }
  }

  for (const dir of [-1, -0.5, 0, 0.5, 1]) {
    let rx = x;
    for (let y = top + 2; y < top + 16 + Math.floor(g.rand() * 12); y++) {
      if (g.rand() < 0.6) rx += Math.sign(dir) * (g.rand() < Math.abs(dir) ? 1 : 0);
      if (g.typeAt(rx, y) === T.DIRT) g.set(rx, y, T.BARK, { variant: columnShade(rx) });
    }
  }
}

/** Fine roots from the meadow down through the soil over the warren, onto dirt only. */
function rootNetwork(g: Grid, x0: number, x1: number): void {
  for (let x = x0; x < x1; x += 6 + Math.floor(g.rand() * 5)) {
    let rx = x;
    const depth = surface(x) + 10 + Math.floor(g.rand() * 30);
    for (let y = surface(x) + 2; y < depth; y++) {
      if (g.rand() < 0.35) rx += g.rand() < 0.5 ? -1 : 1;
      if (g.typeAt(rx, y) === T.DIRT) g.set(rx, y, T.WOOD);
    }
  }
}

// ---- Warren ------------------------------------------------------------------------------
// Dirt falls, so every burrow stands under a root mat: a wood ceiling two rows thick. Chambers
// have bowl floors and passages step one row per column at most, so no dirt face is steeper
// than 45 degrees. Ceilings are drawn first, then the air, so joints stay open.

interface Chamber {
  x0: number;
  x1: number;
  top: number;
  depth: number;
  /** Depth at the left and right ends: a passage's height where one joins, 0 where the end is closed. */
  ends: [number, number];
}

type Point = [number, number];

/** Height of a burrow passage in cells. */
const PASSAGE_ROWS = 4;

const ceilings: Point[] = [];
const hollows: Point[] = [];

/** Depth of a chamber's bowl at column x: its end depth at each end, one row deeper per column inward, `depth` across the middle. */
const bowl = (c: Chamber, x: number): number => Math.max(0, Math.min(c.depth, c.ends[0] + x - c.x0, c.ends[1] + c.x1 - x));

/** A chamber; `closedLeft` gives it a sloped dead end on the left instead of a passage-height opening. */
function chamber(cx: number, top: number, w: number, depth: number, closedLeft = false): Chamber {
  const x0 = cx - Math.floor(w / 2);
  const c: Chamber = { x0, x1: x0 + w, top, depth, ends: [closedLeft ? 0 : PASSAGE_ROWS, PASSAGE_ROWS] };
  for (let x = c.x0 - 1; x <= c.x1 + 1; x++) ceilings.push([x, top], [x, top - 1]);
  for (let x = c.x0; x <= c.x1; x++) for (let y = top + 1; y <= top + bowl(c, x); y++) hollows.push([x, y]);
  return c;
}

/**
 * A passage `PASSAGE_ROWS` tall along `points`, given as ceiling positions; each leg is flat or
 * diagonal (45 degrees). Its root ceiling stops at the surface, so a passage that climbs out
 * of the ground ends in an open burrow mouth.
 */
function passage(points: Point[]): void {
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const n = Math.abs(bx - ax);
    const dy = Math.sign(by - ay);
    if (Math.abs(by - ay) !== n && dy !== 0) throw new Error(`passage leg (${ax}, ${ay}) to (${bx}, ${by}) is neither flat nor 45 degrees`);
    for (let k = 0; k <= n; k++) {
      const x = ax + k * Math.sign(bx - ax);
      const c = ay + k * dy;
      for (const y of [c - 1, c]) if (y >= surface(x)) ceilings.push([x, y]);
      for (let r = 1; r <= PASSAGE_ROWS; r++) hollows.push([x, c + r]);
    }
  }
}

/** A climbing passage from (x, c) that leaves the ground: it ends a few cells above the surface. */
function mouth(x: number, c: number, dx: number): Point {
  let k = 0;
  while (c - k + PASSAGE_ROWS >= surface(x + k * dx) - 1) k++;
  return [x + k * dx, c - k];
}

/** Root ceilings, then the air, then grass bedding on chamber floors and a few hanging root tips. */
function carveWarren(g: Grid, nests: Chamber[]): void {
  for (const [x, y] of ceilings) g.set(x, y, T.WOOD);
  for (const [x, y] of hollows) g.set(x, y, T.AIR);
  for (const c of nests) {
    for (let x = c.x0 + 1; x < c.x1; x++) {
      const floor = c.top + bowl(c, x) + 1;
      if (g.typeAt(x, floor) === T.DIRT) g.set(x, floor, T.GRASS);
      if (g.rand() < 0.12 && bowl(c, x) >= 4) g.rect(x, c.top + 1, 1, 1 + Math.floor(g.rand() * 2), T.WOOD);
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
const KIT = ['...WW..', '..AAC..', '.AAAAA.', 'PPPPPPP'];
const flip = (art: string[]): string[] => art.map((row) => [...row].reverse().join(''));

/**
 * A rabbit standing with its feet on row `floor`: an ash body heaped no steeper than it can
 * hold on a wooden foot plate, wooden ears, a charcoal eye.
 */
function rabbit(g: Grid, x: number, floor: number, art: string[], facingLeft = false): void {
  const rows = facingLeft ? flip(art) : art;
  g.stamp(x, floor - rows.length, rows, { A: T.ASH, C: T.CHARCOAL, W: T.WOOD, P: T.WOOD });
}

/** A dirt mound beside a burrow mouth, no steeper than 45 degrees. */
function mound(g: Grid, cx: number, w: number): void {
  const ground = Math.min(surface(cx - w), surface(cx + w));
  for (let i = -w; i <= w; i++) {
    const h = Math.floor((w - Math.abs(i)) / 2);
    for (let k = 1; k <= h; k++) g.setIfAir(cx + i, ground - k, T.DIRT);
  }
}

function warren(g: Grid): void {
  ceilings.length = 0;
  hollows.length = 0;
  const n1 = chamber(262, 148, 28, 7);
  const n2 = chamber(330, 163, 34, 8);
  const n3 = chamber(398, 146, 26, 7);
  const pantry = chamber(219, 168, 18, 5, true);
  const mouths: [Point, number][] = [[mouth(n1.x0, n1.top, -1), -1], [mouth(n3.x0, n3.top, -1), -1], [mouth(n3.x1, n3.top, 1), 1]];
  passage([[n1.x0, n1.top], mouths[0][0]]);
  passage([[n1.x0, n1.top], [pantry.x1, pantry.top]]);
  passage([[n1.x1, n1.top], [n1.x1 + 15, n2.top], [n2.x0, n2.top]]);
  passage([[n2.x1, n2.top], [n2.x1 + 17, n3.top], [n3.x0, n3.top]]);
  passage([[n3.x0, n3.top], mouths[1][0]]);
  passage([[n3.x1, n3.top], mouths[2][0]]);
  carveWarren(g, [n1, n2, n3, pantry]);
  // hay heaped in the pantry
  for (let k = 0; k < 4; k++) g.rect(pantry.x0 + 4 + k, pantry.top + pantry.depth - k, 10 - 2 * k, 1, T.GRASS);
  const floorOf = (c: Chamber): number => c.top + c.depth + 1;
  rabbit(g, 256, floorOf(n1), RABBIT);
  rabbit(g, 322, floorOf(n2), RABBIT);
  rabbit(g, 334, floorOf(n2), KIT, true);
  rabbit(g, 393, floorOf(n3), RABBIT, true);
  for (const [[x], dx] of mouths) mound(g, x + dx * 8, 5);
}

// ---- Surface -----------------------------------------------------------------------------

/**
 * A small lake on a stone basin. Dirt and sand within their soak radius (4) of water turn wet and
 * drink it, and grass touching water turns into mud, so every cell within 4 of the water becomes stone
 * (the basin and a rocky rim right beside it) or wet sand (the beach); the bed is mud.
 */
function lake(g: Grid): void {
  const water: Point[] = [];
  for (let x = 452; x <= 526; x++) {
    const depth = Math.min(10, Math.floor(Math.min(x - 452, 526 - x) / 2.2));
    for (let d = 0; d <= depth; d++) g.set(x, 132 + d, T.AIR);
    for (let d = 1; d <= depth; d++) water.push([x, 132 + d]);
  }
  const isWater = new Set(water.map(([x, y]) => y * W + x));
  const near = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isWater.has((y + dy) * W + x + dx)) return true;
    return false;
  };
  for (let y = 124; y < 150; y++) {
    for (let x = 444; x <= 534; x++) {
      const t = g.typeAt(x, y);
      if (t === T.AIR || isWater.has(y * W + x) || !near(x, y, 4)) continue;
      if (isWater.has((y - 1) * W + x)) g.set(x, y, T.MUD);
      else if (near(x, y, 1) || y > 133) g.set(x, y, T.STONE);
      else g.set(x, y, T.WET_SAND);
    }
  }
  for (const [x, y] of water) g.set(x, y, T.WATER);
  for (const x of [447, 449, 529, 531]) g.rect(x, 124 - (x % 3), 1, 132 - 124 + (x % 3), T.WOOD);
}

/** A peat bog: mud with two pools over a sealed stone pocket of methane, bare dirt at its edges so no grass touches the mud. */
function bog(g: Grid): void {
  g.rect(98, 127, 65, 7, T.MUD);
  for (const [x, w] of [[110, 15], [137, 14]]) {
    g.air(x, 127, w, 1);
    g.rect(x, 128, w, 2, T.WATER);
  }
  g.rect(98, 134, 65, 3, T.STONE);
  g.ellipse(130, 143, 31, 7, T.STONE);
  g.ellipse(130, 143, 27, 4, T.METHANE);
}

// ---- Buried finds ------------------------------------------------------------------------

/** A skeleton of ash set in dark rock: spine, ribs, legs, a long tail and a skull. */
function fossil(g: Grid): void {
  const dark = shades(T.STONE)[0];
  for (let i = 0; i < 14; i++) g.ellipse(100 + i * 5.5, 246 + 3 * Math.sin(i), 9, 9 + 3 * Math.cos(i * 1.7), T.STONE, { variant: dark });
  const spine = (t: number): Point => [118 + 44 * t, Math.round(246 - 4 * Math.sin(Math.PI * t))];
  for (let i = 0; i <= 44; i++) g.set(...spine(i / 44), T.ASH);
  for (let t = 0.28; t <= 0.72; t += 0.07) {
    const [x, y] = spine(t);
    g.line(x, y + 1, x - 1, y + 5 + Math.round(2 * Math.sin(Math.PI * t)), T.ASH, 1);
  }
  for (const t of [0.2, 0.8]) {
    const [x, y] = spine(t);
    g.line(x, y + 1, x + 2, y + 7, T.ASH, 1);
    g.line(x + 2, y + 7, x, y + 12, T.ASH, 1);
    g.line(x, y + 12, x + 3, y + 12, T.ASH, 1);
  }
  g.line(118, 246, 108, 252, T.ASH, 1);
  g.line(108, 252, 99, 251, T.ASH, 1);
  g.line(162, 246, 168, 238, T.ASH, 1);
  g.ring(171, 236, 3, 1, T.ASH);
  g.line(173, 238, 177, 238, T.ASH, 1);
}

/** The one man-made thing: a wooden chest with steel bands and a lid ajar, copper coins heaped in it and spilled on the floor of its pocket. */
function chest(g: Grid): void {
  g.ellipse(482, 240, 17, 8, T.AIR);
  g.rect(463, 246, 40, 4, T.STONE);
  g.planks(472, 238, 20, 8, 3);
  for (const x of [475, 488]) g.rect(x, 238, 1, 8, T.STEEL);
  for (const [x, y] of [[472, 238], [490, 238], [472, 244], [490, 244]]) g.rect(x, y, 2, 2, T.STEEL);
  g.rect(481, 240, 2, 2, T.STEEL);
  for (let i = 0; i < 3; i++) g.rect(474 + i, 237 - i, 16 - 2 * i, 1, T.COPPER);
  g.line(491, 236, 474, 231, T.WOOD, 2);
  g.rect(491, 236, 2, 1, T.STEEL);
  for (const [x, y] of [[494, 245], [496, 245], [495, 244], [469, 245], [499, 245]]) g.set(x, y, T.COPPER);
  g.scatter(466, 244, 6, 2, T.RUBBLE, 0.4, T.AIR);
}

/** A stone shell lined with ice crystals around a hollow. */
function geode(g: Grid): void {
  const [cx, cy] = [524, 286];
  g.disc(cx, cy, 13, T.STONE, { variant: shades(T.STONE)[0] });
  g.disc(cx, cy, 10, T.ICE);
  g.disc(cx, cy, 6, T.AIR);
  for (let a = 0; a < Math.PI * 2; a += 0.45) {
    const r = 6 - Math.floor(g.rand() * 3);
    g.line(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * r, cy + Math.sin(a) * r, T.ICE, 1);
  }
}

/** A log rotting in the soil: wood with mold eating into it, which turns it to dirt over half a minute or so. */
function buriedLog(g: Grid): void {
  g.ellipse(565, 142, 17, 3, T.WOOD);
  g.disc(582, 142, 3, T.WOOD, { variant: shades(T.WOOD)[0] });
  g.scatter(548, 139, 36, 7, T.MOLD, 0.18, T.WOOD);
}

/** Small sand lenses sealed in the rock, which pour out when dug into. */
function sandLenses(g: Grid): void {
  for (const [x, y, rx, ry] of [[40, 210, 7, 3], [150, 300, 6, 3], [70, 320, 8, 3], [560, 215, 6, 3], [600, 300, 7, 3], [480, 320, 6, 2]]) {
    g.ellipse(x, y, rx, ry, T.SAND);
  }
}

export function buildMeadow(): Grid {
  const g = new Grid(4242);
  terrain(g, (x) => (x >= 94 && x <= 166) || (x >= 444 && x <= 534));
  sandLenses(g);
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    g.line(14 + i, 236 + 60 * t, 14 + i, 236 + 60 * t + 1 + 4 * Math.sin(Math.PI * t), T.CHARCOAL, 1);
  }
  g.at(-10, 0, () => fossil(g));
  g.at(8, 0, () => chest(g));
  geode(g);
  g.ellipse(516, 201, 26, 5, T.WATER);
  buriedLog(g);
  bog(g);
  lake(g);
  tree(g, 237, 14, 17, -0.5);
  tree(g, 404, 16, 19, 0.5);
  rootNetwork(g, 200, 440);
  warren(g);
  rabbit(g, 196, surface(200), RABBIT);
  rabbit(g, 296, surface(300), KIT);
  for (let i = 0; i < 50; i++) g.setIfAir(Math.floor(g.rand() * W), 4 + Math.floor(g.rand() * 80), T.ICE);

  const hall = naturalCavern(g, 4);
  // rubble and sand drifts in the corners of the cavern floor, well clear of the rings
  for (const [x, w, type] of [[177, 5, T.RUBBLE], [458, 5, T.SAND]] as [number, number, number][]) {
    for (let i = 0; i < w; i++) for (let k = 0; k <= Math.min(i, w - 1 - i) && k < 3; k++) g.setIfAir(x + i, 375 - k, type);
  }
  const outer = corridor(WIDE.gallery);
  g.rect(outer.x, outer.y, outer.w, outer.h, T.STONE);
  g.air(WIDE.gallery.x, WIDE.gallery.y, WIDE.gallery.w, WIDE.gallery.h);
  finishBoard(g, 'meadow', [], { hall, quiet: QUIET });
  return g;
}

