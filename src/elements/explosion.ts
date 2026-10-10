import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Explosion (type 12) - the blast itself, hidden from the picker. A static solid that
 * ages like fire: a fresh tile is white-hot and cools through orange to dark red until
 * it vanishes. Its value byte is the reach the blast has spent getting here (0 at an
 * origin). Empty cells and non-resistant tiles next to a blast tile that can still
 * spread join the blast with a spent reach of that tile plus a hop cost, until the
 * reach runs out (blastSpent / blastHit / blastFill in engine/gpu/shaders.ts), so it
 * grows one cell per step from a tiny start and destroys what it eats through. Bombs
 * touching it detonate with a fresh age and spent 0, which restarts the blast at full
 * size from there.
 */
export class Explosion extends Element {
  readonly type = SETTINGS.EXPLOSION_TYPE;
  readonly name = 'explosion';
  readonly displayName = 'Explosion';
  readonly defaultColor: [number, number, number] = [255, 190, 70];
  readonly hidden = true;

  /** Age steps per sim step (about 0.85 s of life at 5). */
  static AGE_RATE = 5;
  /** Reach spent per orthogonal cell the blast spreads. */
  static HOP_COST = 10;
  /** Reach spent per diagonal cell (about 1.4 x HOP_COST, which keeps the blast round). */
  static DIAGONAL_COST = 14;
  /** Reach an origin tile starts with: its blast radius is about REACH / HOP_COST cells. */
  static REACH = 100;
  /** Blast tiles older than this no longer spread. */
  static SPREAD_MAX_AGE = 128;
  /** Extra reach spent eating through a tile, times its blastResistance. */
  static ABSORB = 20;

  readonly ageRate = Explosion.AGE_RATE;

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
