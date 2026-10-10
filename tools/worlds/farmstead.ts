import { Grid, T } from '../world-kit.ts';
import { POCKETS } from './underground.ts';

const W = 640;
const H = 348;
/** Everything above ground is drawn at unlifted coordinates and shifted up by this much. */
const LIFT = 18;

/** Surface height (row of the first soil cell) along x, interpolated between control points. */
const SURFACE_POINTS: [number, number][] = [
  [0, 186], [30, 181], [66, 176], [262, 176], [282, 172], [300, 170], [335, 170], [352, 178], [366, 185],
  [470, 185], [480, 184], [548, 182], [580, 166], [610, 160], [640, 158],
];

function surface(x: number): number {
  for (let i = 0; i + 1 < SURFACE_POINTS.length; i++) {
    const [x0, y0] = SURFACE_POINTS[i];
    const [x1, y1] = SURFACE_POINTS[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      return Math.round(y0 + (y1 - y0) * s);
    }
  }
  return SURFACE_POINTS[SURFACE_POINTS.length - 1][1];
}

function terrain(g: Grid): void {
  for (let x = 0; x < W; x++) {
    const top = surface(x) - LIFT;
    for (let y = top; y < H; y++) {
      g.set(x, y, y < top + 12 ? T.DIRT : T.STONE);
    }
    const bare = x >= 556;
    g.set(x, top, bare ? T.DIRT : T.GRASS);
    g.set(x, top + 1, bare ? T.DIRT : T.GRASS);
  }
  // earthy lenses in the rock and soil
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(g.rand() * W);
    const y = 190 + Math.floor(g.rand() * 150);
    const type = [T.RUBBLE, T.DIRT, T.SAND, T.MUD][Math.floor(g.rand() * 4)];
    g.ellipse(x, y, 3 + g.rand() * 6, 2 + g.rand() * 3, type);
  }
}

/** Farmhouse: wooden walls, slate roof, a stone hearth with a flue, an ice-glass window. */
function farmhouse(g: Grid): void {
  const base = 176;
  g.bricks(68, base - 4, 74, 4, T.STONE, 6, 2);
  g.boards(72, base - 30, 5, 26, 5);
  g.boards(133, base - 30, 5, 26, 5);
  g.planks(72, base - 6, 66, 2, 2);
  g.air(77, base - 30, 56, 24);
  // slate roof
  g.brickPoly([[64, base - 28], [105, base - 52], [146, base - 28]], T.STONE, 6, 3);
  g.air(78, base - 29, 54, 1);
  g.rect(72, base - 31, 66, 2, T.WOOD);
  // window
  g.rect(72, base - 22, 5, 10, T.ICE);
  g.rect(72, base - 17, 5, 1, T.WOOD);
  // hearth, flue and chimney
  g.bricks(118, base - 18, 15, 12, T.STONE, 5, 3);
  g.air(121, base - 16, 9, 8);
  g.rect(124, base - 9, 3, 2, T.TORCH);
  g.rect(122, base - 32, 11, 14, T.STONE);
  g.bricks(122, base - 66, 11, 48, T.STONE, 5, 3);
  g.air(125, base - 62, 5, 48);
  g.rect(121, base - 68, 13, 3, T.STONE);
  for (let i = 0; i < 10; i++) g.setIfAir(125 + Math.floor(g.rand() * 5), base - 62 + Math.floor(g.rand() * 30), T.SMOKE);
  // table, chairs, a shelf of jars
  g.rect(88, base - 17, 18, 2, T.WOOD);
  g.rect(90, base - 15, 2, 9, T.WOOD);
  g.rect(102, base - 15, 2, 9, T.WOOD);
  g.rect(84, base - 14, 2, 8, T.WOOD);
  g.rect(84, base - 14, 4, 1, T.WOOD);
  g.rect(108, base - 14, 2, 8, T.WOOD);
  g.rect(106, base - 14, 4, 1, T.WOOD);
  g.rect(80, base - 30, 22, 2, T.WOOD);
  for (let i = 0; i < 4; i++) g.vessel(82 + i * 5, base - 36, 4, 6, 1, T.ICE, [T.WATER, T.MUD, T.SAND, T.WATER][i], 3);
  g.rect(94, base - 20, 3, 3, T.STEEL);
  // porch and fence
  g.planks(60, base - 2, 12, 2, 2);
  for (let x = 52; x < 64; x += 5) {
    g.rect(x, base - 9, 2, 9, T.WOOD);
  }
  g.rect(52, base - 7, 12, 1, T.WOOD);
  g.rect(52, base - 4, 12, 1, T.WOOD);
}

function barn(g: Grid): void {
  const base = 176;
  g.bricks(146, base - 4, 82, 4, T.STONE, 6, 2);
  g.boards(148, base - 42, 5, 38, 5);
  g.boards(221, base - 42, 5, 38, 5);
  // gambrel roof
  g.boards(146, base - 56, 82, 14, 6);
  g.poly([[146, base - 42], [158, base - 56], [216, base - 56], [228, base - 42]], T.WOOD);
  g.air(153, base - 42, 68, 38);
  g.rect(148, base - 43, 78, 3, T.WOOD);
  // hayloft with a hay pile and bales
  g.planks(153, base - 26, 46, 3, 3);
  g.poly([[154, base - 27], [198, base - 27], [186, base - 38], [166, base - 38]], T.GRASS);
  g.rect(172, base - 33, 10, 6, T.GRASS);
  // ladder to the loft
  g.rect(204, base - 26, 1, 22, T.WOOD);
  g.rect(210, base - 26, 1, 22, T.WOOD);
  for (let y = base - 24; y < base - 4; y += 3) g.rect(204, y, 7, 1, T.WOOD);
  // stalls and a cow
  g.rect(214, base - 18, 2, 14, T.WOOD);
  g.rect(158, base - 17, 36, 3, T.WOOD);
  g.rect(158, base - 14, 3, 10, T.WOOD);
  g.rect(190, base - 14, 3, 10, T.WOOD);
  g.rect(163, base - 11, 20, 6, T.WOOD);
  g.rect(163, base - 5, 2, 5, T.WOOD);
  g.rect(179, base - 5, 2, 5, T.WOOD);
  for (const [dx, dy] of [[166, 11], [167, 11], [170, 9], [171, 9], [172, 10], [176, 12], [177, 12], [177, 11]]) g.set(dx, base - dy + 0, T.CHARCOAL);
  g.rect(183, base - 12, 4, 4, T.WOOD);
  g.set(184, base - 11, T.CHARCOAL);
  // plow
  g.line(196, base - 5, 212, base - 5, T.STEEL, 1);
  g.line(204, base - 5, 214, base - 12, T.STEEL, 1);
  g.rect(196, base - 8, 3, 3, T.STEEL);
}

/** The old factory stack, now a silo: bricks, steel bands, a hat; its bore carries boiler steam. */
function silo(g: Grid): void {
  const base = 176;
  g.bricks(233, 98, 26, base - 98, T.STONE, 8, 4);
  g.air(241, 100, 10, base - 100);
  for (let y = 108; y < base - 8; y += 18) g.rect(231, y, 30, 2, T.STEEL);
  g.rect(236, 94, 20, 3, T.STEEL);
  g.rect(238, 97, 2, 3, T.STEEL);
  g.rect(252, 97, 2, 3, T.STEEL);
  g.poly([[231, 98], [246, 88], [261, 98]], T.STEEL);
  g.air(242, 99, 8, 2);
}

function windmill(g: Grid): void {
  const base = 170;
  g.poly([[288, base], [322, base], [312, 124], [298, 124]], T.WOOD);
  g.boards(290, base - 4, 30, 4, 5);
  g.rect(300, base - 14, 6, 14, T.AIR);
  g.rect(299, base - 15, 8, 1, T.STONE);
  g.rect(298, 116, 14, 8, T.WOOD);
  g.poly([[296, 116], [305, 106], [314, 116]], T.WOOD);
  g.disc(305, 114, 3, T.STEEL);
  for (let k = 0; k < 4; k++) {
    const a = (Math.PI / 2) * k + Math.PI / 4;
    const ex = 305 + Math.cos(a) * 30;
    const ey = 114 + Math.sin(a) * 30;
    g.line(305, 114, ex, ey, T.WOOD, 2);
    for (let t = 0.25; t < 1; t += 0.18) {
      const mx = 305 + Math.cos(a) * 30 * t;
      const my = 114 + Math.sin(a) * 30 * t;
      const nx = Math.cos(a + Math.PI / 2) * 5;
      const ny = Math.sin(a + Math.PI / 2) * 5;
      g.line(mx, my, mx + nx, my + ny, T.WOOD, 1);
    }
  }
}

function orchard(g: Grid): void {
  for (const [x, h] of [[12, 22], [34, 26], [54, 20]] as [number, number][]) {
    const top = surface(x);
    g.rect(x - 1, top - h, 3, h, T.WOOD);
    g.rect(x - 8, top - h - 1, 17, 2, T.WOOD);
    g.poly([[x - 9, top - h - 2], [x + 9, top - h - 2], [x + 4, top - h - 10], [x - 4, top - h - 10]], T.GRASS);
    g.line(x, top - h + 6, x - 5, top - h + 1, T.WOOD, 1);
    g.line(x, top - h + 8, x + 5, top - h + 2, T.WOOD, 1);
  }
}

export function buildFarmstead(): Grid {
  const g = new Grid(7001);
  terrain(g);
  g.at(0, -LIFT, () => {
    orchard(g);
    sheep(g, 19, surface(23));
    sheep(g, 39, surface(43));
    farmhouse(g);
    barn(g);
    silo(g);
    windmill(g);
    field(g);
    // hay bales at the field edge and a plank bridge over the outlet
    g.rect(452, surface(456) - 7, 9, 7, T.GRASS);
    g.rect(462, surface(466) - 7, 9, 7, T.GRASS);
    g.rect(457, surface(458) - 14, 9, 7, T.GRASS);
    g.rect(472, 177, 12, 2, T.WOOD);
    pond(g);
    campfire(g);
  });
  for (let i = 0; i < 60; i++) g.set(Math.floor(g.rand() * W), 4 + Math.floor(g.rand() * 100), T.ICE);
  g.disc(560, 52, 10, T.ICE);
  g.disc(566, 48, 9, T.AIR);
  for (const c of CHAMBERS) {
    g.bricks(c.x - 3, c.y - 3, c.w + 6, c.h + 3, T.STONE, 8, 4);
    g.air(c.x, c.y, c.w, c.h);
  }
  for (const c of CHAMBERS) g.at(c.x, c.y, () => c.draw(g));
  // shafts: the silo bore down to the boiler hall's hood, the field drain and the well down to the cistern
  g.rect(243, 142, 6, 70, T.AIR);
  g.rect(368, 174, 5, 72, T.AIR);
  g.rect(418, 160, 4, 86, T.AIR);
  g.rect(618, 142, 3, 100, T.AIR);
  for (let i = 0; i < 90; i++) g.setIfAir(243 + Math.floor(g.rand() * 6), 150 + Math.floor(g.rand() * 60), T.STEAM);
  for (let i = 0; i < 40; i++) g.setIfAir(241 + Math.floor(g.rand() * 10), 86 + Math.floor(g.rand() * 56), T.STEAM);
  for (let i = 0; i < 40; i++) g.setIfAir(618 + Math.floor(g.rand() * 3), 150 + Math.floor(g.rand() * 90), T.METHANE);
  return g;
}

/** Crop rows on mud ridges, a drain pit at the low end, a well and a scarecrow. */
function field(g: Grid): void {
  const top = 185;
  for (let x = 372; x < 466; x += 7) {
    g.rect(x, top, 3, 2, T.AIR);
    g.rect(x, top + 1, 3, 2, T.MUD);
    for (let k = 0; k < 2; k++) g.rect(x + 4, top - 3 - Math.floor(g.rand() * 3), 2, 4 + Math.floor(g.rand() * 3), T.GRASS);
  }
  g.scatter(366, top, 104, 4, T.MUD, 0.3, T.DIRT);
  // drain pit at the low end
  g.rect(364, top - 1, 6, 6, T.AIR);
  g.rect(364, top + 5, 6, 1, T.MUD);
  g.bricks(362, top - 2, 2, 8, T.STONE, 2, 2);
  // well with a bucket sweep
  g.bricks(412, top - 8, 14, 8, T.STONE, 4, 2);
  g.air(416, top - 8, 6, 8);
  g.rect(410, top - 24, 2, 24, T.WOOD);
  g.rect(426, top - 24, 2, 24, T.WOOD);
  g.rect(408, top - 26, 22, 3, T.WOOD);
  g.line(418, top - 24, 418, top - 14, T.STEEL, 1);
  g.vessel(416, top - 14, 5, 5, 1, T.WOOD, T.WATER, 2);
  // scarecrow
  g.rect(390, top - 20, 2, 20, T.WOOD);
  g.rect(384, top - 17, 14, 2, T.WOOD);
  g.rect(388, top - 25, 6, 5, T.GRASS);
  g.rect(386, top - 26, 10, 1, T.WOOD);
  g.rect(385, top - 15, 2, 5, T.GRASS);
  g.rect(395, top - 15, 2, 5, T.GRASS);
  g.set(396, top - 18, T.CHARCOAL);
  g.set(397, top - 18, T.CHARCOAL);
  g.set(396, top - 19, T.CHARCOAL);
}

/** A sheep: a wool of ash on a wooden belly plate, wooden legs, a dark face. */
function sheep(g: Grid, x: number, ground: number): void {
  g.stamp(x, ground - 8, [
    '..AAAAAA...',
    '.AAAAAAAA..',
    'AAAAAAAAAAF',
    'AAAAAAAAAAFF',
    '.PPPPPPPP..',
    '.L.L..L.L..',
    '.L.L..L.L..',
  ].map((row) => row.padEnd(12, '.')), { A: T.ASH, F: T.CHARCOAL, P: T.WOOD, L: T.WOOD });
}

/** Pond with an outlet toward the field, fed by a spring on the hill; reeds and a dock. */
function pond(g: Grid): void {
  const rim = 184;
  for (let x = 481; x <= 546; x++) {
    const depth = Math.min(11, Math.min(x - 481, 546 - x) + 1);
    for (let d = 0; d < depth; d++) g.set(x, rim + d, d < 2 ? T.AIR : T.AIR);
  }
  g.replace(481, rim, 66, 14, T.DIRT, T.MUD, 0.4);
  for (let x = 481; x <= 546; x++) {
    const depth = Math.min(11, Math.min(x - 481, 546 - x) + 1);
    for (let d = 0; d < depth; d++) g.set(x, rim + d, T.WATER);
  }
  // outlet channel to the field
  g.rect(470, rim, 12, 2, T.AIR);
  g.rect(470, rim + 2, 12, 1, T.MUD);
  g.rect(481, rim - 1, 3, 3, T.AIR);
  g.rect(481, rim, 3, 2, T.WATER);
  // spring in a stone outcrop on the slope, with a channel down to the pond
  g.bricks(552, 164, 12, 22, T.STONE, 4, 2);
  g.set(553, 170, T.SPRING);
  g.set(553, 171, T.SPRING);
  g.set(553, 172, T.SPRING);
  g.rect(546, 172, 7, 12, T.AIR);
  g.terrain(546, 552, 200, (x) => 176 + (x - 546) * 1.2, T.DIRT);
  g.replace(546, 172, 7, 22, T.DIRT, T.MUD, 0.5);
  // reeds and a little dock
  for (const x of [484, 488, 492, 538, 541, 544]) g.rect(x, rim - 6 - Math.floor(g.rand() * 3), 1, 7, T.GRASS);
  g.rect(498, rim - 2, 20, 2, T.WOOD);
  for (const x of [500, 508, 516]) g.rect(x, rim, 2, 6, T.WOOD);
}

/** Bare hill with a stone fire ring: logs, embers, a tripod pot and a torch to keep it going; a flare stack beside it. */
function campfire(g: Grid): void {
  const base = 162;
  g.bricks(594, base - 3, 18, 5, T.STONE, 3, 2);
  g.air(597, base - 3, 12, 3);
  g.rect(601, base - 1, 2, 1, T.TORCH);
  g.rect(598, base - 5, 10, 3, T.WOOD);
  g.rect(599, base - 8, 8, 3, T.WOOD);
  g.rect(601, base - 11, 8, 3, T.WOOD);
  g.rect(598, base - 2, 3, 2, T.WOOD);
  for (let i = 0; i < 6; i++) g.set(598 + Math.floor(g.rand() * 10), base - 3, T.EMBER, { age: Math.floor(g.rand() * 100) });
  g.scatter(597, base - 2, 12, 2, T.ASH, 0.5, T.AIR);
  // tripod pot
  g.line(588, base - 3, 603, base - 32, T.WOOD, 1);
  g.line(620, base - 3, 605, base - 32, T.WOOD, 1);
  g.vessel(598, base - 28, 12, 9, 1, T.STEEL, T.WATER, 5);
  g.rect(604, base - 32, 1, 4, T.STEEL);
  for (let i = 0; i < 10; i++) g.setIfAir(598 + Math.floor(g.rand() * 10), base - 16 - Math.floor(g.rand() * 8), T.FLAME);
  for (let i = 0; i < 12; i++) g.setIfAir(596 + Math.floor(g.rand() * 14), base - 28 - Math.floor(g.rand() * 14), T.SMOKE);
  for (let i = 0; i < 4; i++) g.setIfAir(600 + Math.floor(g.rand() * 8), base - 22 - Math.floor(g.rand() * 6), T.SPARK);
  // seat logs, a bucket
  g.rect(578, base - 3, 10, 3, T.WOOD);
  g.vessel(572, base - 8, 6, 8, 1, T.STEEL, T.WATER, 5);
  // half-buried gear on the slope
  g.gear(562, base + 8, 14, 12, T.STEEL, 6);
  for (let a = 0; a < 6; a += 1) g.set(562 + Math.round(Math.cos(a) * 14), base + 8 + Math.round(Math.sin(a) * 14), T.COOLING_STEEL, { age: 40 * a });
  // flare stack over the bunker vent
  g.rect(616, base - 16, 7, 17, T.STEEL);
  g.rect(618, base - 16, 3, 17, T.AIR);
  g.rect(614, base - 17, 2, 1, T.TORCH);
  g.rect(623, base - 17, 2, 1, T.TORCH);
}

/** Room-local drawing: (0, 0) is the room's top-left interior cell. */
export interface Room {
  w: number;
  h: number;
  /** Extra rows above the room that the test grid should include (a shaft). */
  pad?: number;
  draw: (g: Grid) => void;
}

/** Boiler hall: a spring-fed pan over torches boils water; steam rises up the silo shaft. */
function boilerHall(g: Grid): void {
  const floor = 137;
  // steam pipe through the hall, shaft through the rock above
  g.rect(85, 0, 10, 82, T.STEEL);
  // furnace plinth, firebox and torches
  g.bricks(74, floor - 25, 32, 26, T.STONE, 8, 3);
  g.air(78, floor - 29, 25, 17);
  for (const x of [80, 87, 94]) g.rect(x, floor - 12, 3, 1, T.TORCH);
  // pan: steel plate with water on top, spillway on the left
  g.rect(74, 104, 32, 4, T.STEEL);
  g.rect(74, 101, 4, 4, T.STEEL);
  for (let i = 0; i < 24; i++) g.set(80 + Math.floor(g.rand() * 22), 104 + Math.floor(g.rand() * 3), T.HOT_STEEL, { age: Math.floor(g.rand() * 60) });
  g.rect(103, 94, 3, 14, T.STEEL);
  g.rect(78, 101, 25, 3, T.WATER);
  // hood and feed pipe
  g.poly([[72, 95], [107, 95], [95, 80], [84, 80]], T.STEEL);
  g.poly([[76, 94], [103, 94], [93, 82], [86, 82]], T.AIR);
  g.rect(85, 76, 10, 6, T.STEEL);
  g.rect(87, -42, 6, 124, T.AIR);
  g.rect(79, 2, 5, 3, T.STEEL);
  g.pipe([[81, 5], [81, 98]], 3, 1, T.STEEL);
  g.rect(80, 4, 3, 1, T.SPRING);
  // sump basin for the spillway
  g.vessel(46, 106, 28, floor - 105, 2, T.STONE, T.WATER, 4);
  // flywheel with a crank, a coal bunker, chains from the vault
  g.gear(22, 92, 24, 18, T.STEEL, 8);
  g.gear(22, 92, 8, 8, T.STEEL, 4);
  g.line(22, 92, 40, 118, T.STEEL, 2);
  g.rect(36, 112, 18, 3, T.STEEL);
  g.rect(36, 112, 3, 25, T.STEEL);
  g.poly([[2, floor], [30, floor], [24, floor - 14], [8, floor - 14]], T.CHARCOAL);
  g.bricks(0, floor - 16, 36, 3, T.STONE, 6, 3);
  for (const x of [10, 24, 54, 66]) {
    for (let y = 0; y < 20; y += 3) g.rect(x, y, 1, 2, T.STEEL);
  }
  g.scatter(0, 0, 70, 6, T.MOLD, 0.05, T.AIR);
  g.scatter(40, floor - 3, 30, 3, T.RUBBLE, 0.2, T.AIR);
  for (let i = 0; i < 80; i++) g.setIfAir(87 + Math.floor(g.rand() * 6), -Math.floor(g.rand() * 44), T.STEAM);
}

/** Ice house with hay between the blocks, jars on shelves, roots from the orchard, and a rotting crate gallery. */
function cellar(g: Grid): void {
  const floor = 132;
  // ice house: blocks stacked with straw
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) g.rect(6 + c * 11, floor - 8 - r * 10, 10, 8, T.ICE);
    g.rect(6, floor - 10 - r * 10, 54, 2, T.GRASS);
  }
  g.rect(4, floor - 41, 2, 42, T.WOOD);
  g.rect(60, floor - 41, 2, 42, T.WOOD);
  g.rect(4, floor - 43, 58, 3, T.WOOD);
  // shelves of jars above the ice
  g.rect(8, 56, 44, 2, T.WOOD);
  g.rect(8, 40, 44, 2, T.WOOD);
  g.rect(10, 42, 2, 14, T.WOOD);
  g.rect(48, 42, 2, 14, T.WOOD);
  for (let i = 0; i < 6; i++) {
    g.vessel(12 + i * 7, 48, 5, 8, 1, T.ICE, [T.WATER, T.MUD, T.SAND, T.WATER, T.MUD, T.ASH][i], 5);
    g.vessel(12 + i * 7, 32, 5, 8, 1, T.ICE, [T.SAND, T.WATER, T.ASH, T.MUD, T.WATER, T.SAND][i], 4);
  }
  // wine rack of glass bottles and a pair of barrels
  g.rect(72, 30, 26, 1, T.WOOD);
  g.rect(72, 52, 26, 1, T.WOOD);
  for (let x = 72; x <= 96; x += 6) g.rect(x, 30, 1, 23, T.WOOD);
  for (let y = 36; y <= 46; y += 8) g.rect(72, y, 26, 1, T.WOOD);
  for (let y = 31; y <= 45; y += 8) for (let x = 73; x < 96; x += 6) g.rect(x, y + 3, 4, 3, T.ICE);
  g.vessel(104, floor - 34, 14, 13, 2, T.WOOD, T.WATER, 6);
  // cellar stairs
  for (let i = 0; i < 14; i++) g.rect(70 + i * 2, 90 + i * 3, 30 - i * 2, 3, T.STONE);
  // roots from the orchard
  for (const x of [20, 34, 48, 58]) {
    let rx = x;
    for (let y = 0; y < 8 + Math.floor(g.rand() * 10); y++) {
      if (g.rand() < 0.3) rx += g.rand() < 0.5 ? -1 : 1;
      g.set(rx, y, T.WOOD);
    }
  }
  // mold gallery: crates and a barrel rotting under the vault
  g.rect(100, floor - 12, 12, 12, T.WOOD);
  g.rect(112, floor - 12, 12, 12, T.WOOD);
  g.rect(104, floor - 24, 12, 12, T.WOOD);
  g.scatter(100, floor - 25, 25, 26, T.MOLD, 0.2, T.WOOD);
  g.rect(100, floor - 13, 24, 1, T.MOLD);
  g.scatter(88, floor - 3, 40, 3, T.DIRT, 0.3, T.AIR);
  for (let i = 0; i < 20; i++) g.setIfAir(96 + Math.floor(g.rand() * 28), Math.floor(g.rand() * 8), T.METHANE);
}

/** Flooded cistern: pillars in deep water, a spring gargoyle, the field drain and the well drop in. */
function cistern(g: Grid): void {
  const floor = 92;
  g.rect(0, 30, 102, floor - 29, T.WATER);
  for (const x of [18, 36, 74, 90]) g.bricks(x, 0, 6, floor + 1, T.STONE, 6, 3);
  for (const x of [18, 36, 74, 90]) g.rect(x, 30, 6, floor - 29, T.STONE);
  g.rect(6, 0, 4, 4, T.STONE);
  // arches of the vault
  for (let i = 0; i < 3; i++) {
    const cx = [27, 55, 82][i];
    g.ring(cx, 0, 13, 3, T.STONE);
  }
  // gargoyle spout on a ledge and its waterfall
  g.bricks(92, 6, 10, 6, T.STONE, 5, 3);
  g.set(91, 9, T.SPRING);
  g.set(91, 8, T.SPRING);
  g.set(91, 10, T.SPRING);
  g.rect(92, 6, 1, 2, T.AIR);
  // treasure chest and an anchor on the bed
  g.rect(40, floor - 6, 12, 6, T.WOOD);
  g.rect(40, floor - 4, 12, 1, T.STEEL);
  g.rect(45, floor - 8, 2, 2, T.STEEL);
  g.line(60, floor - 14, 60, floor, T.STEEL, 1);
  g.line(55, floor - 12, 65, floor - 12, T.STEEL, 1);
  g.line(55, floor - 2, 60, floor, T.STEEL, 1);
  g.line(65, floor - 2, 60, floor, T.STEEL, 1);
  g.scatter(24, floor - 2, 12, 3, T.ASH, 0.6, T.WATER);
  // moss on the pillars above the water
  g.scatter(18, 20, 6, 10, T.MOLD, 0.3, T.STONE);
  g.scatter(74, 20, 6, 10, T.MOLD, 0.3, T.STONE);
}

/** Machine floor: gears driven by a heat pipe from the boiler, a bomb press line, mold and rubble. */
function machineFloor(g: Grid): void {
  const floor = 127;
  // heat pipe from the boiler pan through the wall, along the floor and up to the gears
  g.rect(-10, 94, 52, 3, T.STEEL);
  g.rect(40, 94, 3, 33, T.STEEL);
  g.rect(40, floor - 2, 36, 3, T.STEEL);
  g.rect(72, floor - 40, 3, 40, T.STEEL);
  // gear train hung off the pipe
  g.gear(22, 70, 16, 12, T.STEEL, 6);
  g.gear(52, 54, 12, 10, T.STEEL, 4);
  g.gear(60, 82, 9, 8, T.STEEL, 4);
  g.rect(22, 70, 1, 24, T.STEEL);
  g.rect(52, 54, 1, 3, T.STEEL);
  // bomb press line on a stone conveyor, well away from the steel
  g.rect(4, floor - 14, 36, 3, T.STONE);
  for (let i = 0; i < 4; i++) g.rect(6 + i * 9, floor - 18, 5, 4, T.BOMB);
  g.rect(4, floor - 11, 3, 12, T.STONE);
  g.rect(37, floor - 11, 3, 12, T.STONE);
  // mold-eaten catwalk, rubble and ash
  g.rect(46, 34, 28, 2, T.WOOD);
  g.rect(46, 36, 2, 20, T.WOOD);
  g.scatter(46, 30, 28, 6, T.MOLD, 0.2, T.WOOD);
  g.poly([[0, floor], [18, floor], [12, floor - 8], [4, floor - 12], [0, floor - 12]], T.RUBBLE);
  g.poly([[50, floor - 4], [70, floor - 4], [66, floor - 10], [54, floor - 10]], T.RUBBLE);
  g.scatter(0, floor - 1, 76, 2, T.ASH, 0.2, T.AIR);
  for (let i = 0; i < 14; i++) g.setIfAir(8 + Math.floor(g.rand() * 56), Math.floor(g.rand() * 6), T.METHANE);
}

/** Acid vat in a stone tank slowly eating its own wall, a mud gutter, a steel catwalk and a ladder. */
function vatRoom(g: Grid): void {
  const floor = 112;
  g.vessel(6, 50, 46, floor - 49, 5, T.STONE, T.ACID, 34);
  g.rect(14, 28, 30, 2, T.STEEL);
  g.rect(14, 28, 2, 24, T.STEEL);
  g.rect(42, 28, 2, 24, T.STEEL);
  g.line(29, 30, 29, 66, T.STEEL, 1);
  g.line(26, 66, 32, 66, T.STEEL, 1);
  // ice gauge window in the tank wall
  g.rect(48, 80, 5, 14, T.ICE);
  // wooden ladder into the acid
  g.line(36, 52, 40, 92, T.WOOD, 1);
  g.line(39, 52, 43, 92, T.WOOD, 1);
  for (let y = 56; y < 92; y += 5) g.rect(36 + Math.floor((y - 52) / 10), y, 7, 1, T.WOOD);
  // mud gutter along the floor
  g.rect(54, floor - 5, 16, 6, T.MUD);
  g.rect(54, floor - 7, 16, 2, T.DIRT);
  g.rect(60, 70, 8, 1, T.STONE);
  g.rect(62, 58, 6, 12, T.STONE);
  // warning skull on a pole
  g.rect(60, 36, 1, 22, T.STEEL);
  g.stamp(56, 26, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
  ], { '#': T.ICE });
  g.set(58, 29, T.AIR);
  g.set(62, 29, T.AIR);
  // chain hoist and steel drums
  g.rect(14, 8, 1, 20, T.STEEL);
  g.rect(8, 8, 36, 2, T.STEEL);
  g.vessel(4, floor - 14, 9, 14, 1, T.STEEL, T.MUD, 8);
  g.rect(52, 40, 14, 1, T.STEEL);
  for (let i = 0; i < 6; i++) g.set(54 + i * 2, 41 + (i % 2), T.STEEL);
  // crates
  g.rect(58, floor - 18, 10, 10, T.WOOD);
  g.scatter(58, floor - 19, 10, 12, T.MOLD, 0.2, T.WOOD);
  g.scatter(0, floor - 1, 6, 2, T.RUBBLE, 0.5, T.AIR);
}

/** Munitions bunker: bomb stacks behind sandbags, rotting crates breathing methane up a vent. */
function bunker(g: Grid): void {
  const floor = 97;
  // bomb stacks
  for (let r = 0; r < 3; r++) {
    g.rect(14, floor - 8 - r * 6, 26, 5, T.BOMB);
  }
  g.rect(14, floor - 2, 26, 3, T.WOOD);
  // steel braces and hazard stripes
  g.rect(12, floor - 30, 30, 2, T.STEEL);
  g.rect(12, floor - 30, 2, 30, T.STEEL);
  g.rect(40, floor - 30, 2, 30, T.STEEL);
  for (let i = 0; i < 6; i++) g.rect(14 + i * 5, floor - 33, 3, 3, i % 2 === 0 ? T.BOMB : T.ICE);
  g.stamp(20, floor - 52, [
    '..#####..',
    '.#######.',
    '#########',
    '#.##.##.#',
    '#.##.##.#',
    '.#######.',
    '..#.#.#..',
  ], { '#': T.ICE });
  // sandbags
  g.poly([[0, floor], [12, floor], [10, floor - 6], [2, floor - 12], [0, floor - 12]], T.SAND);
  g.poly([[44, floor], [58, floor], [54, floor - 8], [48, floor - 8]], T.WET_SAND);
  // rotting crates under the vent
  g.rect(46, floor - 24, 12, 12, T.WOOD);
  g.rect(46, floor - 12, 12, 12, T.WOOD);
  g.scatter(46, floor - 25, 12, 26, T.MOLD, 0.3, T.WOOD);
  // vent up to the flare stack
  g.rect(48, -100, 3, 100, T.AIR);
  for (let i = 0; i < 24; i++) g.setIfAir(30 + Math.floor(g.rand() * 24), Math.floor(g.rand() * 10), T.METHANE);
  for (let i = 0; i < 30; i++) g.setIfAir(48 + Math.floor(g.rand() * 3), -Math.floor(g.rand() * 100), T.METHANE);
}

export const ROOMS: Record<string, Room> = {
  boilerHall: { w: 106, h: 138, pad: 44, draw: boilerHall },
  cellar: { w: 126, h: 133, draw: cellar },
  cistern: { w: 102, h: 93, draw: cistern },
  machineFloor: { w: 76, h: 128, draw: machineFloor },
  vatRoom: { w: 70, h: 113, draw: vatRoom },
  bunker: { w: 64, h: 98, pad: 100, draw: bunker },
};

const CHAMBERS = POCKETS.map((p, i) => ({
  ...p,
  draw: [cellar, boilerHall, machineFloor, cistern, vatRoom, bunker][i],
}));
