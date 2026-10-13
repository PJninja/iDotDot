import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Copper (type 37) - a wire that carries the same pulse as steel (see LiveCopper and
 * SpentCopper, the same loop with the same timings) but never overloads into hot steel and
 * never throws arcs, so it is the safe way to run a long circuit. Fire and heat leave it
 * alone. Live copper lights flammables only on contact (their own rules name it), so a
 * copper tip is a detonator and nothing ignites at a distance. A static solid, pickable.
 * Variants shift the base color by up to ±COPPER_COLOR_VARIANCE per channel.
 */
export class Copper extends Element {
  readonly type = SETTINGS.COPPER_TYPE;
  readonly name = 'copper';
  readonly displayName = 'Copper';
  readonly defaultColor: [number, number, number] = [184, 104, 62];

  static COPPER_VARIANT_COUNT = 4;
  static COPPER_COLOR_VARIANCE = 10;

  /** Chance per step that copper touching live copper, live steel, a live fuse or shocked water turns live (same as steel). */
  static PULSE_CHANCE = 0.2;
  /** Chance per step that copper touching an arc turns live. */
  static ARC_CHANCE = 0.15;
  /** Chance per step that copper touching a generator turns live. */
  static GENERATOR_CHANCE = 0.002;

  readonly blastResistance = 0.95;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.LIVE_COPPER_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.PULSE_CHANCE },
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.PULSE_CHANCE },
    { with: SETTINGS.LIVE_FUSE_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.PULSE_CHANCE },
    { with: SETTINGS.SHOCKED_WATER_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.PULSE_CHANCE },
    { with: SETTINGS.ARC_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.ARC_CHANCE },
    { with: SETTINGS.GENERATOR_TYPE, becomes: SETTINGS.LIVE_COPPER_TYPE, chance: Copper.GENERATOR_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Copper.COPPER_VARIANT_COUNT, Copper.COPPER_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Copper.COPPER_VARIANT_COUNT];
  }
}
