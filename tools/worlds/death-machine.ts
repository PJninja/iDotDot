import { Grid, T } from '../world-kit.ts';

const GROUND = 322;
/** Middle row of the fuse: a steel bar the furnace torches heat; the heat wave runs along it to the gas reservoir. */
const FUSE_Y = 298;
const SKULL_X = 330;

/** Points of an ellipse outline, for brick-patterned polygons. */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n = 72): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return [cx + Math.cos(a) * (rx + 0.5), cy + Math.sin(a) * (ry + 0.5)] as [number, number];
  });
}

/** Coal heap, a guard tower with a searchlight torch, and the conveyor up to the furnace. */
function fuelYard(g: Grid): void {
  g.poly([[22, GROUND], [64, GROUND], [58, GROUND - 14], [46, GROUND - 22], [38, GROUND - 22], [28, GROUND - 14]], T.CHARCOAL);
  g.bricks(6, GROUND - 40, 10, 40, T.STONE, 5, 3);
  g.rect(4, GROUND - 44, 14, 4, T.STEEL);
  g.rect(8, GROUND - 46, 2, 2, T.TORCH);
  g.rect(12, GROUND - 46, 2, 2, T.TORCH);
  // one stubborn weed in the dirt, rotting crates, ash from the furnace
  g.rect(19, GROUND - 3, 8, 3, T.DIRT);
  g.rect(21, GROUND - 6, 1, 3, T.GRASS);
  g.rect(24, GROUND - 5, 1, 2, T.GRASS);
  g.rect(66, GROUND - 10, 10, 10, T.WOOD);
  g.rect(66, GROUND - 20, 10, 10, T.WOOD);
  g.scatter(66, GROUND - 21, 10, 22, T.MOLD, 0.25, T.WOOD);
  g.rect(78, GROUND - 3, 2, 3, T.ASH);
  // conveyor: a slanted steel track on stilts up to the furnace's feed port
  g.line(54, GROUND - 14, 86, GROUND - 58, T.STEEL, 2);
  for (let x = 60; x < 86; x += 9) {
    const top = GROUND - 14 - Math.round(((x - 54) * 44) / 32);
    g.rect(x, top, 2, GROUND - top, T.STEEL);
  }
}

/** Furnace house: torches under the fuse bar, a smokestack, and the feed port. */
function furnaceHouse(g: Grid): void {
  const left = 84;
  const right = 172;
  g.bricks(left, 252, right - left, GROUND - 252, T.STONE, 8, 4);
  g.air(left + 6, 262, right - left - 12, 46);
  // feed port for the conveyor
  g.air(left, 254, 8, 6);
  // plinth with five torch pairs
  g.bricks(left + 6, 308, right - left - 12, GROUND - 308, T.STONE, 8, 3);
  for (let k = 0; k < 5; k++) g.rect(left + 12 + k * 14, 307, 3, 1, T.TORCH);
  for (let k = 0; k < 5; k++) for (let i = 0; i < 3; i++) g.set(left + 12 + k * 14 + i - 1 + (k % 2), 306, T.EMBER, { age: Math.floor(g.rand() * 120) });
  g.scatter(left + 8, 304, 80, 3, T.ASH, 0.1, T.AIR);
  // the fuse bar starts in the flames and leaves through the right wall
  g.rect(left + 6, FUSE_Y - 1, 120, 3, T.STEEL);
  g.rect(left + 6, FUSE_Y - 5, 2, 4, T.STEEL);
  // hot from the first frame
  for (let x = left + 10; x < left + 50; x++) for (let y = FUSE_Y - 1; y <= FUSE_Y + 1; y++) if (g.rand() < 0.7) g.set(x, y, T.HOT_STEEL, { age: Math.floor(g.rand() * 100) });
  // smokestack with a torch at the foot of its bore
  g.bricks(118, 120, 22, 140, T.STONE, 8, 4);
  g.air(124, 118, 10, 144);
  g.rect(116, 116, 26, 3, T.STEEL);
  g.rect(126, 261, 6, 1, T.TORCH);
  for (let y = 140; y < 250; y += 24) g.rect(116, y, 26, 2, T.STEEL);
  // pipes and a gauge on the back of the hall
  g.rect(left + 8, 270, 40, 2, T.STEEL);
  g.ring(left + 60, 276, 6, 2, T.STEEL);
  g.line(left + 60, 276, left + 64, 273, T.STEEL, 1);
  for (let i = 0; i < 12; i++) g.set(left + 12 + Math.floor(g.rand() * 70), 266 + Math.floor(g.rand() * 14), T.SMOKE);
  for (let i = 0; i < 6; i++) g.set(left + 18 + Math.floor(g.rand() * 60), 280 + Math.floor(g.rand() * 14), T.FLAME);
  for (let i = 0; i < 5; i++) g.set(left + 20 + Math.floor(g.rand() * 50), 272 + Math.floor(g.rand() * 8), T.SPARK);
}

/** Boiler: a steel tank resting on the fuse bar, water on its floor, vents on top. */
function boiler(g: Grid): void {
  const x = 178;
  const w = 60;
  g.rect(x, 262, w, 35, T.STEEL);
  g.rect(x + 3, 265, w - 6, 29, T.AIR);
  g.rect(x + 3, 289, w - 6, 5, T.WATER);
  for (const vx of [186, 204, 222]) {
    g.rect(vx, 252, 4, 11, T.STEEL);
    g.rect(vx + 1, 252, 2, 12, T.AIR);
    g.rect(vx - 1, 250, 6, 2, T.STEEL);
  }
  for (let i = 0; i < 60; i++) g.setIfAir(x + 4 + Math.floor(g.rand() * (w - 8)), 266 + Math.floor(g.rand() * 22), T.STEAM);
  // pressure dial
  g.ring(x + 30, 278, 7, 2, T.STEEL);
  g.line(x + 30, 278, x + 33, 274, T.STEEL, 1);
  // legs and the fuse bar beneath
  g.bricks(x + 4, 297, 6, 25, T.STONE, 6, 3);
  g.bricks(x + w - 10, 297, 6, 25, T.STONE, 6, 3);
  g.rect(172, FUSE_Y - 1, 52, 3, T.STEEL);
  // spring-fed water barrel and wet sandbags beside the tank
  g.vessel(242, 306, 14, 16, 2, T.STEEL, T.WATER, 8);
  g.rect(247, 302, 5, 1, T.STEEL);
  g.set(249, 303, T.SPRING);
  g.poly([[258, GROUND], [276, GROUND], [276, GROUND - 5], [270, GROUND - 9], [262, GROUND - 7]], T.WET_SAND);
}

/** A wooden hopper of sand over the thin end of the fuse: when its legs burn, the sand comes down. */
function hopper(g: Grid): void {
  g.rect(224, FUSE_Y - 1, 60, 3, T.AIR);
  g.rect(224, FUSE_Y, 60, 1, T.STEEL);
  g.rect(246, 270, 26, 3, T.WOOD);
  g.rect(246, 252, 3, 20, T.WOOD);
  g.rect(269, 252, 3, 20, T.WOOD);
  g.rect(246, 273, 3, 25, T.WOOD);
  g.rect(269, 273, 3, 25, T.WOOD);
  g.rect(249, 256, 20, 14, T.SAND);
}

/** The tower: gas reservoir at the foot, a stone spine of methane up to the skull, gears in the neck. */
function skullTower(g: Grid): void {
  const cx = SKULL_X;
  // body: tapered tower
  g.brickPoly([[276, GROUND], [384, GROUND], [384, 292], [356, 210], [352, 196], [308, 196], [304, 210], [276, 292]], T.STONE, 8, 4);
  // gas reservoir at the base
  g.air(284, 292, 84, 24);
  // neck cavities with gears either side of the spine
  g.air(311, 208, 14, 74);
  g.air(335, 208, 14, 74);
  g.air(292, 262, 26, 24);
  g.air(342, 262, 26, 24);
  g.gear(318, 234, 8, 8, T.STEEL, 4);
  g.gear(342, 252, 10, 10, T.STEEL, 4);
  g.gear(300, 274, 8, 8, T.STEEL, 4);
  g.gear(360, 274, 8, 8, T.STEEL, 4);
  g.rect(318, 242, 1, 20, T.STEEL);
  for (const [rx, ry] of [[342, 242], [336, 252], [348, 262], [300, 266], [306, 278], [360, 266]]) g.set(rx, ry, T.COOLING_STEEL, { age: 20 });
  // debris at the foot of the tower
  g.poly([[384, GROUND], [394, GROUND], [391, GROUND - 5], [386, GROUND - 7]], T.RUBBLE);
  g.poly([[266, GROUND], [276, GROUND], [276, GROUND - 6], [270, GROUND - 4]], T.RUBBLE);
  // hazard stripes along the base: bombs and ice
  for (let i = 0; i < 12; i++) g.rect(284 + i * 8, 318, 4, 3, i % 2 === 0 ? T.BOMB : T.ICE);
  // cranium
  g.brickPoly(ellipsePoints(cx, 132, 46, 40), T.STONE, 8, 4);
  g.brickPoly([[298, 164], [362, 164], [356, 198], [304, 198]], T.STONE, 8, 4);
  // brain chamber (methane)
  for (let y = 90; y < 150; y++) for (let x = 290; x < 372; x++) if (Math.hypot((x - cx) / 34, (y - 118) / 20) <= 1) g.set(x, y, T.METHANE);
  // eyes: sockets of glowing torch tiles
  for (const ex of [cx - 20, cx + 20]) {
    g.ellipse(ex, 152, 12, 10, T.STONE);
    g.ellipse(ex, 152, 10, 8, T.TORCH);
    g.ellipse(ex + (ex < cx ? 3 : -3), 153, 2, 3, T.STONE);
  }
  // angry brows
  g.line(cx - 36, 134, cx - 10, 145, T.STEEL, 3);
  g.line(cx + 36, 134, cx + 10, 145, T.STEEL, 3);
  for (const rx of [292, 300, 360, 368]) g.rect(rx, 160, 2, 2, T.STEEL);
  // nose, mouth and teeth
  g.poly([[cx - 3, 158], [cx + 3, 158], [cx, 167]], T.AIR);
  g.air(306, 174, 48, 16);
  for (let i = 0; i < 7; i++) {
    const tx = 308 + i * 7;
    if (Math.abs(tx + 2 - cx) < 8) continue;
    g.rect(tx, 174, 5, 7, T.BOMB);
    g.rect(tx + 3, 183, 5, 7, T.BOMB);
  }
  // methane spine: a stone pipe from the reservoir up into the chamber
  g.rect(cx - 4, 138, 9, 154, T.STONE);
  g.rect(cx - 1, 138, 3, 154, T.METHANE);
  // exhaust horns with torches in their bores
  for (const hx of [cx - 36, cx + 28]) {
    g.bricks(hx, 70, 8, 26, T.STONE, 4, 3);
    g.air(hx + 3, 68, 2, 24);
    g.rect(hx + 3, 90, 2, 1, T.TORCH);
  }
  // reservoir fill, with the fuse tip inside
  for (let y = 292; y < 316; y++) for (let x = 284; x < 368; x++) g.setIfAir(x, y, T.METHANE);
  g.rect(280, FUSE_Y, 10, 1, T.STEEL);
  g.rect(279, FUSE_Y, 1, 1, T.STEEL);
}

/** Steel lattice tower holding two tanks of acid in glass (ice), over a mud neutralizing bed. */
function acidTower(g: Grid): void {
  const x0 = 394;
  const x1 = 440;
  g.rect(x0, 204, 4, GROUND - 204, T.STEEL);
  g.rect(x1 - 3, 204, 4, GROUND - 204, T.STEEL);
  g.line(x0 + 2, GROUND - 4, x1 - 1, 292, T.STEEL, 1);
  g.line(x1 - 1, GROUND - 4, x0 + 2, 292, T.STEEL, 1);
  g.line(x0 + 2, 292, x1 - 1, 236, T.STEEL, 1);
  g.line(x1 - 1, 292, x0 + 2, 236, T.STEEL, 1);
  g.rect(x0 - 2, 232, x1 - x0 + 6, 3, T.STEEL);
  g.rect(x0 - 2, 284, x1 - x0 + 6, 3, T.STEEL);
  g.vessel(x0 + 4, 200, 26, 32, 2, T.ICE, T.ACID, 22);
  g.vessel(x0 + 16, 250, 24, 34, 2, T.ICE, T.ACID, 24);
  // beacon mast
  g.rect(x0 + 21, 190, 2, 12, T.STEEL);
  g.rect(x0 + 20, 188, 4, 2, T.TORCH);
  // mud bed under the tank
  g.vessel(x0, 306, 48, 16, 2, T.STONE, T.MUD, 9);
  g.rect(x0 + 4, 304, 40, 1, T.STEEL);
}

/** Steel warehouse of bomb stacks with a crane, under a second smokestack. */
function depot(g: Grid): void {
  const x0 = 452;
  const x1 = 560;
  g.rect(x0, 262, 4, GROUND - 262, T.STEEL);
  g.rect(x1 - 4, 262, 4, GROUND - 262, T.STEEL);
  g.poly([[x0 - 4, 262], [504, 240], [x1 + 4, 262]], T.STEEL);
  g.poly([[x0 + 2, 262], [504, 244], [x1 - 2, 262]], T.AIR);
  g.rect(494, 236, 20, 8, T.STONE);
  // stacks of bomb crates on pallets
  const stacks: [number, number, number][] = [[462, 26, 5], [494, 22, 4], [524, 28, 6]];
  for (const [sx, w, rows] of stacks) {
    g.rect(sx, GROUND - 2, w, 2, T.WOOD);
    for (let r = 0; r < rows; r++) g.rect(sx + Math.floor(r / 2), GROUND - 7 - r * 5, w - Math.floor(r / 2) * 2, 4, T.BOMB);
  }
  // overhead crane and a hanging crate
  g.rect(x0 + 4, 270, x1 - x0 - 8, 2, T.STEEL);
  g.rect(484, 268, 8, 4, T.STEEL);
  g.line(488, 272, 488, 290, T.STEEL, 1);
  g.rect(484, 290, 9, 5, T.BOMB);
  // smokestack with a torch at the foot of its bore
  g.bricks(500, 148, 18, 90, T.STONE, 8, 4);
  g.air(505, 146, 8, 90);
  g.rect(498, 144, 22, 3, T.STEEL);
  g.rect(507, 235, 4, 1, T.TORCH);
  for (let y = 164; y < 230; y += 22) g.rect(498, y, 22, 2, T.STEEL);
}

/** Right-hand yard: an acid moat, a spiked fence, a leaking drum and a second guard tower. */
function rightYard(g: Grid): void {
  g.rect(572, GROUND, 40, 14, T.AIR);
  g.rect(572, GROUND + 6, 40, 8, T.ACID);
  g.rect(572, GROUND + 2, 40, 4, T.ACID);
  g.replace(570, GROUND - 1, 44, 18, T.STONE, T.MUD, 0.0);
  g.rect(568, GROUND, 4, 3, T.MUD);
  g.rect(612, GROUND, 4, 3, T.MUD);
  // spiked fence
  for (let x = 566; x < 640; x += 6) {
    g.rect(x, GROUND - 16, 2, 16, T.STEEL);
    g.set(x, GROUND - 18, T.STEEL);
    g.set(x + 1, GROUND - 17, T.STEEL);
  }
  g.rect(566, GROUND - 12, 74, 1, T.STEEL);
  // drums by the moat
  g.vessel(618, GROUND - 12, 9, 12, 1, T.STEEL, T.ACID, 8);
  g.vessel(628, GROUND - 12, 9, 12, 1, T.STEEL, T.ACID, 8);
  g.set(618, GROUND - 3, T.AIR);
  // guard tower with a searchlight torch
  g.bricks(622, GROUND - 52, 14, 40, T.STONE, 6, 3);
  g.rect(618, GROUND - 56, 22, 4, T.STEEL);
  g.rect(624, GROUND - 58, 2, 2, T.TORCH);
  g.rect(632, GROUND - 58, 2, 2, T.TORCH);
  // skull flag
  g.rect(586, GROUND - 40, 2, 40, T.STEEL);
  g.rect(588, GROUND - 40, 14, 10, T.STEEL);
  g.rect(591, GROUND - 38, 8, 6, T.ICE);
  g.set(593, GROUND - 36, T.STEEL);
  g.set(596, GROUND - 36, T.STEEL);
}

export function buildDeathMachine(): Grid {
  const g = new Grid(666);
  g.bricks(0, GROUND, 640, 348 - GROUND, T.STONE, 12, 4);
  fuelYard(g);
  furnaceHouse(g);
  boiler(g);
  hopper(g);
  skullTower(g);
  acidTower(g);
  depot(g);
  rightYard(g);
  for (let i = 0; i < 70; i++) g.set(Math.floor(g.rand() * 640), 3 + Math.floor(g.rand() * 110), T.ICE);
  if (process.env.DM_IGNITE) g.rect(281, FUSE_Y - 1, 8, 3, T.HOT_STEEL);
  return g;
}
