import { Grid, T } from '../world-kit.ts';
import { POCKETS, SURFACE, carvePockets, fillGround } from './underground.ts';

const ROOM_W = 146;
const DIVIDER = 5;
const WALL = 6;
const BUILDING_X = 90;
const BUILDING_W = 460;
const ROOM_X = [96, 247, 398];
/** The three above-ground rooms: interior rows ROOM_Y..SURFACE - 1. */
const ROOM_H = 84;
const ROOM_Y = SURFACE - ROOM_H;
const EAVE_Y = ROOM_Y - 6;

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


/** Terraced planters watered by a spring; the runoff drops down a shaft into the cistern below. */
function greenhouse(g: Grid): void {
  const floor = 83;
  g.rect(138, 2, 8, 14, T.STEEL);
  g.pipe([[136, 8], [104, 8], [104, 30]], 3, 1, T.STEEL);
  g.rect(103, 30, 3, 4, T.AIR);
  for (const y of [7, 8, 9]) g.set(137, y, T.SPRING);
  const planters = [
    { x: 94, w: 52, top: 42 },
    { x: 54, w: 40, top: 56 },
    { x: 22, w: 32, top: 70 },
  ];
  planters.forEach((p) => {
    const height = floor - p.top + 1;
    g.bricks(p.x, p.top - 1, 2, height + 1, T.STONE, 4, 3);
    g.rect(p.x + 2, p.top, p.w - 2, height, T.DIRT);
    g.rect(p.x + 2, floor - 3, p.w - 2, 4, T.RUBBLE);
    g.rect(p.x + 2, floor - 9, p.w - 2, 6, T.SAND);
    g.scatter(p.x + 2, p.top, p.w - 2, 4, T.MUD, 0.3, T.DIRT);
    g.scatter(p.x + 2, p.top + 4, p.w - 2, 4, T.MUD, 0.06, T.DIRT);
  });
  for (const x of [102, 114, 126, 138]) {
    g.rect(x, 30, 1, 12, T.WOOD);
    g.rect(x - 2, 31, 5, 1, T.WOOD);
    g.rect(x - 2, 40, 5, 2, T.GRASS);
    g.rect(x - 1, 38, 3, 2, T.GRASS);
  }
  for (const x of [60, 68, 76, 84]) g.poly([[x - 3, 55], [x + 3, 55], [x + 2, 52], [x - 2, 52]], T.GRASS);
  for (const x of [26, 29, 31, 35]) g.rect(x, 62, 1, 8, T.GRASS);
  g.rect(42, 63, 6, 7, T.WOOD);
  g.rect(42, 62, 6, 1, T.MOLD);
  g.rect(43, 65, 1, 2, T.MOLD);
  g.set(47, 66, T.MOLD);
  for (let x = 16; x < 134; x += 24) g.rect(x, -6, 22, 6, T.ICE);
  for (let i = 0; i < 24; i++) g.setIfAir(40 + Math.floor(g.rand() * 50), Math.floor(g.rand() * 4), T.METHANE);
  // seed shelf with clay pots, a hanging tub of ferns
  g.rect(8, 36, 36, 2, T.WOOD);
  g.rect(10, 38, 2, 10, T.WOOD);
  g.rect(40, 38, 2, 10, T.WOOD);
  for (let i = 0; i < 4; i++) {
    g.vessel(12 + i * 8, 29, 6, 7, 1, T.STONE, T.DIRT, 5);
    g.rect(14 + i * 8, 26, 2, 3, T.GRASS);
  }
  g.rect(30, 0, 1, 6, T.STEEL);
  g.rect(60, 0, 1, 6, T.STEEL);
  g.vessel(26, 6, 40, 8, 1, T.STEEL, T.DIRT, 5);
  for (let x = 30; x < 64; x += 5) g.rect(x, 3, 2, 3, T.GRASS);
  g.stamp(116, 34, [
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
  const floor = 83;
  g.bricks(4, 12, 4, floor - 11, T.STONE, 4, 3);
  g.bricks(70, 12, 4, floor - 11, T.STONE, 4, 3);
  g.rect(4, 8, 70, 4, T.WOOD);
  g.rect(40, 12, 1, 38, T.STEEL);
  g.ellipse(40, 52, 3, 3, T.STEEL);
  g.ellipse(40, 52, 1, 1, T.AIR);
  g.vessel(10, 30, 56, floor - 29, 2, T.ICE, T.ACID, 34);
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
  for (const x of [37, 38, 41, 42]) g.set(x, floor - 21, T.AIR);
  g.line(14, floor - 14, 26, 32, T.WOOD, 1);
  g.line(17, floor - 14, 29, 32, T.WOOD, 1);
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const y = floor - 14 - (floor - 14 - 32) * t;
    g.line(14 + 12 * t, y, 17 + 12 * t, y, T.WOOD, 1);
  }
  const samples = [
    (x: number, y: number) => g.rect(x, y, 5, 4, T.STONE),
    (x: number, y: number) => g.rect(x, y, 5, 4, T.STEEL),
    (x: number, y: number) => g.rect(x, y, 5, 4, T.WOOD),
    (x: number, y: number) => g.rect(x, y, 5, 3, T.CHARCOAL),
    (x: number, y: number) => g.rect(x, y, 5, 3, T.GRASS),
    (x: number, y: number) => g.rect(x, y, 5, 4, T.MOLD),
    (x: number, y: number) => g.rect(x, y, 5, 4, T.MUD),
  ];
  samples.forEach((draw, i) => {
    const x = 78 + i * 9;
    g.bricks(x - 2, floor - 3, 9, 4, T.STONE, 4, 2);
    g.vessel(x - 1, floor - 22, 8, 19, 1, T.ICE, T.ACID, 13);
    draw(x, floor - 8);
  });
  g.rect(75, floor - 3, 62, 1, T.STONE);
  g.poly([[132, floor], [146, floor], [146, floor - 14], [140, floor - 8]], T.RUBBLE);
  g.scatter(126, floor - 3, 20, 3, T.ASH, 0.5, T.AIR);
}

/** Forge (pocket 1): a charcoal hearth under a chimney to the surface, a glowing bar on the anvil and a quench trough. */
function forge(g: Grid): void {
  g.at(0, 23, () => {
    const floor = 109;
    g.bricks(4, 52, 56, floor - 51, T.STONE, 8, 4);
    g.poly([[8, 52], [56, 52], [48, 36], [16, 36]], T.STONE);
    g.air(14, 74, 38, 26);
    g.air(14, 100, 38, 4);
    g.rect(14, 100, 38, 10, T.STONE);
    g.bricks(14, 101, 38, 9, T.STONE, 8, 3);
    g.rect(16, 94, 34, 7, T.CHARCOAL);
    g.scatter(16, 92, 34, 3, T.CHARCOAL, 0.5, T.AIR);
    for (let i = 0; i < 26; i++) g.set(17 + Math.floor(g.rand() * 32), 91 + Math.floor(g.rand() * 5), T.EMBER, { age: Math.floor(g.rand() * 120) });
    g.rect(14, 86, 2, 2, T.TORCH);
    g.rect(50, 86, 2, 2, T.TORCH);
    for (let i = 0; i < 8; i++) g.setIfAir(16 + Math.floor(g.rand() * 3), 80 + Math.floor(g.rand() * 8), T.FLAME);
    for (let i = 0; i < 8; i++) g.setIfAir(46 + Math.floor(g.rand() * 4), 80 + Math.floor(g.rand() * 8), T.FLAME);
    g.scatter(16, 99, 34, 2, T.ASH, 0.4, T.CHARCOAL);
    for (let i = 0; i < 16; i++) g.setIfAir(18 + Math.floor(g.rand() * 28), 76 + Math.floor(g.rand() * 8), T.SMOKE);
    // flue up through the rock to a chimney on the surface
    g.rect(28, -23, 8, 59, T.AIR);
    g.stamp(62, 90, [
      '#########.....',
      '.#######.#####',
      '..#####..#....',
      '..#####..#....',
      '.#######.#....',
      '#########.....',
    ], { '#': T.STEEL });
    g.rect(62, 100, 14, 4, T.STONE);
    g.bricks(84, 98, 10, 12, T.STONE, 6, 3);
    g.stamp(78, 90, [
      '##################',
      '.##############...',
      '....##########....',
      '......######......',
      '......######......',
      '.....########.....',
    ], { '#': T.STEEL });
    g.rect(80, 88, 14, 2, T.HOT_STEEL, { age: 30 });
    g.rect(94, 88, 6, 2, T.COOLING_STEEL, { age: 100 });
    for (let i = 0; i < 9; i++) g.set(82 + Math.floor(g.rand() * 14), 84 + Math.floor(g.rand() * 3), T.SPARK);
    g.rect(74, 42, 24, 2, T.STEEL);
    for (const x of [78, 84, 90, 96]) {
      g.rect(x, 44, 1, 22, T.STEEL);
      g.rect(x - 2, 54, 5, 1, T.STEEL);
    }
    g.vessel(104, 94, 20, floor - 93, 2, T.STONE, T.WATER, 12);
    g.line(98, 78, 112, 100, T.HOT_STEEL, 2, { age: 10 });
    // ceiling pipes and chains
    for (const x of [70, 100]) for (let y = -22; y < 20; y += 3) g.rect(x, y, 1, 2, T.STEEL);
  });
}

/** Cold store (pocket 2): a snowman by the heater, an ice basin under a dripping spring, a shelf of books. */
function coldStore(g: Grid): void {
  g.at(0, 28, () => {
    const floor = 109;
    g.pipe([[24, -28], [24, 22]], 3, 1, T.STEEL);
    g.rect(22, 22, 5, 2, T.STEEL);
    g.rect(23, 22, 3, 4, T.AIR);
    for (const x of [23, 24, 25]) g.set(x, 20, T.SPRING);
    for (const [dx, len] of [[-3, 4], [4, 5], [6, 3]]) g.rect(24 + dx, 24, 1, len, T.ICE);
    g.rect(4, floor - 12, 2, 13, T.STONE);
    g.rect(46, floor - 12, 2, 13, T.STONE);
    g.rect(6, floor - 4, 40, 5, T.ICE);
    for (let r = 0; r < 4; r++) g.rect(10 + r * 3, floor - 13 - r * 8, 22 - r * 6, 8, T.ICE);
    const sx = 80;
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
    g.rect(94, floor - 24, 10, 2, T.STEEL);
    g.rect(98, floor - 22, 2, 23, T.STEEL);
    g.rect(95, floor - 25, 2, 1, T.TORCH);
    g.rect(99, floor - 25, 2, 1, T.TORCH);
    g.bricks(52, 36, 48, 3, T.STONE, 8, 3);
    g.bricks(54, 39, 3, 6, T.STONE, 3, 3);
    g.bricks(95, 39, 3, 6, T.STONE, 3, 3);
    const spines = [T.STONE, T.STEEL, T.ICE, T.STEEL, T.STONE, T.ICE, T.STONE, T.STEEL, T.ICE, T.STONE, T.STEEL, T.STONE, T.ICE, T.STEEL];
    spines.forEach((type, i) => g.rect(54 + i * 3, 36 - 8 - ((i * 7) % 5), 3, 8 + ((i * 7) % 5), type));
    g.bricks(50, floor - 21, 18, 3, T.STONE, 6, 3);
    g.bricks(52, floor - 18, 3, 14, T.STONE, 3, 3);
    g.bricks(63, floor - 18, 3, 14, T.STONE, 3, 3);
    for (let i = 0; i < 3; i++) beaker(g, 52 + i * 5, floor - 34, 4, 13, i % 2 === 0 ? T.WATER : T.ICE, 6);
    for (let x = 40; x < 104; x += 5) g.rect(x, -28, 1, 2 + Math.floor(g.rand() * 8), T.ICE);
  });
}

/** Vault (pocket 3): bombs in a steel box, sandbags wetted by a leaking pipe. */
function vault(g: Grid): void {
  g.at(0, 18, () => {
    const floor = 109;
    g.rect(4, 56, 55, 3, T.STEEL);
    g.rect(4, 56, 3, floor - 55, T.STEEL);
    g.rect(56, 56, 3, floor - 55, T.STEEL);
    g.rect(4, floor - 2, 55, 3, T.STEEL);
    g.rect(28, 56, 6, 3, T.WOOD);
    for (let r = 0; r < 3; r++) g.rect(14, floor - 12 - r * 5, 30, 4, T.BOMB);
    g.rect(8, floor - 15, 5, 12, T.WOOD);
    g.stamp(26, 40, [
      '..#####..',
      '.#######.',
      '#########',
      '#.##.##.#',
      '#.##.##.#',
      '.#######.',
      '..#.#.#..',
      '..#####..',
    ], { '#': T.ICE });
    g.rect(29, 46, 2, 1, T.AIR);
    g.pipe([[67, -18], [67, 20]], 1, 1, T.STEEL);
    g.rect(66, 20, 3, 4, T.AIR);
    g.set(67, -16, T.SPRING);
    g.poly([[60, floor], [74, floor], [74, floor - 4], [71, floor - 10], [63, floor - 10], [60, floor - 4]], T.SAND);
  });
}

/** Cistern (pocket 4): the greenhouse drain falls in; ice grows on a raft, a chest and an anchor lie on the bed. */
function cistern(g: Grid): void {
  const floor = 92;
  g.rect(0, 30, 102, floor - 29, T.WATER);
  for (const x of [14, 62, 88]) g.bricks(x, 0, 6, floor + 1, T.STONE, 6, 3);
  for (const x of [14, 62, 88]) g.rect(x, 30, 6, floor - 29, T.STONE);
  for (const cx of [17, 40, 75]) g.ring(cx, 0, 13, 3, T.STONE);
  g.rect(24, 34, 12, 4, T.ICE);
  g.rect(70, 36, 8, 3, T.ICE);
  for (const x of [8, 26, 50, 56, 82, 96]) g.rect(x, 3, 1, 3 + Math.floor(g.rand() * 8), T.ICE);
  g.rect(48, floor - 6, 12, 6, T.WOOD);
  g.rect(48, floor - 4, 12, 1, T.STEEL);
  g.rect(53, floor - 8, 2, 2, T.STEEL);
  g.line(30, floor - 14, 30, floor, T.STEEL, 1);
  g.line(25, floor - 12, 35, floor - 12, T.STEEL, 1);
  g.line(25, floor - 2, 30, floor, T.STEEL, 1);
  g.line(35, floor - 2, 30, floor, T.STEEL, 1);
  g.scatter(66, floor - 2, 18, 3, T.ASH, 0.6, T.WATER);
  g.scatter(14, 20, 6, 10, T.MOLD, 0.3, T.STONE);
  g.scatter(62, 20, 6, 10, T.MOLD, 0.3, T.STONE);
}

/** Waste pit (pocket 5): a stone tank of spent acid eating its wall, leaking drums over a mud bed. */
function wastePit(g: Grid): void {
  const floor = 112;
  g.vessel(4, 66, 40, floor - 65, 5, T.STONE, T.ACID, 28);
  g.stamp(20, floor - 18, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
  ], { '#': T.STONE });
  g.rect(14, 30, 1, 36, T.STEEL);
  g.rect(8, 28, 14, 2, T.STEEL);
  g.line(34, 66, 38, 100, T.WOOD, 1);
  g.line(37, 66, 41, 100, T.WOOD, 1);
  g.rect(48, floor - 5, 20, 6, T.MUD);
  g.rect(48, floor - 7, 20, 2, T.DIRT);
  g.vessel(50, floor - 24, 9, 12, 1, T.STEEL, T.ACID, 8);
  g.vessel(60, floor - 36, 9, 12, 1, T.STEEL, T.ACID, 8);
  g.set(50, floor - 14, T.AIR);
  g.set(60, floor - 26, T.AIR);
  g.rect(48, floor - 12, 12, 2, T.STONE);
  g.rect(58, floor - 24, 12, 2, T.STONE);
  g.stamp(52, 20, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
  ], { '#': T.ICE });
  g.poly([[0, floor], [8, floor], [4, floor - 8], [0, floor - 8]], T.RUBBLE);
  g.scatter(44, floor - 3, 24, 3, T.ASH, 0.4, T.AIR);
}

/** Gas cellar (pocket 6): rotting crates under a steel bell, a vent shaft to a stack on the surface. */
function gasCellar(g: Grid): void {
  const floor = 97;
  for (let y = floor - 50; y <= floor - 10; y++) {
    for (let x = 14; x <= 62; x++) {
      const d = Math.hypot((x - 38) / 24.5, (y - (floor - 10)) / 40.5);
      if (d <= 1 && d > 0.94) g.set(x, y, T.STEEL);
    }
  }
  g.rect(22, floor - 13, 14, 13, T.WOOD);
  g.rect(38, floor - 13, 14, 13, T.WOOD);
  g.rect(30, floor - 26, 14, 13, T.WOOD);
  g.scatter(22, floor - 27, 30, 28, T.MOLD, 0.18, T.WOOD);
  g.rect(22, floor - 14, 30, 1, T.MOLD);
  g.rect(30, floor - 27, 14, 1, T.MOLD);
  for (let i = 0; i < 24; i++) g.setIfAir(24 + Math.floor(g.rand() * 26), floor - 46 + Math.floor(g.rand() * 8), T.METHANE);
  g.rect(8, 0, 4, 12, T.AIR);
  g.poly([[0, floor], [10, floor], [8, floor - 6], [0, floor - 10]], T.RUBBLE);
}

/** Pond, dock and rain barrel beside the forge's chimney. */
function leftGrounds(g: Grid): void {
  for (let x = 60; x <= 86; x++) {
    const depth = Math.min(10, Math.min(x - 60, 86 - x) + 1);
    for (let d = 0; d < depth; d++) g.set(x, SURFACE + d, d < 4 ? T.AIR : T.WATER);
  }
  g.replace(60, SURFACE, 27, 12, T.DIRT, T.MUD, 0.35);
  g.rect(80, SURFACE + 3, 8, 3, T.SAND);
  g.poly([[82, SURFACE], [90, SURFACE], [90, SURFACE - 3], [86, SURFACE - 3]], T.SAND);
  g.rect(56, SURFACE - 2, 18, 2, T.WOOD);
  for (const x of [58, 66]) g.rect(x, SURFACE, 2, 7, T.WOOD);
  for (const x of [62, 68, 72, 84]) g.rect(x, SURFACE - 5 - Math.floor(g.rand() * 4), 1, 6 + Math.floor(g.rand() * 3), T.GRASS);
  for (const [bx, r] of [[8, 5], [26, 4]] as [number, number][]) g.poly([[bx - r, SURFACE], [bx + r, SURFACE], [bx + r - 2, SURFACE - r], [bx - r + 2, SURFACE - r]], T.GRASS);
  g.vessel(14, SURFACE - 14, 12, 14, 2, T.WOOD, T.WATER, 9);
  g.rect(2, SURFACE - 14, 2, 14, T.WOOD);
  g.rect(0, SURFACE - 17, 8, 4, T.WOOD);
  // the forge's chimney
  g.bricks(38, 118, 18, 41, T.STONE, 6, 3);
  g.rect(36, 116, 22, 3, T.STONE);
}

/** A blast crater with a dud bomb, rubble, scorch marks and an acid puddle; the gas cellar's vent stack. */
function rightGrounds(g: Grid): void {
  for (let x = 596; x <= 634; x++) {
    const depth = Math.min(10, Math.round(Math.min(x - 596, 634 - x) * 0.8) + 1);
    for (let d = 0; d < depth; d++) g.set(x, SURFACE + d, T.AIR);
  }
  g.replace(596, SURFACE, 39, 12, T.DIRT, T.CHARCOAL, 0.3);
  g.replace(594, SURFACE - 1, 43, 13, T.GRASS, T.ASH, 0.5);
  g.rect(608, SURFACE + 8, 16, 2, T.ACID);
  g.rect(610, SURFACE + 6, 12, 2, T.ACID);
  g.rect(614, SURFACE + 4, 5, 2, T.ACID);
  g.poly([[592, SURFACE], [604, SURFACE], [600, SURFACE - 7], [596, SURFACE - 7]], T.RUBBLE);
  g.poly([[626, SURFACE], [638, SURFACE], [634, SURFACE - 9], [630, SURFACE - 6]], T.RUBBLE);
  g.scatter(596, SURFACE - 3, 40, 3, T.RUBBLE, 0.12, T.AIR);
  g.rect(618, SURFACE + 3, 4, 3, T.BOMB);
  for (const [x, h] of [[556, 9], [562, 9], [568, 5], [574, 8]] as [number, number][]) g.rect(x, SURFACE - h, 2, h, T.WOOD);
  g.rect(556, SURFACE - 7, 8, 1, T.WOOD);
  g.bricks(640 - 10, SURFACE - 10, 8, 10, T.STONE, 4, 2);
  // vent stack over the gas cellar
  g.rect(576, SURFACE - 14, 10, 15, T.STEEL);
  g.rect(578, SURFACE - 14, 4, 15, T.AIR);
  g.rect(574, SURFACE - 16, 14, 2, T.STEEL);
}

export const ROOMS: Record<string, { w: number; h: number; draw: (g: Grid) => void }> = {
  distillery: { w: ROOM_W, h: ROOM_H, draw: (g) => distillery(g, ROOM_H) },
  greenhouse: { w: ROOM_W, h: ROOM_H, draw: greenhouse },
  acidLab: { w: ROOM_W, h: ROOM_H, draw: acidLab },
  forge: { w: POCKETS[0].w, h: POCKETS[0].h, draw: forge },
  coldStore: { w: POCKETS[1].w, h: POCKETS[1].h, draw: coldStore },
  vault: { w: POCKETS[2].w, h: POCKETS[2].h, draw: vault },
  cistern: { w: POCKETS[3].w, h: POCKETS[3].h, draw: cistern },
  wastePit: { w: POCKETS[4].w, h: POCKETS[4].h, draw: wastePit },
  gasCellar: { w: POCKETS[5].w, h: POCKETS[5].h, draw: gasCellar },
};

export function buildAlchemistLab(): Grid {
  const g = new Grid(2024);
  fillGround(g, () => SURFACE);
  leftGrounds(g);
  rightGrounds(g);

  // building: slab under the floor, walls, dividers, eave and roof
  g.brickPoly([[BUILDING_X - 6, EAVE_Y], [250, EAVE_Y - 30], [390, EAVE_Y - 30], [BUILDING_X + BUILDING_W + 6, EAVE_Y]], T.STONE, 8, 4);
  g.bricks(BUILDING_X, EAVE_Y, BUILDING_W, 6, T.STONE, 10, 3);
  g.bricks(BUILDING_X, SURFACE, BUILDING_W, 5, T.STONE, 10, 3);
  g.bricks(BUILDING_X, EAVE_Y, WALL, SURFACE - EAVE_Y, T.STONE, 6, 3);
  g.bricks(BUILDING_X + BUILDING_W - WALL, EAVE_Y, WALL, SURFACE - EAVE_Y, T.STONE, 6, 3);
  for (const rx of [ROOM_X[0] + ROOM_W, ROOM_X[1] + ROOM_W]) g.bricks(rx, EAVE_Y, DIVIDER, SURFACE - EAVE_Y, T.STONE, 5, 3);
  for (const x of ROOM_X) g.air(x, ROOM_Y, ROOM_W, ROOM_H);
  // rooms, left to right: distillery, acid lab, greenhouse (above the cistern)
  const rooms = [(gr: Grid) => distillery(gr, ROOM_H), acidLab, greenhouse];
  rooms.forEach((draw, i) => g.at(ROOM_X[i], ROOM_Y, () => draw(g)));

  carvePockets(g, [forge, coldStore, vault, cistern, wastePit, gasCellar]);

  // shafts: the greenhouse drain to the cistern, the forge flue and the gas cellar vent to the surface
  g.rect(406, SURFACE, 5, 245 - SURFACE, T.AIR);
  g.rect(14 + 28, 118 + 3, 8, 205 + 23 - 118 - 3 + 40, T.AIR);
  g.rect(570 + 8, SURFACE - 14, 4, 240 - SURFACE + 14, T.AIR);
  for (let i = 0; i < 24; i++) g.setIfAir(578 + Math.floor(g.rand() * 4), SURFACE + Math.floor(g.rand() * 80), T.METHANE);

  // roof furniture: chimneys, a weather vane, the cat, the moon and stars
  for (const x of [150, 470]) {
    g.bricks(x, EAVE_Y - 44, 16, 40, T.STONE, 8, 3);
    g.air(x + 4, EAVE_Y - 44, 8, 28);
    g.rect(x - 2, EAVE_Y - 46, 20, 3, T.STONE);
    for (let i = 0; i < 20; i++) g.setIfAir(x + 2 + Math.floor(g.rand() * 12), EAVE_Y - 80 + Math.floor(g.rand() * 34), T.SMOKE);
  }
  g.rect(320, EAVE_Y - 52, 1, 22, T.STEEL);
  g.stamp(312, EAVE_Y - 52, ['...#....', '..###...', '.#####..'], { '#': T.STEEL });
  g.stamp(300, EAVE_Y - 36, [
    '#.....#.....',
    '##...###....',
    '#########...',
    '.########..#',
    '.#######..#.',
    '..#...#..#..',
  ], { '#': T.CHARCOAL });
  for (let i = 0; i < 50; i++) g.set(Math.floor(g.rand() * 640), 4 + Math.floor(g.rand() * 100), T.ICE);
  g.air(571, 29, 22, 22);
  g.disc(580, 40, 10, T.ICE);
  g.disc(586, 36, 9, T.AIR);
  return g;
}
