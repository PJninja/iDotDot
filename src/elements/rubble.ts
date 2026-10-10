import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Rubble (type 25) - the debris a blast leaves behind: fading explosion tiles sometimes
 * turn into rubble (see Explosion.RUBBLE_CHANCE). A heavy, coarse falling tile with a lot
 * of friction, so it lies in steep, jagged heaps. Variants shift the base color by up
 * to ±RUBBLE_COLOR_VARIANCE per channel (a wide spread, so heaps look speckled).
 */
export class Rubble extends Element {
  readonly type = SETTINGS.RUBBLE_TYPE;
  readonly name = 'rubble';
  readonly displayName = 'Rubble';
  readonly defaultColor: [number, number, number] = [112, 104, 98];

  static GRAVITY_SCALE = 3;
  static SLIDE_CHANCE = 0.2;
  static DENSITY = 1.8;

  static RUBBLE_VARIANT_COUNT = 6;
  static RUBBLE_COLOR_VARIANCE = 24;

  readonly slideChance = Rubble.SLIDE_CHANCE;
  readonly density = Rubble.DENSITY;
  readonly blastResistance = 0.4;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(SETTINGS.GRAVITY, Rubble.GRAVITY_SCALE, 0);
    this.variantColors = buildVariantColors(this.defaultColor, Rubble.RUBBLE_VARIANT_COUNT, Rubble.RUBBLE_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Rubble.RUBBLE_VARIANT_COUNT];
  }
}
