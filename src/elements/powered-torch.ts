import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';
import { poweredBy } from './powered';

/**
 * Powered torch (type 43) - a cold torch that lights only on electricity. A live wire or
 * shocked water touching it turns it into a lit torch (stage A, hidden), which burns like a
 * Torch for a few seconds after the last pulse and then goes cold again. It does not pass the
 * pulse on. Unlit it emits nothing and keeps no chunk awake, so a world with only unlit
 * powered torches can idle.
 * Variants shift the base color by up to ±POWERED_TORCH_COLOR_VARIANCE per channel.
 */
export class PoweredTorch extends Element {
  readonly type = SETTINGS.POWERED_TORCH_TYPE;
  readonly name = 'powered-torch';
  readonly displayName = 'Powered Torch';
  readonly defaultColor: [number, number, number] = [98, 82, 72];

  static POWERED_TORCH_VARIANT_COUNT = 4;
  static POWERED_TORCH_COLOR_VARIANCE = 10;

  readonly poweredEmitter = true;
  readonly blastResistance = 0.3;
  readonly reactions: readonly Reaction[] = poweredBy(SETTINGS.LIT_TORCH_A_TYPE);

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      PoweredTorch.POWERED_TORCH_VARIANT_COUNT,
      PoweredTorch.POWERED_TORCH_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % PoweredTorch.POWERED_TORCH_VARIANT_COUNT];
  }
}
