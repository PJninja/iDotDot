import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Torch (type 27) - a static block that burns forever without being used up: empty cells
 * beside and above it pull in flames (the generic emitter, as embers do, see
 * Element.emitType). Its flames light wood, grass, methane and anything else flammable
 * they reach, and it is not flammable itself. It keeps its chunk awake.
 * Variants shift the base color by up to ±TORCH_COLOR_VARIANCE per channel.
 */
export class Torch extends Element {
  readonly type = SETTINGS.TORCH_TYPE;
  readonly name = 'torch';
  readonly displayName = 'Torch';
  readonly defaultColor: [number, number, number] = [196, 112, 44];

  /** Chance per step, per empty cell beside or above the torch, that the cell fills with a flame. */
  static EMIT_CHANCE = 0.05;

  static TORCH_VARIANT_COUNT = 4;
  static TORCH_COLOR_VARIANCE = 14;

  readonly emitType = SETTINGS.FLAME_TYPE;
  readonly emitChance = Torch.EMIT_CHANCE;
  readonly blastResistance = 0.3;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Torch.TORCH_VARIANT_COUNT, Torch.TORCH_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Torch.TORCH_VARIANT_COUNT];
  }
}
