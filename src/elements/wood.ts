import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Variants 0–3 shift the base color by up to ±WOOD_COLOR_VARIANCE per
 * channel; the shifted colors are precomputed at construction
 * (see engine/colors.ts). Painted wood cycles through them for texture.
 * Touching a flame, ember or spark it can catch fire and turn into an ember; it is
 * flammable, so flames hold under it and sparks stick to it.
 */
export class Wood extends Element {
  readonly type = SETTINGS.WOOD_TYPE;
  readonly name = 'wood';
  readonly displayName = 'Wood';
  readonly defaultColor: [number, number, number] = [139, 90, 54];

  static WOOD_VARIANT_COUNT = 4;
  static WOOD_COLOR_VARIANCE = 15;

  /** Chance per step that wood touching a flame catches and turns into an ember. */
  static FLAME_IGNITE_CHANCE = 0.012;
  /** Chance per step that wood touching an ember catches (fire creeps slowly through a log). */
  static EMBER_IGNITE_CHANCE = 0.0025;
  /** Chance per step that wood touching a spark catches (sparks stick to wood, so this is a steady chance until they fade). */
  static SPARK_IGNITE_CHANCE = 0.1;
  readonly flammable = true;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Wood.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Wood.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Wood.SPARK_IGNITE_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Wood.WOOD_VARIANT_COUNT,
      Wood.WOOD_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Wood.WOOD_VARIANT_COUNT];
  }
}
