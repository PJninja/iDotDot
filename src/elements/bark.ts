import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Bark (type 40) - a static, flammable trunk wood. Where wood bursts into embers, bark
 * first chars: heat turns it into charred bark, which stands black for a while before it
 * crumbles into embers, so a tree caught in a crown fire is left as a blackened trunk that
 * smoulders and then collapses. Char also creeps slowly into the bark beside it, so a
 * scorched trunk burns through in the end. Mold rots it (slower than wood) and acid eats it.
 */
export class Bark extends Element {
  readonly type = SETTINGS.BARK_TYPE;
  readonly name = 'bark';
  readonly displayName = 'Bark';
  readonly defaultColor: [number, number, number] = [104, 76, 56];

  static BARK_VARIANT_COUNT = 4;
  static BARK_COLOR_VARIANCE = 14;

  /** Chance per step that bark touching a flame chars. */
  static FLAME_CHAR_CHANCE = 0.02;
  /** Chance per step that bark touching an ember chars. */
  static EMBER_CHAR_CHANCE = 0.006;
  /** Chance per step that bark touching a spark chars (sparks stick to it, so this repeats until they fade). */
  static SPARK_CHAR_CHANCE = 0.1;
  /** Chance per step that bark touching hot steel chars. */
  static HOT_STEEL_CHAR_CHANCE = 0.004;
  /** Chance per step that bark touching an arc chars. */
  static ARC_CHAR_CHANCE = 0.03;
  /** Chance per step that bark touching live steel or live copper chars. */
  static LIVE_STEEL_CHAR_CHANCE = 0.004;
  /** Chance per step that bark touching charred bark chars too (the char creeping inward, about a cell every few seconds). */
  static CREEP_CHANCE = 0.0015;
  /** Chance per step that bark touching mold rots into mold. */
  static MOLD_CHANCE = 0.0006;

  readonly flammable = true;
  readonly blastResistance = 0.35;
readonly fragmentType = SETTINGS.CHARCOAL_TYPE;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.FLAME_CHAR_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.EMBER_CHAR_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.SPARK_CHAR_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.HOT_STEEL_CHAR_CHANCE },
    { with: SETTINGS.ARC_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.ARC_CHAR_CHANCE },
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.LIVE_STEEL_CHAR_CHANCE },
    { with: SETTINGS.LIVE_COPPER_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.LIVE_STEEL_CHAR_CHANCE },
    { with: SETTINGS.CHARRED_BARK_TYPE, becomes: SETTINGS.CHARRED_BARK_TYPE, chance: Bark.CREEP_CHANCE },
    { with: SETTINGS.MOLD_TYPE, becomes: SETTINGS.MOLD_TYPE, chance: Bark.MOLD_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Bark.BARK_VARIANT_COUNT, Bark.BARK_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Bark.BARK_VARIANT_COUNT];
  }
}
