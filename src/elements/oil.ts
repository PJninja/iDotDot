import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Oil (type 49) - a light liquid that floats on water and burns readily. It flows like
 * water (every liquid shares Water's tuning) but is less dense, so water sinks through it
 * and a slick spreads over the top of a pool. A flame, ember, spark, hot steel or a live
 * wire turns an oil tile into a flame, so fire runs across a slick in moments and eats
 * down into it from the surface; water under the slick is left alone. It is flammable,
 * so flames hold under it, sparks stick to it and flames beside it burn longer.
 * Drawn as tiles (no haze channel).
 */
export class Oil extends Element {
  readonly type = SETTINGS.OIL_TYPE;
  readonly name = 'oil';
  readonly displayName = 'Oil';
  readonly defaultColor: [number, number, number] = [22, 17, 12];
  readonly phase = 'liquid';
  readonly density = 0.8;

  /** Chance per step that an oil tile within FLAME_IGNITE_RADIUS of a flame catches fire. */
  static FLAME_IGNITE_CHANCE = 0.5;
  /**
   * Reach of the flame rule (cells). A flame born from oil rises off the slick within a
   * step or two, so at 1 a fire mostly dies before it spreads.
   */
  static FLAME_IGNITE_RADIUS = 3;
  /** Chance per step that an oil tile touching an ember catches fire. */
  static EMBER_IGNITE_CHANCE = 0.2;
  /** Chance per step that an oil tile touching a spark catches fire. */
  static SPARK_IGNITE_CHANCE = 0.8;
  /** Chance per step that an oil tile touching hot steel catches fire. */
  static HOT_STEEL_IGNITE_CHANCE = 0.08;
  /** Chance per step that an oil tile touching an arc catches fire. */
  static ARC_IGNITE_CHANCE = 0.4;
  /** Chance per step that an oil tile touching live steel or live copper catches fire. */
  static LIVE_STEEL_IGNITE_CHANCE = 0.05;

  static OIL_VARIANT_COUNT = 4;
  static OIL_COLOR_VARIANCE = 5;

  readonly flammable = true;
  readonly blastResistance = 0.1;
  readonly reactions: readonly Reaction[] = [
    {
      with: SETTINGS.FLAME_TYPE,
      becomes: SETTINGS.FLAME_TYPE,
      chance: Oil.FLAME_IGNITE_CHANCE,
      radius: Oil.FLAME_IGNITE_RADIUS,
    },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.HOT_STEEL_IGNITE_CHANCE },
    { with: SETTINGS.ARC_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.ARC_IGNITE_CHANCE },
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.LIVE_STEEL_IGNITE_CHANCE },
    { with: SETTINGS.LIVE_COPPER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Oil.LIVE_STEEL_IGNITE_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Oil.OIL_VARIANT_COUNT, Oil.OIL_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Oil.OIL_VARIANT_COUNT];
  }
}
