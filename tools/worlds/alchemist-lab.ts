import { Grid, T } from '../world-kit.ts';

/** Room-local drawing: (0, 0) is the room's top-left interior cell. */
export interface Room {
  w: number;
  h: number;
  draw: (g: Grid) => void;
}

const ROOM_W = 146;
const DIVIDER = 5;
const WALL = 6;
const BUILDING_X = 90;
const BUILDING_W = 460;
const ROOM_X = [96, 247, 398];
const TOP_Y = 108;
const TOP_H = 104;
const BOTTOM_Y = 217;
const BOTTOM_H = 110;
const GROUND = 327;

/** Glass (ice) beaker: open top, 1-thick walls, filled with `fill` to `level` rows. */
function beaker(g: Grid, x: number, y: number, w: number, h: number, fill: number, level: number): void {
  g.vessel(x, y, w, h, 1, T.ICE, fill, level);
}

/** Reflux still: a steel kettle over torches, an ice-capped arm, and a receiver flask. */
function distillery(g: Grid, h: number): void {
  const floor = h - 1;
  // hearth: plinth with torches, flanked by pillars
  g.bricks(14, floor - 9, 24, 10, T.STONE, 6, 3);
  for (const x of [20, 24, 28]) g.rect(x, floor - 10, 2, 1, T.TORCH);
  g.bricks(8, floor - 24, 4, 25, T.STONE, 4, 3);
  g.bricks(40, floor - 24, 4, 25, T.STONE, 4, 3);
  // kettle
  const cx = 26;
  const cy = floor - 41;
  g.ellipse(cx, cy, 15, 15, T.STEEL);
  g.ellipse(cx, cy, 13, 13, T.AIR);
  for (let y = cy - 1; y <= cy + 13; y++) {
    for (let x = cx - 14; x <= cx + 14; x++) if (g.typeAt(x, y) === T.AIR && Math.hypot(x - cx, y - cy) < 13.5) g.set(x, y, T.WATER);
  }
  // neck, sloped arm (ice roof on the second half), leg, vent
  const armTop = (x: number): number => floor - 69 + Math.round(((x - 26) * 10) / 70);
  g.rect(23, floor - 69, 7, 22, T.STEEL);
  g.rect(25, floor - 69, 3, 22, T.AIR);
  g.rect(23, floor - 72, 7, 3, T.ICE);
  for (let x = 28; x <= 99; x++) {
    const y = armTop(x);
    g.rect(x, y - 3, 1, 3, x >= 58 ? T.ICE : T.STEEL);
    if (x < 93) {
      g.rect(x, y, 1, 3, T.AIR);
      g.rect(x, y + 3, 1, 2, T.STEEL);
    }
  }
  g.rect(93, armTop(96) - 3, 7, 3, T.ICE);
  g.rect(93, armTop(96), 7, 48, T.STEEL);
  g.rect(95, armTop(96), 3, 48, T.AIR);
  g.pipe([[24, floor - 57], [14, floor - 57]], 1, 1, T.STEEL);
  g.set(24, floor - 57, T.AIR);
  // receiver flask
  g.ellipse(96, floor - 7, 11, 7, T.STEEL);
  g.ellipse(96, floor - 7, 9, 5, T.AIR);
  g.rect(95, floor - 20, 3, 14, T.AIR);
  g.ellipse(96, floor - 4, 9, 2, T.WATER);
  // steam already in the neck and arm
  for (let i = 0; i < 40; i++) g.setIfAir(26 + Math.floor(g.rand() * 30), armTop(40) + Math.floor(g.rand() * 3), T.STEAM);
  // test-tube shelf
  g.bricks(108, floor - 38, 34, 3, T.STONE, 6, 3);
  g.bricks(110, floor - 35, 3, 6, T.STONE, 3, 3);
  g.bricks(137, floor - 35, 3, 6, T.STONE, 3, 3);
  const tubes: [number, number][] = [[T.ACID, 8], [T.MUD, 9], [T.SAND, 7], [T.ASH, 8], [T.WET_SAND, 6]];
  tubes.forEach(([fill, level], i) => beaker(g, 111 + i * 6, floor - 51, 5, 13, fill, level));
  // workbench with a mortar and a spare bomb-proof jar
  g.rect(106, floor - 17, 36, 3, T.STEEL);
  g.rect(108, floor - 14, 2, 15, T.STEEL);
  g.rect(138, floor - 14, 2, 15, T.STEEL);
  g.stamp(114, floor - 23, [
    '#.....#',
    '#######',
    '.#####.',
    '..###..',
  ], { '#': T.STONE });
  g.vessel(126, floor - 28, 9, 11, 1, T.STEEL, T.WATER, 6);
  // stray ash and chips on the floor
  g.scatter(60, floor - 1, 30, 2, T.ASH, 0.15, T.AIR);
}

/** Terraced planters watered by a spring; the runoff leaves through the wall to a pond outside. */
function greenhouse(g: Grid): void {
  const floor = 103;
  // spring stub and pipe, falling onto the top planter
  g.rect(138, 8, 8, 16, T.STEEL);
  g.pipe([[136, 16], [104, 16], [104, 42]], 3, 1, T.STEEL);
  g.rect(103, 42, 3, 4, T.AIR);
  g.set(137, 16, T.SPRING);
  g.set(137, 15, T.SPRING);
  g.set(137, 17, T.SPRING);
  // planters (top soil row, left lip one row higher), a soil section inside each
  const planters = [
    { x: 94, w: 52, top: 62 },
    { x: 54, w: 40, top: 76 },
    { x: 22, w: 32, top: 90 },
  ];
  planters.forEach((p, k) => {
    g.bricks(p.x, p.top - 1, 2, floor - p.top + 2, T.STONE, 4, 3);
    g.rect(p.x + 2, p.top, p.w - 2, floor - p.top + 1, T.DIRT);
    g.rect(p.x + 2, floor - 7, p.w - 2, 8, T.RUBBLE);
    g.rect(p.x + 2, floor - 16, p.w - 2, 9, T.SAND);
    g.scatter(p.x + 2, p.top, p.w - 2, 4, T.MUD, 0.3, T.DIRT);
    g.scatter(p.x + 2, p.top + 4, p.w - 2, 6, T.MUD, 0.06, T.DIRT);
    if (k === 0) g.bricks(p.x + p.w - 2, p.top - 1, 2, 1, T.STONE, 2, 1);
  });
  // top planter: tomato stakes with grass at the foot
  for (const x of [102, 114, 126, 138]) {
    g.rect(x, 50, 1, 12, T.WOOD);
    g.rect(x - 2, 51, 5, 1, T.WOOD);
    g.rect(x - 2, 60, 5, 2, T.GRASS);
    g.rect(x - 1, 58, 3, 2, T.GRASS);
  }
  // middle planter: a row of cabbages
  for (const x of [60, 68, 76, 84]) g.poly([[x - 3, 75], [x + 3, 75], [x + 2, 72], [x - 2, 72]], T.GRASS);
  // lower planter: reeds and a rotting stump
  for (const x of [26, 29, 31, 35]) g.rect(x, 82, 1, 8, T.GRASS);
  g.rect(42, 83, 6, 7, T.WOOD);
  g.rect(42, 82, 6, 1, T.MOLD);
  g.rect(43, 85, 1, 2, T.MOLD);
  g.set(47, 86, T.MOLD);
  // skylight panes in the ceiling slab, a drain through the left wall
  for (let x = 16; x < 134; x += 24) g.rect(x, -6, 22, 6, T.ICE);
  g.rect(-6, 101, 6, 3, T.AIR);
  // swamp gas collected under the glass
  for (let i = 0; i < 24; i++) g.setIfAir(40 + Math.floor(g.rand() * 50), Math.floor(g.rand() * 4), T.METHANE);
  // seed shelf with clay pots
  g.rect(8, 56, 36, 2, T.WOOD);
  g.rect(10, 58, 2, 10, T.WOOD);
  g.rect(40, 58, 2, 10, T.WOOD);
  for (let i = 0; i < 4; i++) {
    g.vessel(12 + i * 8, 49, 6, 7, 1, T.STONE, T.DIRT, 5);
    g.rect(14 + i * 8, 46, 2, 3, T.GRASS);
  }
  // hanging tub of ferns
  g.rect(30, 0, 1, 14, T.STEEL);
  g.rect(60, 0, 1, 14, T.STEEL);
  g.vessel(26, 14, 40, 8, 1, T.STEEL, T.DIRT, 5);
  for (let x = 30; x < 64; x += 5) g.rect(x, 11, 2, 3, T.GRASS);
  // watering can
  g.stamp(116, 54, [
    '..###...',
    '.#..#...',
    '#####..#',
    '#####.##',
    '#####.#.',
    '#####...',
  ], { '#': T.STEEL });
}

/** Acid lab: a glass vat with a dissolving skull, and a race between seven samples in acid. */
function acidLab(g: Grid): void {
  const floor = 103;
  // gantry with a chain and ring dipping into the vat
  g.bricks(4, 22, 4, floor - 21, T.STONE, 4, 3);
  g.bricks(70, 22, 4, floor - 21, T.STONE, 4, 3);
  g.rect(4, 18, 70, 4, T.WOOD);
  g.rect(40, 22, 1, 38, T.STEEL);
  g.ellipse(40, 64, 3, 3, T.STEEL);
  g.ellipse(40, 64, 1, 1, T.AIR);
  // vat
  g.vessel(10, 48, 56, floor - 47, 2, T.ICE, T.ACID, 34);
  g.rect(34, floor - 15, 14, 10, T.ICE);
  g.stamp(35, floor - 25, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
    '..#####..',
  ], { '#': T.STONE });
  g.set(37, floor - 21, T.AIR);
  g.set(38, floor - 21, T.AIR);
  g.set(41, floor - 21, T.AIR);
  g.set(42, floor - 21, T.AIR);
  // ladder leaning into the vat
  g.line(14, floor - 14, 26, 36, T.WOOD, 1);
  g.line(17, floor - 14, 29, 36, T.WOOD, 1);
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    g.line(14 + 12 * t + 0, floor - 14 - (floor - 14 - 36) * t, 17 + 12 * t, floor - 14 - (floor - 14 - 36) * t, T.WOOD, 1);
  }
  // seven samples in acid, one per material
  const samples: [number, (x: number, y: number) => void][] = [
    [T.STONE, (x, y) => g.rect(x, y, 5, 4, T.STONE)],
    [T.STEEL, (x, y) => g.rect(x, y, 5, 4, T.STEEL)],
    [T.WOOD, (x, y) => g.rect(x, y, 5, 4, T.WOOD)],
    [T.CHARCOAL, (x, y) => g.rect(x, y, 5, 3, T.CHARCOAL)],
    [T.GRASS, (x, y) => g.rect(x, y, 5, 3, T.GRASS)],
    [T.MOLD, (x, y) => g.rect(x, y, 5, 4, T.MOLD)],
    [T.MUD, (x, y) => g.rect(x, y, 5, 4, T.MUD)],
  ];
  samples.forEach(([, draw], i) => {
    const x = 78 + i * 9;
    g.bricks(x - 2, floor - 3, 9, 4, T.STONE, 4, 2);
    g.vessel(x - 1, floor - 22, 8, 19, 1, T.ICE, T.ACID, 13);
    draw(x, floor - 20 + 12 - 0);
  });
  g.rect(75, floor - 3, 62, 1, T.STONE);
  // waste heap
  g.poly([[132, floor], [146, floor], [146, floor - 14], [140, floor - 8]], T.RUBBLE);
  g.scatter(126, floor - 3, 20, 3, T.ASH, 0.5, T.AIR);
}

/** Forge: a charcoal hearth lit by torches, a glowing bar on the anvil, a casting-sand box and a quench trough. */
function forge(g: Grid): void {
  const floor = 109;
  // hearth alcove in a brick body with a hood
  g.bricks(4, 52, 56, floor - 51, T.STONE, 8, 4);
  g.poly([[8, 52], [56, 52], [48, 36], [16, 36]], T.STONE);
  g.air(14, 74, 38, 26);
  g.air(14, 100, 38, 4);
  g.rect(14, 100, 38, 10, T.STONE);
  g.bricks(14, 101, 38, 9, T.STONE, 8, 3);
  g.rect(16, 94, 34, 7, T.CHARCOAL);
  g.scatter(16, 92, 34, 3, T.CHARCOAL, 0.5, T.AIR);
  for (let i = 0; i < 26; i++) {
    const x = 17 + Math.floor(g.rand() * 32);
    const y = 91 + Math.floor(g.rand() * 5);
    g.set(x, y, T.EMBER, { age: Math.floor(g.rand() * 120) });
  }
  g.rect(14, 86, 2, 2, T.TORCH);
  g.rect(50, 86, 2, 2, T.TORCH);
  for (let i = 0; i < 8; i++) g.setIfAir(16 + Math.floor(g.rand() * 3), 80 + Math.floor(g.rand() * 8), T.FLAME);
  for (let i = 0; i < 8; i++) g.setIfAir(46 + Math.floor(g.rand() * 4), 80 + Math.floor(g.rand() * 8), T.FLAME);
  g.scatter(16, 99, 34, 2, T.ASH, 0.4, T.CHARCOAL);
  for (let i = 0; i < 16; i++) g.setIfAir(18 + Math.floor(g.rand() * 28), 76 + Math.floor(g.rand() * 8), T.SMOKE);
  // bellows
  g.stamp(62, 90, [
    '#########.....',
    '.#######.#####',
    '..#####..#....',
    '..#####..#....',
    '.#######.#....',
    '#########.....',
  ], { '#': T.STEEL });
  g.rect(62, 100, 14, 4, T.STONE);
  // anvil on a stone block with a glowing bar, sparks above it
  g.bricks(88, 98, 14, 12, T.STONE, 6, 3);
  g.stamp(82, 90, [
    '##################',
    '.##############...',
    '....##########....',
    '......######......',
    '......######......',
    '.....########.....',
  ], { '#': T.STEEL });
  g.rect(84, 88, 14, 2, T.HOT_STEEL, { age: 30 });
  g.rect(98, 88, 6, 2, T.COOLING_STEEL, { age: 100 });
  for (let i = 0; i < 9; i++) g.set(86 + Math.floor(g.rand() * 14), 84 + Math.floor(g.rand() * 3), T.SPARK);
  // swords on a rack
  g.rect(76, 42, 24, 2, T.STEEL);
  for (const x of [80, 86, 92, 98]) {
    g.rect(x, 44, 1, 22, T.STEEL);
    g.rect(x - 2, 54, 5, 1, T.STEEL);
  }
  // casting-sand box: a bar heated in wet sand dries it back to sand
  g.vessel(108, 96, 18, floor - 95, 2, T.STONE, T.WET_SAND, 9);
  g.rect(112, 100, 10, 2, T.HOT_STEEL, { age: 20 });
  // quench trough with a bar dipping in
  g.vessel(128, 94, 18, floor - 93, 2, T.STONE, T.WATER, 12);
  g.line(124, 78, 138, 100, T.HOT_STEEL, 2, { age: 10 });
}

/** Cold store: a snowman by the heater, an ice rink under a dripping spring, stacked ice. */
function coldStore(g: Grid): void {
  const floor = 109;
  // spring and pipe from the ceiling
  g.pipe([[30, 0], [30, 22]], 3, 1, T.STEEL);
  g.rect(28, 22, 5, 2, T.STEEL);
  g.rect(29, 22, 3, 4, T.AIR);
  g.set(30, 20, T.SPRING);
  g.set(29, 20, T.SPRING);
  g.set(31, 20, T.SPRING);
  // icicles under the pipe stub
  for (const [dx, len] of [[-3, 4], [4, 5], [6, 3]]) g.rect(30 + dx, 24, 1, len, T.ICE);
  // rink basin: an ice floor the spring's water freezes onto, and an ice block pyramid growing in it
  g.rect(4, floor - 12, 2, 13, T.STONE);
  g.rect(56, floor - 12, 2, 13, T.STONE);
  g.rect(6, floor - 4, 50, 5, T.ICE);
  for (let r = 0; r < 4; r++) g.rect(12 + r * 3, floor - 13 - r * 8, 22 - r * 6, 8, T.ICE);
  // snowman
  const sx = 96;
  g.disc(sx, floor - 11, 11, T.ICE);
  g.disc(sx, floor - 31, 8, T.ICE);
  g.disc(sx, floor - 45, 6, T.ICE);
  for (const [dx, dy] of [[-2, -47], [2, -47], [0, -32], [0, -27], [0, -22]]) g.set(sx + dx, floor + dy, T.CHARCOAL);
  for (const [dx, dy] of [[-3, -44], [-2, -42], [-1, -41], [0, -41], [1, -41], [2, -42], [3, -44]]) g.set(sx + dx, floor + dy, T.CHARCOAL);
  g.rect(sx, floor - 45, 5, 1, T.WOOD);
  g.line(sx - 8, floor - 33, sx - 18, floor - 40, T.STONE, 1);
  g.line(sx + 8, floor - 33, sx + 18, floor - 40, T.STONE, 1);
  g.rect(sx - 5, floor - 54, 11, 2, T.STEEL);
  g.rect(sx - 3, floor - 58, 7, 4, T.STEEL);
  g.rect(sx - 6, floor - 38, 13, 2, T.MOLD);
  // heater: a torch on a steel bracket across the room
  g.rect(124, floor - 24, 12, 2, T.STEEL);
  g.rect(130, floor - 22, 2, 23, T.STEEL);
  g.rect(127, floor - 25, 2, 1, T.TORCH);
  g.rect(131, floor - 25, 2, 1, T.TORCH);
  // a shelf of leather-bound (stone, steel, glass) books
  g.bricks(70, 36, 52, 3, T.STONE, 8, 3);
  g.bricks(72, 39, 3, 6, T.STONE, 3, 3);
  g.bricks(117, 39, 3, 6, T.STONE, 3, 3);
  const spines = [T.STONE, T.STEEL, T.ICE, T.STEEL, T.STONE, T.ICE, T.STONE, T.STEEL, T.ICE, T.STONE, T.STEEL, T.STONE, T.ICE, T.STEEL, T.STONE, T.ICE];
  spines.forEach((type, i) => g.rect(72 + i * 3, 36 - 8 - (i * 7) % 5, 3, 8 + (i * 7) % 5, type));
  // frosted bottles on a stone ledge
  g.bricks(62, floor - 21, 20, 3, T.STONE, 6, 3);
  g.bricks(64, floor - 18, 3, 14, T.STONE, 3, 3);
  g.bricks(77, floor - 18, 3, 14, T.STONE, 3, 3);
  for (let i = 0; i < 3; i++) beaker(g, 64 + i * 6, floor - 34, 5, 13, i % 2 === 0 ? T.WATER : T.ICE, 6);
}

/** Vault of bombs in a steel box, a methane gas cellar of rotting crates, a dripping pipe over sandbags. */
function vault(g: Grid): void {
  const floor = 109;
  // steel vault with a wooden hatch in the lid
  g.rect(4, 56, 70, 3, T.STEEL);
  g.rect(4, 56, 3, floor - 55, T.STEEL);
  g.rect(71, 56, 3, floor - 55, T.STEEL);
  g.rect(4, floor - 2, 70, 3, T.STEEL);
  g.rect(36, 56, 6, 3, T.WOOD);
  // bomb stash with air all around
  for (let r = 0; r < 4; r++) g.rect(18, floor - 12 - r * 5, 42, 4, T.BOMB);
  g.rect(10, floor - 15, 7, 12, T.WOOD);
  // skull warning sign on the lid
  g.stamp(34, 42, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
    '..#####..',
  ], { '#': T.ICE });
  g.rect(37, 48, 2, 1, T.AIR);
  // leaking pipe over the sandbags: the sand wets and clumps
  g.pipe([[86, 0], [86, 20]], 1, 1, T.STEEL);
  g.rect(85, 20, 3, 1, T.AIR);
  g.rect(85, 20, 3, 4, T.AIR);
  g.set(86, 2, T.SPRING);
  g.poly([[76, floor], [98, floor], [98, floor - 4], [92, floor - 12], [82, floor - 12], [76, floor - 4]], T.SAND);
  // gas cellar: rotting crates under a steel bell, methane trapped inside
  for (let y = floor - 48; y <= floor - 12; y++) {
    for (let x = 96; x <= 146; x++) {
      const d = Math.hypot((x - 121) / 24.5, (y - (floor - 12)) / 36.5);
      if (d <= 1 && d > 0.93) g.set(x, y, T.STEEL);
    }
  }
  g.rect(106, floor - 13, 14, 13, T.WOOD);
  g.rect(122, floor - 13, 14, 13, T.WOOD);
  g.rect(114, floor - 26, 14, 13, T.WOOD);
  g.scatter(106, floor - 27, 30, 28, T.MOLD, 0.18, T.WOOD);
  g.rect(106, floor - 14, 30, 1, T.MOLD);
  g.rect(114, floor - 27, 14, 1, T.MOLD);
  for (let i = 0; i < 18; i++) g.setIfAir(108 + Math.floor(g.rand() * 26), floor - 44 + Math.floor(g.rand() * 8), T.METHANE);
}

/** Pond, marsh and dock fed by the greenhouse downspout. */
function leftGrounds(g: Grid): void {
  g.terrain(0, 90, 348, () => GROUND, T.DIRT);
  g.rect(0, GROUND, 90, 1, T.GRASS);
  // pond bowl
  for (let x = 24; x <= 82; x++) {
    const depth = Math.min(16, Math.min(x - 24, 82 - x) + 1);
    for (let d = 0; d < depth; d++) g.set(x, GROUND + d, T.AIR);
  }
  g.replace(24, GROUND, 59, 18, T.DIRT, T.MUD, 0.35);
  for (let x = 24; x <= 82; x++) {
    const depth = Math.min(16, Math.min(x - 24, 82 - x) + 1);
    for (let d = 0; d < depth; d++) if (GROUND + d >= GROUND + 6) g.set(x, GROUND + d, T.WATER);
  }
  g.rect(72, GROUND + 2, 14, 4, T.SAND);
  g.poly([[76, GROUND + 1], [90, GROUND + 1], [90, GROUND - 3], [84, GROUND - 3]], T.SAND);
  // dock
  g.rect(14, GROUND - 2, 26, 2, T.WOOD);
  for (const x of [20, 28, 36]) g.rect(x, GROUND, 2, 9, T.WOOD);
  // reeds and bushes
  for (const x of [26, 30, 33, 44, 49, 66, 70, 78]) g.rect(x, GROUND - 5 - Math.floor(g.rand() * 5), 1, 6 + Math.floor(g.rand() * 3), T.GRASS);
  for (const [bx, r] of [[8, 5], [54, 4], [3, 3]] as [number, number][]) g.poly([[bx - r, GROUND], [bx + r, GROUND], [bx + r - 2, GROUND - r], [bx - r + 2, GROUND - r]], T.GRASS);
  // rain barrel at the foot of the downspout
  g.vessel(60, GROUND - 14, 14, 14, 2, T.WOOD, T.WATER, 9);
  // sign post
  g.rect(4, GROUND - 14, 2, 14, T.WOOD);
  g.rect(1, GROUND - 17, 8, 4, T.WOOD);
}

/** A blast crater with a dud bomb, rubble, scorch marks and an acid puddle. */
function rightGrounds(g: Grid): void {
  g.terrain(550, 640, 348, () => GROUND, T.DIRT);
  g.rect(550, GROUND, 90, 1, T.GRASS);
  for (let x = 586; x <= 628; x++) {
    const depth = Math.min(12, Math.round(Math.min(x - 586, 628 - x) * 0.8) + 1);
    for (let d = 0; d < depth; d++) g.set(x, GROUND + d, T.AIR);
  }
  g.replace(586, GROUND, 43, 14, T.DIRT, T.CHARCOAL, 0.3);
  g.replace(584, GROUND - 1, 47, 15, T.GRASS, T.ASH, 0.5);
  g.rect(598, GROUND + 10, 18, 2, T.ACID);
  g.rect(600, GROUND + 8, 14, 2, T.ACID);
  g.rect(604, GROUND + 6, 6, 2, T.ACID);
  // rubble ring and chunks
  g.poly([[582, GROUND], [594, GROUND], [590, GROUND - 7], [586, GROUND - 7]], T.RUBBLE);
  g.poly([[622, GROUND], [636, GROUND], [632, GROUND - 9], [626, GROUND - 6]], T.RUBBLE);
  g.scatter(590, GROUND - 3, 40, 3, T.RUBBLE, 0.12, T.AIR);
  // the dud
  g.rect(609, GROUND + 3, 4, 3, T.BOMB);
  // broken fence
  for (const [x, h] of [[556, 9], [562, 9], [568, 5], [574, 8]] as [number, number][]) g.rect(x, GROUND - h, 2, h, T.WOOD);
  g.rect(556, GROUND - 7, 8, 1, T.WOOD);
  // warning cairn and drum
  g.bricks(640 - 12, GROUND - 10, 8, 10, T.STONE, 4, 2);
  g.vessel(563, GROUND - 14, 10, 14, 1, T.STEEL);
  g.rect(540, GROUND - 4, 1, 1, T.AIR);
}

export function buildAlchemistLab(): Grid {
  const g = new Grid(2024);
  leftGrounds(g);
  rightGrounds(g);

  // building shell
  g.brickPoly([[BUILDING_X - 6, 103], [250, 70], [390, 70], [BUILDING_X + BUILDING_W + 6, 103]], T.STONE, 8, 4);
  g.bricks(BUILDING_X, 102, BUILDING_W, 6, T.STONE, 10, 3);
  g.bricks(BUILDING_X, 212, BUILDING_W, 5, T.STONE, 10, 3);
  g.bricks(BUILDING_X, GROUND, BUILDING_W, 21, T.STONE, 10, 3);
  g.bricks(BUILDING_X, 102, WALL, GROUND - 101, T.STONE, 6, 3);
  g.bricks(BUILDING_X + BUILDING_W - WALL, 102, WALL, GROUND - 101, T.STONE, 6, 3);
  for (const rx of [ROOM_X[0] + ROOM_W, ROOM_X[1] + ROOM_W]) g.bricks(rx, 102, DIVIDER, GROUND - 101, T.STONE, 5, 3);
  // clear the interiors, then draw the rooms
  for (const x of ROOM_X) {
    g.air(x, TOP_Y, ROOM_W, TOP_H);
    g.air(x, BOTTOM_Y, ROOM_W, BOTTOM_H);
  }
  const top = [greenhouse, (gr: Grid) => distillery(gr, TOP_H), acidLab];
  const bottom = [forge, coldStore, vault];
  top.forEach((draw, i) => g.at(ROOM_X[i], TOP_Y, () => draw(g)));
  bottom.forEach((draw, i) => g.at(ROOM_X[i], BOTTOM_Y, () => draw(g)));

  // downspout from the greenhouse drain into the pond
  g.pipe([[89, 210], [87, 210], [87, 300], [70, 316]], 3, 1, T.STEEL);
  g.rect(66, 316, 8, 6, T.AIR);
  g.rect(84, 210, 6, 1, T.STEEL);
  g.rect(88, 209, 2, 3, T.AIR);
  g.rect(86, 209, 3, 3, T.AIR);

  // roof furniture: chimneys, a weather vane, the cat, and the moon with its stars
  for (const x of [150, 470]) {
    g.bricks(x, 50, 16, 40, T.STONE, 8, 3);
    g.air(x + 4, 50, 8, 28);
    g.rect(x - 2, 48, 20, 3, T.STONE);
    for (let i = 0; i < 26; i++) g.setIfAir(x + 2 + Math.floor(g.rand() * 12), 14 + Math.floor(g.rand() * 34), T.SMOKE);
  }
  g.rect(320, 52, 1, 18, T.STEEL);
  g.stamp(312, 56, ['...#....', '..###...', '.#####..'], { '#': T.STEEL });
  g.stamp(300, 62, [
    '#.....#.....',
    '##...###....',
    '#########...',
    '.########..#',
    '.#######..#.',
    '..#...#..#..',
  ], { '#': T.CHARCOAL });
  g.disc(580, 60, 10, T.ICE);
  g.disc(585, 57, 9, T.AIR);
  for (let i = 0; i < 40; i++) g.set(Math.floor(g.rand() * 640), 4 + Math.floor(g.rand() * 90), T.ICE);
  g.air(571, 49, 22, 22);
  g.disc(580, 60, 10, T.ICE);
  g.disc(586, 56, 9, T.AIR);
  return g;
}
