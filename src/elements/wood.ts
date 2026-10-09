import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Variants 0–3 shift the base color by up to ±WOOD_COLOR_VARIANCE per
 * channel; the shifted colors are precomputed at construction
 * (see engine/colors.ts). Painted wood cycles through them for texture.
 */
export class Wood extends Element {
  readonly type = SETTINGS.WOOD_TYPE;
  readonly name = 'wood';
  readonly displayName = 'Wood';
  readonly defaultColor: [number, number, number] = [139, 90, 54];

  static WOOD_VARIANT_COUNT = 4;
  static WOOD_COLOR_VARIANCE = 15;

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
