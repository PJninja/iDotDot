import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Explosion (type 12) - the blast itself, hidden from the picker. A static solid that
 * ages like fire (fading blast tiles leave smoke, flames, sparks and rubble): a fresh tile
 * is white-hot and cools through orange to dark red until it vanishes. Its value byte is
 * the reach the blast has spent getting here (0 at an origin). Empty cells and tiles next
 * to a blast tile that can still spread join the blast with a spent reach of that tile
 * plus a hop cost, until the reach runs out (blastSource / blastHit / blastFill in
 * engine/gpu/shaders.ts). The more reach a tile has spent, the older it is born (dimmer,
 * shorter-lived) and the slower the front advances past it, so the blast keeps growing
 * while it weakens and its core burns out behind the front; at the rim it throws sparks
 * outward. Bombs touching it detonate with a fresh age and spent 0, which restarts the
 * blast at full size from there.
 */
export class Explosion extends Element {
  readonly type = SETTINGS.EXPLOSION_TYPE;
  readonly name = 'explosion';
  readonly displayName = 'Explosion';
  readonly defaultColor: [number, number, number] = [255, 190, 70];
  readonly hidden = true;

  /** Age steps per sim step (about 21 steps of life at the origin at 12, less further out). */
  static AGE_RATE = 12;
  /** Reach spent per orthogonal cell the blast spreads. */
  static HOP_COST = 10;
  /** Reach spent per diagonal cell (about 1.4 x HOP_COST, which keeps the blast round). */
  static DIAGONAL_COST = 14;
  /** Reach an origin tile starts with: its radius in air is about REACH / HOP_COST cells (at most 255). */
  static REACH = 200;
  /** Age a tile is born with at the full reach (scaled down with the reach spent): weaker tiles are dimmer and die sooner. */
  static FADE_AGE = 140;
  /** Age past its birth age during which a blast tile spreads (8 steps at AGE_RATE 12). */
  static SPREAD_WINDOW = 96;
  /** Chance per step that the front advances at the full reach (1 at the origin): it slows as it weakens. */
  static MIN_SPEED = 0.25;
  /** Extra reach spent eating through any tile (not air), so the blast reaches further in air than in the ground. */
  static SOLID_COST = 15;
  /** Extra reach spent eating through a tile, times its blastResistance. */
  static ABSORB = 20;
  /** Fraction of the reach past which the front starts turning into sparks thrown outward. */
  static SPARK_FROM = 0.55;
  /** Share of the cells the front takes at the full reach that become sparks instead of blast tiles. */
  static SPARK_SHARE = 0.4;
  /** Chance per step that an empty cell just past the reach throws a spark outward. */
  static RIM_SPARK_CHANCE = 0.1;
  /** Chances that a fading blast tile leaves smoke, a flame, a spark or rubble (otherwise it vanishes). */
  static SMOKE_CHANCE = 0.25;
  static FLAME_CHANCE = 0.03;
  static SPARK_CHANCE = 0.02;
  static RUBBLE_CHANCE = 0.06;

  readonly ageRate = Explosion.AGE_RATE;
  readonly agedInto = [
    { type: SETTINGS.SMOKE_TYPE, chance: Explosion.SMOKE_CHANCE },
    { type: SETTINGS.FLAME_TYPE, chance: Explosion.FLAME_CHANCE },
    { type: SETTINGS.SPARK_TYPE, chance: Explosion.SPARK_CHANCE },
    { type: SETTINGS.RUBBLE_TYPE, chance: Explosion.RUBBLE_CHANCE },
  ];

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 252, 224] },
    { at: 0.15, color: [255, 214, 90] },
    { at: 0.45, color: [255, 120, 30] },
    { at: 0.8, color: [150, 36, 20] },
    { at: 1, color: [56, 34, 34] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
