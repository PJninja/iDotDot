import { buildGradient } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Ember (type 9) - burning wood. A slow, clumpy falling tile that cools with age
 * (color ramp from bright orange through deep red to dark grey) and finally dies
 * into air. Where it touches air it turns into a flame (or, rarely, a spark), so
 * a burning pile is eaten away from its exposed faces; it lights wood it touches
 * (see Wood) and water puts it out (and turns to steam, see Water).
 *
 * Aging is generic (engine/gpu/shaders.ts, ageTile): the tile's age byte picks the
 * color row, so getColor's second argument is the age here.
 */
export class Ember extends Element {
  readonly type = SETTINGS.EMBER_TYPE;
  readonly name = 'ember';
  readonly displayName = 'Ember';
  readonly defaultColor: [number, number, number] = [240, 110, 30];

  static GRAVITY_SCALE = 1.5;
  static SLIDE_CHANCE = 0.4;
  static COHESION = 0.8;
  /** Age steps per sim step (mean lifetime about 256 / rate steps, 0.4 = about 10 s). */
  static AGE_RATE = 0.4;
  /** Chance per step that an ember touching air turns into a flame. */
  static FLAME_CHANCE = 0.01;
  /** Chance per step that an ember touching air turns into a spark. */
  static SPARK_CHANCE = 0.0005;
  /** Chance per step that an ember touching water goes out. */
  static QUENCH_CHANCE = 0.3;

  readonly slideChance = Ember.SLIDE_CHANCE;
  readonly cohesion = Ember.COHESION;
  readonly ageRate = Ember.AGE_RATE;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.AIR_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Ember.FLAME_CHANCE },
    { with: SETTINGS.AIR_TYPE, becomes: SETTINGS.SPARK_TYPE, chance: Ember.SPARK_CHANCE },
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Ember.QUENCH_CHANCE },
  ];

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 150, 40] },
    { at: 0.35, color: [214, 64, 22] },
    { at: 0.7, color: [112, 22, 16] },
    { at: 1, color: [48, 42, 42] },
  ]);

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(SETTINGS.GRAVITY, Ember.GRAVITY_SCALE, 0);
  }

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
