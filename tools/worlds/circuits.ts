import { Grid, T } from '../world-kit.ts';
import {
  BLOCK,
  COMPACT,
  KEEP_OUT_CELLS,
  NARROW,
  WIDE,
  corridor,
  footprint,
  type CellRect,
} from '../../src/worlds/board-slots.ts';

/**
 * One electric circuit of a world, declared by its scene. `checkCircuits` proves the circuit
 * powers what it says and nothing else: the build fails when a pulse can leak into another
 * structure, reach the board, or light something the scene did not list.
 */
export interface Circuit {
  name: string;
  /** Box holding this circuit's generators; every generator in the world belongs to exactly one circuit. */
  sources: CellRect;
  /** Boxes that contain every cell a pulse can reach; one box per part of the circuit. */
  bounds: CellRect[];
  /** Things the circuit must power: some cell of `at` has to be reached. */
  loads: { name: string; at: CellRect }[];
  /** Boxes where a powered cell may deliberately ignite wood, grass, charcoal, bombs or methane. */
  ignites?: CellRect[];
}

const STEEL_FAMILY = new Set<number>([T.STEEL, T.LIVE_STEEL, T.SPENT_STEEL, T.HOT_STEEL, T.COOLING_STEEL]);
const COPPER_FAMILY = new Set<number>([T.COPPER, T.LIVE_COPPER, T.SPENT_COPPER]);
const WATER_FAMILY = new Set<number>([T.WATER, T.SHOCKED_WATER, T.NUMB_WATER]);
const FUSE_FAMILY = new Set<number>([T.FUSE, T.LIVE_FUSE]);
/** What a pulse can pass through when two of these touch (8 neighbors). */
const CONDUCTORS = new Set<number>([...STEEL_FAMILY, ...COPPER_FAMILY, ...WATER_FAMILY, ...FUSE_FAMILY]);
/** What an arc starts a pulse in (fuses have no arc rule). */
const ARC_RECEPTIVE = new Set<number>([...STEEL_FAMILY, ...COPPER_FAMILY, ...WATER_FAMILY]);
/** Live steel and generators throw arcs into empty cells beside them; copper never does. */
const isEmitter = (t: number): boolean => STEEL_FAMILY.has(t) || t === T.GENERATOR;
/** Live steel and live copper light these on contact, and arcs light them too. */
const FLAMMABLE = new Set<number>([T.WOOD, T.GRASS, T.CHARCOAL, T.BOMB, T.METHANE]);
const EXPLOSIVE = new Set<number>([T.BOMB, T.METHANE]);

/**
 * Cells from a blast the board must stay clear of: Explosion.REACH / Explosion.HOP_COST
 * (100 / 10 = 10) plus a margin. Hardcoded because the element classes are not loadable here.
 */
const BLAST_CLEARANCE = 12;
/** Chebyshev reach of a blast between bombs: Explosion.REACH / Explosion.HOP_COST. */
const BLAST_REACH = 10;
/** Cells past a ring that a pulse must never reach: arc range (2) plus the keep-out ring. */
const BOARD_MARGIN = KEEP_OUT_CELLS + 1;

const NEIGHBORS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

const grow = (r: CellRect, n: number): CellRect => ({ x: r.x - n, y: r.y - n, w: r.w + 2 * n, h: r.h + 2 * n });
const inside = (r: CellRect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const key = (x: number, y: number): number => y * 4096 + x;
const unkey = (k: number): [number, number] => [k % 4096, Math.floor(k / 4096)];

/** Chebyshev distance from a cell to a rectangle (0 inside). */
function distanceTo(r: CellRect, x: number, y: number): number {
  return Math.max(r.x - x, x - (r.x + r.w - 1), r.y - y, y - (r.y + r.h - 1), 0);
}

/** Every area the board uses in any layout, grown by the margin: the hall (block plus its brick wall), the gallery corridor and each chip ring. */
function boardZones(): CellRect[] {
  const zones: CellRect[] = [grow(BLOCK, 6), grow(corridor(WIDE.gallery), 3)];
  for (const geometry of [WIDE, NARROW, COMPACT]) {
    for (const slot of geometry.slots) zones.push(grow(footprint(slot), BOARD_MARGIN));
  }
  return zones;
}

/** Cells of a tile type within one cell of (x, y), excluding it. */
function around(g: Grid, x: number, y: number, match: (t: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dy] of NEIGHBORS) if (match(g.typeAt(x + dx, y + dy))) out.push([x + dx, y + dy]);
  return out;
}

/** Cells an arc thrown from (x, y) can touch: anything within one cell of an empty cell beside it. */
function arcLandings(g: Grid, x: number, y: number, match: (t: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (const [ax, ay] of around(g, x, y, (t) => t === T.AIR)) {
    for (const cell of around(g, ax, ay, match)) if (cell[0] !== x || cell[1] !== y) out.push(cell);
  }
  return out;
}

/** Every cell a pulse can reach from the circuit's generators. */
function reach(g: Grid, starts: [number, number][]): Set<number> {
  const seen = new Set<number>(starts.map(([x, y]) => key(x, y)));
  const stack = [...starts];
  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    const t = g.typeAt(x, y);
    const next: [number, number][] = [];
    if (t === T.GENERATOR) next.push(...around(g, x, y, (n) => STEEL_FAMILY.has(n) || COPPER_FAMILY.has(n)));
    else next.push(...around(g, x, y, (n) => CONDUCTORS.has(n)));
    if (isEmitter(t)) next.push(...arcLandings(g, x, y, (n) => ARC_RECEPTIVE.has(n)));
    for (const [nx, ny] of next) {
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

/** Flammable cells a powered cell lights: by contact for steel and copper, and within arc range for steel and generators. */
function ignitions(g: Grid, powered: Set<number>): Set<number> {
  const hit = new Set<number>();
  for (const k of powered) {
    const [x, y] = unkey(k);
    const t = g.typeAt(x, y);
    if (STEEL_FAMILY.has(t) || COPPER_FAMILY.has(t)) for (const [fx, fy] of around(g, x, y, (n) => FLAMMABLE.has(n))) hit.add(key(fx, fy));
    if (isEmitter(t)) for (const [fx, fy] of arcLandings(g, x, y, (n) => FLAMMABLE.has(n))) hit.add(key(fx, fy));
  }
  return hit;
}

/**
 * Everything a first explosion sets off: a bomb takes every bomb or methane cell within blast
 * reach, and burning methane takes the whole connected gas, which may detonate in turn.
 */
function blastClosure(g: Grid, seeds: Set<number>): Set<number> {
  const burning = new Set<number>();
  const stack: number[] = [];
  const add = (x: number, y: number): void => {
    const k = key(x, y);
    if (burning.has(k) || !EXPLOSIVE.has(g.typeAt(x, y))) return;
    burning.add(k);
    stack.push(k);
  };
  for (const k of seeds) if (EXPLOSIVE.has(g.typeAt(...unkey(k)))) add(...unkey(k));
  while (stack.length > 0) {
    const [x, y] = unkey(stack.pop() as number);
    for (const [dx, dy] of NEIGHBORS) if (g.typeAt(x, y) === T.METHANE && g.typeAt(x + dx, y + dy) === T.METHANE) add(x + dx, y + dy);
    for (let dy = -BLAST_REACH; dy <= BLAST_REACH; dy++) for (let dx = -BLAST_REACH; dx <= BLAST_REACH; dx++) add(x + dx, y + dy);
  }
  return burning;
}

const describe = (g: Grid, k: number): string => {
  const [x, y] = unkey(k);
  return `type ${g.typeAt(x, y)} at (${x}, ${y})`;
};

/**
 * Throws when a circuit does not do exactly what its scene declared (see `Circuit`), when a
 * generator belongs to no circuit, or when any pulse could reach the board. Needs no simulation:
 * it follows the same contact and arc rules the electric elements use. Run after the world is built.
 */
export function checkCircuits(g: Grid, world: string, circuits: Circuit[]): void {
  const problems: string[] = [];
  const generators: [number, number][] = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.typeAt(x, y) === T.GENERATOR) generators.push([x, y]);
  for (const [x, y] of generators) {
    if (circuits.filter((c) => inside(c.sources, x, y)).length !== 1) problems.push(`generator at (${x}, ${y}) is not in exactly one circuit's sources`);
  }
  const zones = boardZones();
  for (const circuit of circuits) {
    const own = generators.filter(([x, y]) => inside(circuit.sources, x, y));
    if (own.length === 0) problems.push(`${circuit.name}: no generator in its sources`);
    const powered = reach(g, own);
    for (const k of powered) {
      const [x, y] = unkey(k);
      if (!circuit.bounds.some((b) => inside(b, x, y))) problems.push(`${circuit.name}: pulse leaks to ${describe(g, k)}`);
      if (zones.some((z) => inside(z, x, y))) problems.push(`${circuit.name}: pulse reaches the board at ${describe(g, k)}`);
    }
    for (const load of circuit.loads) {
      let reached = false;
      for (let y = load.at.y; y < load.at.y + load.at.h && !reached; y++) {
        for (let x = load.at.x; x < load.at.x + load.at.w && !reached; x++) reached = powered.has(key(x, y));
      }
      if (!reached) problems.push(`${circuit.name}: load "${load.name}" is not powered`);
    }
    const lit = ignitions(g, powered);
    const ignites = circuit.ignites ?? [];
    for (const k of lit) {
      const [x, y] = unkey(k);
      if (!ignites.some((r) => inside(r, x, y))) problems.push(`${circuit.name}: ignites ${describe(g, k)}`);
    }
    const blast = blastClosure(g, lit);
    for (const k of blast) {
      const [x, y] = unkey(k);
      if (zones.some((z) => distanceTo(z, x, y) < BLAST_CLEARANCE)) problems.push(`${circuit.name}: a chain explosion reaches ${describe(g, k)}, too close to the board`);
    }
    console.log(`  circuit ${circuit.name}: ${powered.size} powered cells, ${lit.size} ignitable, ${blast.size} in the blast chain`);
  }
  if (problems.length > 0) {
    const shown = problems.slice(0, 12).join('\n  ');
    throw new Error(`${world}: circuit check failed (${problems.length} problems)\n  ${shown}`);
  }
}
