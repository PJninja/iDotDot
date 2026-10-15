import { Grid, T } from '../world-kit.ts';
import { POCKETS, SURFACE, carvePockets, fillGround, finishBoard, boardHall, galleryCorridor, lined, pipeLattice, shaft } from './underground.ts';
import type { Circuit } from './circuits.ts';
import type { CellRect } from '../../src/worlds/board-slots.ts';

const S = SURFACE;
const SKULL_X = 324;
/** The methane spine runs along the rock under the soil, down the east side of the chips and into the reservoir in pocket 4. */
const DUCT_Y = 184;
const SPINE_X = 462;
/** Left edge of each bomb tooth (5 wide, a top and a bottom row): out on the cheeks, 6 or more cells from the neck. */
const TEETH_X = [SKULL_X - 24, SKULL_X - 18, SKULL_X + 14, SKULL_X + 20];

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
  g.bricks(149, 70, 16, S - 69, T.STONE, 8, 4);
  g.rect(154, 68, 6, S - 66, T.AIR);
  g.rect(147, 66, 20, 3, T.STEEL);
  for (let y = 86; y < S - 6; y += 20) g.rect(147, y, 20, 2, T.STEEL);
  g.bricks(165, 100, 12, S - 99, T.STONE, 6, 4);
  g.rect(169, 98, 4, S - 96, T.AIR);
  g.rect(163, 96, 16, 3, T.STEEL);
  for (let y = 116; y < S - 6; y += 18) g.rect(163, y, 16, 2, T.STEEL);
  for (let i = 0; i < 20; i++) g.setIfAir(155 + Math.floor(g.rand() * 4), 70 + Math.floor(g.rand() * 50), T.SMOKE);
  for (let i = 0; i < 40; i++) g.setIfAir(169 + Math.floor(g.rand() * 3), 100 + Math.floor(g.rand() * 56), T.STEAM);
}

/**
 * The skull: a stone head with a sealed methane brain, torch eyes, bomb teeth set well out to the
 * cheeks and flaming horns, on a solid stone neck over the spine. The neck holds no methane, so
 * the brain and the spine are two separate bodies about 90 cells apart and a blast in the head
 * cannot chain into the reservoir (see `skullWiring` for what ignites the head).
 */
function skullTower(g: Grid): void {
  const cx = SKULL_X;
  g.brickPoly([[270, S], [378, S], [378, S - 10], [352, S - 30], [348, S - 36], [300, S - 36], [296, S - 30], [270, S - 10]], T.STONE, 8, 4);
  g.air(304, S - 30, 14, 22);
  g.air(331, S - 30, 14, 22);
  g.gear(311, S - 20, 6, 8, T.STEEL, 4);
  g.gear(338, S - 20, 6, 8, T.STEEL, 4);
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
  for (const tx of TEETH_X) {
    g.rect(tx, 102, 5, 5, T.BOMB);
    g.rect(tx, 111, 5, 5, T.BOMB);
  }
  // solid stone neck from the brain's floor down to the tower; the methane spine starts below ground
  g.rect(cx - 6, 66, 13, S - 66, T.STONE);
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

/** Pocket 2 (33 wide): furnace torches under a steel bar, a boiler tank resting on it, flue and steam shafts to the surface. */
function furnaceHall(g: Grid): void {
  const floor = 137;
  g.bricks(1, 80, 16, floor - 79, T.STONE, 8, 4);
  g.air(3, 100, 12, 31);
  for (const x of [4, 8, 11]) g.rect(x, 131, 3, 1, T.TORCH);
  for (const x of [5, 9]) g.set(x + 1, 130, T.EMBER, { age: 60 });
  g.rect(8, -22, 6, 122, T.AIR);
  // the heat bar: through the flames and under the boiler
  g.rect(1, 117, 31, 3, T.STEEL);
  for (let x = 3; x < 15; x++) for (let y = 117; y <= 119; y++) if (g.rand() < 0.7) g.set(x, y, T.HOT_STEEL, { age: Math.floor(g.rand() * 100) });
  for (let i = 0; i < 9; i++) g.setIfAir(4 + Math.floor(g.rand() * 11), 102 + Math.floor(g.rand() * 10), T.SMOKE);
  for (let i = 0; i < 4; i++) g.setIfAir(4 + Math.floor(g.rand() * 10), 121 + Math.floor(g.rand() * 8), T.FLAME);
  for (let i = 0; i < 3; i++) g.setIfAir(4 + Math.floor(g.rand() * 10), 112 + Math.floor(g.rand() * 5), T.SPARK);
  // boiler tank on the bar, under the steam stack
  g.rect(17, 96, 16, 21, T.STEEL);
  g.rect(19, 99, 12, 15, T.AIR);
  g.rect(19, 109, 12, 5, T.WATER);
  g.rect(21, 76, 8, 21, T.STEEL);
  g.rect(23, 70, 4, 27, T.AIR);
  for (const vx of [17, 29]) {
    g.rect(vx, 88, 3, 9, T.STEEL);
    g.rect(vx + 1, 88, 1, 10, T.AIR);
    g.rect(vx - 1, 86, 5, 2, T.STEEL);
  }
  for (let i = 0; i < 20; i++) g.setIfAir(20 + Math.floor(g.rand() * 10), 100 + Math.floor(g.rand() * 8), T.STEAM);
  g.ring(25, 106, 4, 2, T.STEEL);
  g.line(25, 106, 27, 103, T.STEEL, 1);
  g.bricks(18, 120, 5, floor - 119, T.STONE, 5, 3);
  g.bricks(27, 120, 5, floor - 119, T.STONE, 5, 3);
  // steam pipe overhead, ash on the floor
  g.rect(4, 22, 22, 2, T.STEEL);
  g.rect(24, 22, 2, 48, T.STEEL);
  g.scatter(17, floor - 2, 15, 2, T.ASH, 0.15, T.AIR);
}

/** Pocket 4 (right of the chips, 31 wide): the methane reservoir, fed from the skull's spine, over a sealed bomb magazine. */
function reservoir(g: Grid): void {
  const floor = 92;
  for (let y = 0; y < 44; y++) for (let x = 0; x < 31; x++) g.setIfAir(x, y, T.METHANE);
  g.rect(0, 44, 31, 3, T.STONE);
  // magazine: three rows of bombs on a wooden floor, sandbags at the sides, a warning skull above
  for (let r = 0; r < 3; r++) g.rect(5, 60 + r * 5, 21, 4, T.BOMB);
  g.rect(3, floor - 4, 25, 2, T.WOOD);
  g.stamp(11, 50, SKULL_ART, { '#': T.ICE });
  g.poly([[0, floor], [4, floor], [4, floor - 18], [0, floor - 18]], T.WET_SAND);
  g.poly([[27, floor], [31, floor], [31, floor - 14], [27, floor - 14]], T.SAND);
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

/**
 * The skull's power and ignition. A generator is walled into the stone neck and a copper trunk
 * runs up the middle of the neck, inside the stone. At the jaw a copper row along the mouth's
 * ceiling touches every top tooth, so the bombs go off; at the top the trunk feeds two steel spark
 * plugs standing in the methane brain, so the head goes off too. The first pulse starts it.
 */
function skullWiring(g: Grid): void {
  const cx = SKULL_X;
  g.rect(cx - 1, 140, 2, 2, T.GENERATOR);
  g.rect(cx, 67, 1, 73, T.COPPER);
  g.rect(cx - 24, 101, 49, 1, T.COPPER);
  g.rect(cx - 2, 67, 5, 1, T.COPPER);
  g.rect(cx - 2, 60, 1, 7, T.STEEL);
  g.rect(cx + 2, 60, 1, 7, T.STEEL);
}

/**
 * A tesla coil in the empty meadow left of the stacks: a generator walled into a stone base, a copper
 * riser with copper windings round a stone core, and a steel terminal on top that throws arcs. The
 * terminal is the only steel, so an overloaded pulse can only make it glow. Nothing flammable is near.
 */
function teslaCoil(g: Grid): void {
  g.bricks(120, S - 8, 18, 8, T.STONE, 6, 2);
  g.rect(131, 152, 2, 2, T.GENERATOR);
  g.rect(128, 121, 4, 29, T.STONE);
  g.rect(132, 118, 1, 34, T.COPPER);
  for (const y of [124, 129, 134, 139, 144]) g.rect(125, y, 8, 1, T.COPPER);
  g.disc(132, 114, 4, T.STEEL);
}

/**
 * Pocket 5's detonator, in pocket-local coordinates: a stone vault at the crane rail's left end
 * feeds the crane's steel (rail, rope and hook, which touches the hanging bomb), and a copper line
 * down the left wall reaches the first bomb on the conveyor, clear of the gear beside it. The vault
 * is empty: a bomb's blast reaches about 50 cells, and every bomb here is within that of the board
 * (through 3 cells of rock into pocket 4's magazine), so nothing sets them off by itself.
 */
function bombLineWiring(g: Grid): void {
  g.rect(0, 9, 4, 7, T.STONE);
  g.rect(3, 11, 1, 3, T.COPPER);
  g.rect(3, 14, 1, 69, T.COPPER);
  g.rect(4, 82, 6, 1, T.COPPER);
}

const inPocket = (i: number, r: CellRect): CellRect => ({ x: POCKETS[i].x + r.x, y: POCKETS[i].y + r.y, w: r.w, h: r.h });

const skullCircuit: Circuit = {
  name: 'skull',
  sources: { x: SKULL_X - 3, y: 138, w: 6, h: 6 },
  bounds: [{ x: SKULL_X - 26, y: 58, w: 53, h: 86 }],
  loads: [
    { name: 'brain spark plugs', at: { x: SKULL_X - 2, y: 60, w: 5, h: 1 } },
    { name: 'teeth wire', at: { x: SKULL_X - 24, y: 101, w: 49, h: 1 } },
  ],
  ignites: [
    { x: SKULL_X - 30, y: 36, w: 61, h: 32 },
    { x: SKULL_X - 26, y: 100, w: 53, h: 17 },
  ],
};

const teslaCircuit: Circuit = {
  name: 'tesla coil',
  sources: { x: 130, y: 151, w: 4, h: 4 },
  bounds: [{ x: 118, y: 108, w: 22, h: 52 }],
  loads: [{ name: 'terminal', at: { x: 132, y: 112, w: 1, h: 1 } }],
};

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
  shaft(g, 154, 68, 6, 262);
  shaft(g, 169, 98, 4, 270);
  for (let i = 0; i < 90; i++) g.setIfAir(169 + Math.floor(g.rand() * 4), 120 + Math.floor(g.rand() * 130), T.STEAM);
  for (let i = 0; i < 70; i++) g.set(Math.floor(g.rand() * 640), 3 + Math.floor(g.rand() * 100), T.ICE);
  boardHall(g);
  pipeLattice(g, T.STEEL, T.AIR);
  galleryCorridor(g);
  // the electric parts go in last, so the scatter drawn before them is not disturbed
  skullWiring(g);
  teslaCoil(g);
  g.at(POCKETS[3].x, POCKETS[3].y, () => bombLineWiring(g));
  finishBoard(g, 'death-machine', [skullCircuit, teslaCircuit]);
  return g;
}
