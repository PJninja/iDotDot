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
 * while it weakens and its core burns out behind the front; a small share of the cells it
 * takes become fireballs (sparks marked with a variant, see FIREBALL_VARIANT) thrown outward at
 * every speed, which decelerate and fade, so the blast sprays glowing blobs far past its shell. Bombs touching it detonate with a fresh age and spent 0, which restarts the
 * blast at full size from there.
 *
 * Its variant byte is the blast's power * 16 (0 reads as 1), set from the exploding
 * type's Element.blastPower and passed along by the front: costs are divided by it and it
 * ages that many times slower, so a powerful blast is wider and burns longer with the same
 * fade. In the outer part of the reach the tiles it takes are thrown as debris (Debris).
 */
export class Explosion extends Element {
  readonly type = SETTINGS.EXPLOSION_TYPE;
  readonly name = 'explosion';
  readonly displayName = 'Explosion';
  readonly defaultColor: [number, number, number] = [255, 190, 70];
  readonly hidden = true;
  readonly glow = 1;

  /** Age steps per sim step (about 13 steps of life at the origin at 20 for power 1, less further out). */
  static AGE_RATE = 20;
  /** Reach spent per orthogonal cell the blast spreads. */
  static HOP_COST = 10;
  /** Reach spent per diagonal cell (about 1.4 x HOP_COST, which keeps the blast round). */
  static DIAGONAL_COST = 14;
  /** Reach an origin tile starts with: its radius in air is about REACH / HOP_COST cells (at most 255). */
  static REACH = 200;
  /** Age a tile is born with at the full reach (scaled down with the reach spent): weaker tiles are dimmer and die sooner. */
  static FADE_AGE = 240;
  /** Age past its birth age during which a blast tile spreads (8 steps at AGE_RATE 20). */
  static SPREAD_WINDOW = 160;
  /** A tile spreads for at most this share of the life it has left, so it has stopped spreading well before it dies and nothing refills its cell. */
  static SPREAD_SHARE = 0.5;
  /** Extra factor on the chance a front advances diagonally: orthogonal steps are certain at the start, so diagonal ones, being random, find lucky short paths and the blast bulges into a square with corners on the diagonals unless they are held back. */
  static DIAGONAL_DRAG = 0.6;
  /** Slowest chance per step that the front advances (near the full reach): the front keeps moving at nearly full speed and the tiles at the rim are born almost dead, so the shell thins out while it still moves instead of stopping at a fixed size. */
  static MIN_SPEED = 0.6;
  /** The front advances with chance (1 - spent / REACH) ^ FRONT_EASE (at least MIN_SPEED): it eases off gently as it weakens and keeps expanding until the reach is spent. */
  static FRONT_EASE = 0.5;
  /** Extra reach spent eating through any tile (not air), so the blast reaches further in air than in the ground. */
  static SOLID_COST = 6;
  /** Extra reach spent eating through a tile, times its blastResistance. */
  static ABSORB = 12;
  /** A tile holds against the blast with blastResistance ^ (power * SHATTER) per step, so blasts break tough tiles more easily than the resistance alone says. */
  static SHATTER = 2;
  /** Share of the cells the front takes (at any reach) that become fireballs thrown outward instead of blast tiles. */
  static FIREBALL_SHARE = 0;
  /** Chance per step that an empty cell just past the reach throws a fireball. */
  static RIM_FIREBALL_CHANCE = 0;
  /** Variant byte that marks a spark as a fireball: weak gravity and drag on both axes, so it decelerates to a stop (a painted spark has a random variant, so 1 in 256 are fireballs, which is harmless). */
  static FIREBALL_VARIANT = 255;
  /** Chance per step that gravity adds one cell/step of downward speed to a fireball. */
  static FIREBALL_GRAVITY = 0.1;
  /** Chance per step that a fireball loses one cell/step of speed on each axis: a fireball thrown at 6 cells/step flies about 60 cells, one at 2 about 7. */
  static FIREBALL_DRAG = 0.3;
  /** Chances that the scorch a burnt-out blast tile leaves turns into smoke, a flame, a spark or rubble (otherwise it vanishes). */
  static SMOKE_CHANCE = 0.4;
  static FLAME_CHANCE = 0.03;
  static SPARK_CHANCE = 0;
  static RUBBLE_CHANCE = 0;

  readonly ageRate = Explosion.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.SCORCH_TYPE, chance: 1 }];

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
