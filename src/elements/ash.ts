import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Ash (type 24) - what a fire sometimes leaves behind: a burnt-out ember turns into ash
 * (see Ember.ASH_CHANCE). A light, loose powder that spreads in flat piles and does not
 * burn again. Variants shift the base color by up to ±ASH_COLOR_VARIANCE per channel.
 */
export class Ash extends Element {
  readonly type = SETTINGS.ASH_TYPE;
  readonly name = 'ash';
  readonly displayName = 'Ash';
  readonly defaultColor: [number, number, number] = [148, 146, 150];

  static GRAVITY_SCALE = 2;
  static SLIDE_CHANCE = 0.7;
  static DENSITY = 1.3;

  static ASH_VARIANT_COUNT = 4;
  static ASH_COLOR_VARIANCE = 14;

  readonly slideChance = Ash.SLIDE_CHANCE;
  readonly density = Ash.DENSITY;
  readonly blastResistance = 0.05;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(SETTINGS.GRAVITY, Ash.GRAVITY_SCALE, 0);
    this.variantColors = buildVariantColors(this.defaultColor, Ash.ASH_VARIANT_COUNT, Ash.ASH_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Ash.ASH_VARIANT_COUNT];
  }
}
