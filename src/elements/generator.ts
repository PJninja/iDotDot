import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Generator (type 31) - a static block that fires electric pulses forever: steel touching
 * it turns live at a low chance per step (Steel.GENERATOR_CHANCE), and it throws arcs into
 * open air (the generic emitter). It keeps its chunk awake, so a generator on screen
 * prevents idle, as a spring or torch does.
 * Variants shift the base color by up to ±GENERATOR_COLOR_VARIANCE per channel.
 */
export class Generator extends Element {
  readonly type = SETTINGS.GENERATOR_TYPE;
  readonly name = 'generator';
  readonly displayName = 'Generator';
  readonly defaultColor: [number, number, number] = [92, 106, 168];

  /** Chance per step, per empty cell beside the generator, that the cell fills with an arc. */
  static ARC_CHANCE = 0.002;

  static GENERATOR_VARIANT_COUNT = 4;
  static GENERATOR_COLOR_VARIANCE = 14;

  readonly emitType = SETTINGS.ARC_TYPE;
  readonly emitChance = Generator.ARC_CHANCE;
  readonly emitBelow = true;
  readonly blastResistance = 0.5;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Generator.GENERATOR_VARIANT_COUNT,
      Generator.GENERATOR_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Generator.GENERATOR_VARIANT_COUNT];
  }
}
