import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Rubber (type 36) - a static insulator: it has no rule for electricity, so pulses stop at
 * it. It is flammable, and heat burns it away into a flame, which exposes the wire it coated.
 * Variants shift the base color by up to ±RUBBER_COLOR_VARIANCE per channel.
 */
export class Rubber extends Element {
  readonly type = SETTINGS.RUBBER_TYPE;
  readonly name = 'rubber';
  readonly displayName = 'Rubber';
  readonly defaultColor: [number, number, number] = [66, 48, 58];

  /** Chance per step that rubber touching the heat source catches and turns into a flame. */
  static FLAME_IGNITE_CHANCE = 0.02;
  static EMBER_IGNITE_CHANCE = 0.01;
  static SPARK_IGNITE_CHANCE = 0.2;
  static HOT_STEEL_IGNITE_CHANCE = 0.01;

  static RUBBER_VARIANT_COUNT = 4;
  static RUBBER_COLOR_VARIANCE = 8;

  readonly flammable = true;
  readonly blastResistance = 0.3;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Rubber.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Rubber.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Rubber.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Rubber.HOT_STEEL_IGNITE_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Rubber.RUBBER_VARIANT_COUNT, Rubber.RUBBER_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Rubber.RUBBER_VARIANT_COUNT];
  }
}
