import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';
import { poweredBy } from './powered';

/**
 * Powered spring (type 46) - a dry spring that runs only on electricity. A live wire or
 * shocked water touching it turns it into a live spring (stage A, hidden), which pours water
 * like a Spring for a few seconds after the last pulse and then dries up again. It does not
 * pass the pulse on. Dry it emits nothing and keeps no chunk awake.
 * Variants shift the base color by up to ±POWERED_SPRING_COLOR_VARIANCE per channel.
 */
export class PoweredSpring extends Element {
  readonly type = SETTINGS.POWERED_SPRING_TYPE;
  readonly name = 'powered-spring';
  readonly displayName = 'Powered Spring';
  readonly defaultColor: [number, number, number] = [72, 90, 112];

  static POWERED_SPRING_VARIANT_COUNT = 4;
  static POWERED_SPRING_COLOR_VARIANCE = 8;

  readonly poweredEmitter = true;
  readonly blastResistance = 0.9;
  readonly reactions: readonly Reaction[] = poweredBy(SETTINGS.LIT_SPRING_A_TYPE);

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      PoweredSpring.POWERED_SPRING_VARIANT_COUNT,
      PoweredSpring.POWERED_SPRING_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % PoweredSpring.POWERED_SPRING_VARIANT_COUNT];
  }
}
