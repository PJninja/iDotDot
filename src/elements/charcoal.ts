import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Charcoal (type 14) - what a fire sometimes leaves behind: a burnt-out ember rarely
 * turns into charcoal instead of vanishing (see Ember.CHARCOAL_CHANCE). A falling
 * powder with friction that piles steeply. Flammable, but slower to catch than wood:
 * a flame, ember, spark or hot steel can turn it back into an ember.
 */
export class Charcoal extends Element {
  readonly type = SETTINGS.CHARCOAL_TYPE;
  readonly name = 'charcoal';
  readonly displayName = 'Charcoal';
  readonly defaultColor: [number, number, number] = [38, 36, 40];

  static GRAVITY_SCALE = 3;
  static SLIDE_CHANCE = 0.3;

  /** Chance per step that charcoal touching a flame catches and turns into an ember. */
  static FLAME_IGNITE_CHANCE = 0.004;
  /** Chance per step that charcoal touching an ember catches. */
  static EMBER_IGNITE_CHANCE = 0.001;
  /** Chance per step that charcoal touching a spark catches (sparks stick, so this repeats until they fade). */
  static SPARK_IGNITE_CHANCE = 0.05;
  /** Chance per step that charcoal touching hot steel catches. */
  static HOT_STEEL_IGNITE_CHANCE = 0.003;

  readonly slideChance = Charcoal.SLIDE_CHANCE;
  readonly flammable = true;
  readonly blastResistance = 0.2;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Charcoal.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Charcoal.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Charcoal.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Charcoal.HOT_STEEL_IGNITE_CHANCE },
  ];

  static CHARCOAL_VARIANT_COUNT = 4;
  static CHARCOAL_COLOR_VARIANCE = 8;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(SETTINGS.GRAVITY, Charcoal.GRAVITY_SCALE, 0);
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Charcoal.CHARCOAL_VARIANT_COUNT,
      Charcoal.CHARCOAL_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Charcoal.CHARCOAL_VARIANT_COUNT];
  }
}
