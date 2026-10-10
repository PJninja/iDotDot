import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Stone (type 15) - a static solid with no physics and no friction concerns: it never
 * moves and does not burn. Very blast resistant, so explosions barely dent it.
 * Variants shift the base color by up to ±STONE_COLOR_VARIANCE per channel.
 */
export class Stone extends Element {
  readonly type = SETTINGS.STONE_TYPE;
  readonly name = 'stone';
  readonly displayName = 'Stone';
  readonly defaultColor: [number, number, number] = [118, 116, 112];

  static STONE_VARIANT_COUNT = 4;
  static STONE_COLOR_VARIANCE = 12;

  readonly blastResistance = 0.9;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Stone.STONE_VARIANT_COUNT,
      Stone.STONE_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Stone.STONE_VARIANT_COUNT];
  }
}
