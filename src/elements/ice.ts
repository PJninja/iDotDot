import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Ice (type 21) - a static solid that spreads: water touching it slowly freezes (Water's
 * rule), so a frost front creeps through a pool, and steam touching it condenses into
 * water (Steam's rule). Heat melts it back into water: flames and embers within
 * HEAT_RADIUS tiles, or a touching spark or hot steel.
 * Variants shift the base color by up to ±ICE_COLOR_VARIANCE per channel.
 */
export class Ice extends Element {
  readonly type = SETTINGS.ICE_TYPE;
  readonly name = 'ice';
  readonly displayName = 'Ice';
  readonly defaultColor: [number, number, number] = [176, 224, 248];

  /** Chance per step that a tile within HEAT_RADIUS of a flame or ember melts. */
  static MELT_CHANCE = 0.03;
  /** Chance per step that a tile touching a spark melts. */
  static SPARK_MELT_CHANCE = 0.3;
  /** Chance per step that a tile touching hot steel melts. */
  static HOT_STEEL_MELT_CHANCE = 0.08;
  /** Heat reach of flames and embers, in tiles (Chebyshev). */
  static HEAT_RADIUS = 2;

  static ICE_VARIANT_COUNT = 4;
  static ICE_COLOR_VARIANCE = 10;

  readonly blastResistance = 0.2;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.WATER_TYPE, chance: Ice.MELT_CHANCE, radius: Ice.HEAT_RADIUS },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.WATER_TYPE, chance: Ice.MELT_CHANCE, radius: Ice.HEAT_RADIUS },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.WATER_TYPE, chance: Ice.SPARK_MELT_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.WATER_TYPE, chance: Ice.HOT_STEEL_MELT_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Ice.ICE_VARIANT_COUNT, Ice.ICE_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Ice.ICE_VARIANT_COUNT];
  }
}
