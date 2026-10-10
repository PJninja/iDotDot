import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Spring (type 26) - a static block that never runs dry: empty cells beside, above and
 * below it pull in water without using the block up (the generic emitter, see
 * Element.emitType and `emit` in engine/gpu/shaders.ts). It keeps its chunk awake, so a
 * spring on screen prevents the world from idling. Very blast resistant.
 * Variants shift the base color by up to ±SPRING_COLOR_VARIANCE per channel.
 */
export class Spring extends Element {
  readonly type = SETTINGS.SPRING_TYPE;
  readonly name = 'spring';
  readonly displayName = 'Spring';
  readonly defaultColor: [number, number, number] = [74, 132, 196];

  /** Chance per step, per empty cell touching the spring, that the cell fills with water. */
  static EMIT_CHANCE = 0.12;

  static SPRING_VARIANT_COUNT = 4;
  static SPRING_COLOR_VARIANCE = 10;

  readonly emitType = SETTINGS.WATER_TYPE;
  readonly emitChance = Spring.EMIT_CHANCE;
  readonly emitBelow = true;
  readonly blastResistance = 0.9;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Spring.SPRING_VARIANT_COUNT, Spring.SPRING_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Spring.SPRING_VARIANT_COUNT];
  }
}
