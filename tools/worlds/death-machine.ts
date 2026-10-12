import { Grid, T } from '../world-kit.ts';
import { POCKETS, SURFACE, carvePockets, fillGround, finishBoard, boardHall, galleryCorridor, lined, pipeLattice, shaft } from './underground.ts';

const S = SURFACE;
const SKULL_X = 324;
/** The methane spine runs along the rock under the soil, down the east side of the chips and into the reservoir in pocket 4. */
const DUCT_Y = 184;
const SPINE_X = 438;

/** Points of an ellipse outline, for brick-patterned polygons. */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n = 72): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return [cx + Math.cos(a) * (rx + 0.5), cy + Math.sin(a) * (ry + 0.5)] as [number, number];
  });
}

const SKULL_ART = [
  '..#####..',
  '.#######.',
  '#########',
  '#.##.##.#',
  '#.##.##.#',
  '.#######.',
  '..#.#.#..',
];

/** Guard tower with a searchlight torch, a coal heap, the loader funnel over the coal chute, a stubborn weed. */
function fuelYard(g: Grid): void {
  g.bricks(6, S - 36, 10, 36, T.STONE, 5, 3);
  g.rect(4, S - 40, 14, 4, T.STONE);
  g.rect(8, S - 42, 2, 2, T.TORCH);
  g.rect(12, S - 42, 2, 2, T.TORCH);
  g.poly([[24, S], [62, S], [56, S - 12], [46, S - 18], [38, S - 18], [30, S - 12]], T.CHARCOAL);
  g.rect(20, S - 3, 3, 3, T.DIRT);
  g.rect(21, S - 6, 1, 3, T.GRASS);
  g.rect(66, S - 18, 22, 2, T.STEEL);
  g.poly([[64, S - 16], [90, S - 16], [80, S - 4], [74, S - 4]], T.STEEL);
  g.poly([[67, S - 17], [87, S - 17], [79, S - 5], [75, S - 5]], T.CHARCOAL);
  g.line(60, S - 14, 70, S - 24, T.STEEL, 2);
  g.rect(94, S - 10, 10, 10, T.WOOD);
  g.rect(94, S - 20, 10, 10, T.WOOD);
  g.scatter(94, S - 21, 10, 22, T.MOLD, 0.25, T.WOOD);
  g.rect(106, S - 3, 2, 3, T.ASH);
}

/** The furnace's flue stack and the boiler's steam stack, both reaching down into the furnace hall left of the chips. */
function stacks(g: Grid): void {
  g.bricks(161, 70, 18, S - 69, T.STONE, 8, 4);
  g.rect(166, 68, 8, S - 66, T.AIR);
  g.rect(159, 66, 22, 3, T.STEEL);
  for (let y = 86; y < S - 6; y += 20) g.rect(159, y, 22, 2, T.STEEL);
  g.bricks(185, 100, 14, S - 99, T.STONE, 7, 4);
  g.rect(189, 98, 6, S - 96, T.AIR);
  g.rect(183, 96, 18, 3, T.STEEL);
  for (let y = 116; y < S - 6; y += 18) g.rect(183, y, 18, 2, T.STEEL);
  for (let i = 0; i < 20; i++) g.setIfAir(167 + Math.floor(g.rand() * 6), 70 + Math.floor(g.rand() * 50), T.SMOKE);
  for (let i = 0; i < 40; i++) g.setIfAir(190 + Math.floor(g.rand() * 4), 100 + Math.floor(g.rand() * 56), T.STEAM);
}

/** The skull: a stone head with a methane brain, torch eyes, bomb teeth and flaming horns, on a neck over the spine. */
function skullTower(g: Grid): void {
  const cx = SKULL_X;
  g.brickPoly([[270, S], [378, S], [378, S - 10], [352, S - 30], [348, S - 36], [300, S - 36], [296, S - 30], [270, S - 10]], T.STONE, 8, 4);
  g.air(304, S - 30, 14, 22);
  g.air(331, S - 30, 14, 22);
  g.gear(311, S - 20, 6, 8, T.STEEL, 4);
  g.gear(338, S - 20, 6, 8, T.STEEL, 4);
  for (const [bx, by] of [[308, S - 29], [308, S - 11], [339, S - 29], [339, S - 11]]) g.rect(bx, by, 3, 3, T.BOMB);
  for (const [rx, ry] of [[312, S - 14], [334, S - 22]]) g.set(rx, ry, T.COOLING_STEEL, { age: 20 });
  // cranium and jaw
  g.brickPoly(ellipsePoints(cx, 66, 40, 34), T.STONE, 8, 4);
  g.brickPoly([[cx - 32, 96], [cx + 32, 96], [cx + 27, 124], [cx - 27, 124]], T.STONE, 8, 4);
  // brain chamber (methane)
  for (let y = 34; y < 70; y++) for (let x = cx - 30; x < cx + 30; x++) if (Math.hypot((x - cx) / 27, (y - 52) / 14) <= 1) g.set(x, y, T.METHANE);
  // eyes
  for (const ex of [cx - 16, cx + 16]) {
    g.ellipse(ex, 82, 10, 8, T.STONE);
    g.ellipse(ex, 82, 8, 6, T.TORCH);
    g.ellipse(ex + (ex < cx ? 3 : -3), 83, 2, 3, T.STONE);
  }
  g.line(cx - 32, 70, cx - 8, 79, T.STEEL, 2);
  g.line(cx + 32, 70, cx + 8, 79, T.STEEL, 2);
  for (const rx of [cx - 30, cx - 24, cx + 24, cx + 30]) g.rect(rx, 92, 2, 2, T.STEEL);
  // mouth and teeth
  g.air(cx - 25, 102, 50, 14);
  for (let i = 0; i < 7; i++) {
    const tx = cx - 24 + i * 7;
    if (Math.abs(tx + 2 - cx) < 8) continue;
    g.rect(tx, 102, 5, 5, T.BOMB);
    g.rect(tx + 3, 111, 5, 5, T.BOMB);
  }
  // methane spine from the chamber down through the neck into the rock
  g.rect(cx - 6, 66, 13, S - 66, T.STONE);
  g.rect(cx - 3, 66, 7, S - 66, T.METHANE);
  // flaming horns
  for (const hx of [cx - 31, cx + 23]) {
    g.bricks(hx, 16, 8, 28, T.STONE, 4, 3);
    g.air(hx + 3, 14, 2, 26);
    g.rect(hx + 3, 40, 2, 1, T.TORCH);
  }
  g.rect(cx - 1, S - 66 + 66 - 66, 0, 0, T.AIR);
  // debris and hazard stripes at the foot
  g.poly([[378, S], [388, S], [385, S - 5], [380, S - 7]], T.RUBBLE);
  g.poly([[260, S], [270, S], [270, S - 6], [264, S - 4]], T.RUBBLE);
  for (let i = 0; i < 12; i++) g.rect(274 + i * 8, S - 3, 4, 3, i % 2 === 0 ? T.BOMB : T.ICE);
  // a bomb cord along the ground toward the depot
  for (let x = 382; x < 452; x += 8) g.rect(x, S - 2, 2, 2, T.BOMB);
}

/** Two acid tanks in glass (ice) on a steel tower over a mud bed. */
function acidTower(g: Grid): void {
  const x0 = 394;
  const x1 = 440;
  g.rect(x0, 78, 4, S - 78, T.STEEL);
  g.rect(x1 - 3, 78, 4, S - 78, T.STEEL);
  g.line(x0 + 2, 146, x1 - 1, 112, T.STEEL, 1);
  g.line(x1 - 1, 146, x0 + 2, 112, T.STEEL, 1);
  g.rect(x0 - 2, 108, x1 - x0 + 6, 3, T.STEEL);
  g.rect(x0 - 2, 144, x1 - x0 + 6, 3, T.STEEL);
  g.vessel(x0 + 4, 78, 26, 30, 2, T.ICE, T.ACID, 20);
  g.vessel(x0 + 16, 114, 24, 30, 2, T.ICE, T.ACID, 20);
  g.rect(x0 + 21, 70, 2, 8, T.STEEL);
  g.rect(x0 + 19, 66, 6, 4, T.STONE);
  g.rect(x0 + 20, 64, 4, 2, T.TORCH);
  g.vessel(x0, S - 10, 48, 10, 2, T.STONE, T.MUD, 6);
}

/** Warehouse of bomb stacks with a crane, under a smokestack whose torch sits on a stone cap. */
function depot(g: Grid): void {
  const x0 = 452;
  const x1 = 560;
  g.rect(x0, 100, 4, S - 100, T.STEEL);
  g.rect(x1 - 4, 100, 4, S - 100, T.STEEL);
  g.poly([[x0 - 4, 100], [504, 82], [x1 + 4, 100]], T.STEEL);
  g.poly([[x0 + 2, 100], [504, 86], [x1 - 2, 100]], T.AIR);
  g.rect(494, 78, 20, 8, T.STONE);
  const stacks: [number, number, number][] = [[462, 26, 4], [494, 22, 3], [524, 28, 5]];
  for (const [sx, w, rows] of stacks) {
    g.rect(sx, S - 2, w, 2, T.WOOD);
    for (let r = 0; r < rows; r++) g.rect(sx + Math.floor(r / 2), S - 7 - r * 5, w - Math.floor(r / 2) * 2, 4, T.BOMB);
  }
  g.rect(x0 + 4, 108, x1 - x0 - 8, 2, T.STEEL);
  g.rect(484, 106, 8, 4, T.STEEL);
  g.line(488, 110, 488, 124, T.STEEL, 1);
  g.rect(484, 124, 9, 5, T.BOMB);
  g.bricks(500, 40, 18, 40, T.STONE, 8, 4);
  g.air(505, 38, 8, 40);
  g.rect(498, 36, 22, 3, T.STEEL);
  g.rect(507, 77, 4, 1, T.TORCH);
  for (let y = 52; y < 76; y += 12) g.rect(498, y, 22, 2, T.STEEL);
}

/** Right yard: an acid moat trench in the soil, a spiked fence, drums, a guard tower, a skull flag. */
function rightYard(g: Grid): void {
  g.rect(576, S, 34, 8, T.AIR);
  g.rect(576, S + 2, 34, 6, T.ACID);
  g.rect(572, S - 1, 4, 3, T.MUD);
  g.rect(610, S - 1, 4, 3, T.MUD);
  for (let x = 566; x < 640; x += 6) {
    g.rect(x, S - 16, 2, 16, T.STEEL);
    g.set(x, S - 18, T.STEEL);
    g.set(x + 1, S - 17, T.STEEL);
  }
  g.rect(566, S - 12, 74, 1, T.STEEL);
  g.vessel(616, S - 12, 9, 12, 1, T.STEEL, T.ACID, 8);
  g.set(616, S - 3, T.AIR);
  g.bricks(626, S - 36, 12, 36, T.STONE, 6, 3);
  g.rect(622, S - 40, 20, 4, T.STONE);
  g.rect(628, S - 42, 2, 2, T.TORCH);
  g.rect(634, S - 42, 2, 2, T.TORCH);
  g.rect(588, S - 40, 2, 40, T.STEEL);
  g.rect(590, S - 40, 14, 10, T.STEEL);
  g.stamp(592, S - 38, ['.#####.', '#.#.#.#', '.#####.', '..#.#..'].map((r) => r), { '#': T.ICE });
}

/** Pocket 1: coal bunker under the loader chute, a bucket wheel, mold-eaten beams. */
function coalBunker(g: Grid): void {
  const floor = 132;
  g.poly([[8, floor], [118, floor], [102, floor - 40], [74, floor - 48], [58, floor - 48], [28, floor - 40]], T.CHARCOAL);
  for (let i = 0; i < 8; i++) g.set(40 + Math.floor(g.rand() * 46), floor - 44 + Math.floor(g.rand() * 8), T.EMBER, { age: Math.floor(g.rand() * 200) });
  g.gear(100, 40, 18, 14, T.STEEL, 6);
  g.gear(100, 40, 5, 6, T.STEEL, 4);
  g.line(100, 58, 72, 80, T.STEEL, 1);
  for (let i = 0; i < 5; i++) g.rect(106 + (i % 2) * 4, 30 + i * 8, 4, 3, T.STEEL);
  g.rect(4, 20, 3, floor - 19, T.WOOD);
  g.rect(119, 20, 3, floor - 19, T.WOOD);
  g.rect(4, 18, 118, 3, T.WOOD);
  g.scatter(4, 16, 118, 20, T.MOLD, 0.12, T.WOOD);
  for (const x of [20, 30]) for (let y = 0; y < 16; y += 3) g.rect(x, y, 1, 2, T.STEEL);
  g.scatter(10, floor - 2, 106, 2, T.ASH, 0.1, T.AIR);
}

/** Pocket 2: furnace torches under a steel bar, a boiler tank resting on it, flue and steam shafts to the surface. */
function furnaceHall(g: Grid): void {
  const floor = 137;
  g.bricks(1, 80, 22, floor - 79, T.STONE, 8, 4);
  g.air(3, 100, 18, 31);
  for (const x of [4, 9, 14]) g.rect(x, 131, 3, 1, T.TORCH);
  for (const x of [5, 10, 15]) g.set(x + 1, 130, T.EMBER, { age: 60 });
  g.rect(14, -22, 8, 122, T.AIR);
  // the heat bar: through the flames and under the boiler
  g.rect(1, 117, 50, 3, T.STEEL);
  for (let x = 3; x < 22; x++) for (let y = 117; y <= 119; y++) if (g.rand() < 0.7) g.set(x, y, T.HOT_STEEL, { age: Math.floor(g.rand() * 100) });
  for (let i = 0; i < 12; i++) g.setIfAir(4 + Math.floor(g.rand() * 17), 102 + Math.floor(g.rand() * 10), T.SMOKE);
  for (let i = 0; i < 5; i++) g.setIfAir(4 + Math.floor(g.rand() * 16), 121 + Math.floor(g.rand() * 8), T.FLAME);
  for (let i = 0; i < 4; i++) g.setIfAir(4 + Math.floor(g.rand() * 16), 112 + Math.floor(g.rand() * 5), T.SPARK);
  // boiler tank on the bar, under the steam stack
  g.rect(25, 96, 26, 21, T.STEEL);
  g.rect(28, 99, 20, 15, T.AIR);
  g.rect(28, 109, 20, 5, T.WATER);
  g.rect(35, 76, 10, 21, T.STEEL);
  g.rect(37, 70, 6, 27, T.AIR);
  for (const vx of [27, 46]) {
    g.rect(vx, 88, 4, 9, T.STEEL);
    g.rect(vx + 1, 88, 2, 10, T.AIR);
    g.rect(vx - 1, 86, 6, 2, T.STEEL);
  }
  for (let i = 0; i < 30; i++) g.setIfAir(29 + Math.floor(g.rand() * 18), 100 + Math.floor(g.rand() * 8), T.STEAM);
  g.ring(38, 106, 5, 2, T.STEEL);
  g.line(38, 106, 40, 103, T.STEEL, 1);
  g.bricks(27, 120, 6, floor - 119, T.STONE, 6, 3);
  g.bricks(45, 120, 6, floor - 119, T.STONE, 6, 3);
  // steam pipe overhead, ash on the floor
  g.rect(4, 22, 36, 2, T.STEEL);
  g.rect(38, 22, 2, 48, T.STEEL);
  g.scatter(25, floor - 2, 26, 2, T.ASH, 0.15, T.AIR);
}

/** Pocket 4 (right of the chips): the methane reservoir, fed from the skull's spine, over a sealed bomb magazine. */
function reservoir(g: Grid): void {
  const floor = 92;
  for (let y = 0; y < 44; y++) for (let x = 0; x < 52; x++) g.setIfAir(x, y, T.METHANE);
  g.rect(0, 44, 52, 3, T.STONE);
  // magazine: three rows of bombs on a wooden floor, sandbags at the sides, a warning skull above
  for (let r = 0; r < 3; r++) g.rect(8, 60 + r * 5, 36, 4, T.BOMB);
  g.rect(6, floor - 4, 40, 2, T.WOOD);
  g.stamp(21, 50, SKULL_ART, { '#': T.ICE });
  g.poly([[0, floor], [6, floor], [6, floor - 18], [0, floor - 18]], T.WET_SAND);
  g.poly([[46, floor], [52, floor], [52, floor - 14], [46, floor - 14]], T.SAND);
}

/** Pocket 5: a conveyor of bombs under a steel press and an overhead crane. */
function bombLine(g: Grid): void {
  const floor = 112;
  g.rect(4, floor - 26, 62, 3, T.STONE);
  for (let x = 4; x < 66; x += 16) g.rect(x, floor - 23, 3, 24, T.STONE);
  for (let i = 0; i < 5; i++) g.rect(10 + i * 11, floor - 30, 4, 4, T.BOMB);
  g.rect(24, 28, 4, floor - 70, T.STEEL);
  g.rect(44, 28, 4, floor - 70, T.STEEL);
  g.rect(22, 26, 28, 4, T.STEEL);
  g.rect(32, 36, 8, 18, T.STEEL);
  g.rect(4, 12, 62, 2, T.STEEL);
  g.line(14, 14, 14, 46, T.STEEL, 1);
  g.rect(10, 46, 8, 4, T.STEEL);
  g.rect(10, 50, 8, 4, T.BOMB);
  g.gear(14, 92, 8, 8, T.STEEL, 4);
  for (let r = 0; r < 3; r++) g.rect(40, floor - 6 - r * 5, 24, 4, T.BOMB);
  g.rect(40, floor - 1, 24, 2, T.WOOD);
  g.stamp(26, 62, SKULL_ART, { '#': T.ICE });
  g.poly([[0, floor], [12, floor], [8, floor - 6], [0, floor - 8]], T.RUBBLE);
}

/** Pocket 6: a spiked acid pit that a leaking drum and a dripping spring keep topped up and diluted. */
function acidPit(g: Grid): void {
  const floor = 97;
  g.vessel(4, 44, 56, floor - 43, 2, T.ICE, T.ACID, 34);
  for (const x of [14, 24, 34, 44]) g.rect(x, floor - 18, 1, 14, T.STEEL);
  g.stamp(28, floor - 34, SKULL_ART, { '#': T.ICE });
  g.rect(34, floor - 35, 1, 20, T.AIR);
  g.pipe([[40, 0], [40, 14]], 1, 1, T.STEEL);
  g.rect(39, 14, 3, 3, T.AIR);
  g.set(40, 2, T.SPRING);
  g.rect(0, 20, 3, 24, T.WOOD);
  g.scatter(0, 18, 4, 26, T.MOLD, 0.3, T.WOOD);
  g.rect(62, floor - 6, 2, 6, T.MUD);
}

export function buildDeathMachine(): Grid {
  const g = new Grid(666);
  fillGround(g, () => S, 0);
  fuelYard(g);
  stacks(g);
  skullTower(g);
  acidTower(g);
  depot(g);
  rightYard(g);
  carvePockets(g, [coalBunker, furnaceHall, reservoir, bombLine, acidPit]);
  // the methane spine: from the skull's neck along the rock above the chips, down their east side and through the roof of the reservoir
  const spine: [number, number, number, number][] = [
    [SKULL_X - 3, S, 7, DUCT_Y + 7 - S],
    [SKULL_X - 3, DUCT_Y, SPINE_X + 7 - (SKULL_X - 3), 7],
    [SPINE_X, DUCT_Y, 7, POCKETS[2].y - 3 - DUCT_Y],
  ];
  lined(g, spine, T.METHANE);
  g.rect(SPINE_X, POCKETS[2].y - 3, 7, 4, T.METHANE);
  // shafts: coal chute, flue and steam stacks
  shaft(g, 70, S - 4, 6, 205);
  g.rect(70, S - 4, 6, 40, T.CHARCOAL);
  shaft(g, 166, 68, 8, 262);
  shaft(g, 189, 98, 6, 270);
  for (let i = 0; i < 90; i++) g.setIfAir(190 + Math.floor(g.rand() * 5), 120 + Math.floor(g.rand() * 130), T.STEAM);
  for (let i = 0; i < 70; i++) g.set(Math.floor(g.rand() * 640), 3 + Math.floor(g.rand() * 100), T.ICE);
  boardHall(g);
  pipeLattice(g, T.STEEL, T.AIR);
  galleryCorridor(g);
  finishBoard(g, 'death-machine');
  return g;
}
