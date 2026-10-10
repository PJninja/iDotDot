import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Grass (type 16) - a falling tile with high friction, so it lies in steep, clumpy
 * piles. It spreads over mud (Mud turns into grass beside it, see Mud.GRASS_GROW_CHANCE),
 * slowly rots away while touching water, and burns very easily: flames, embers, sparks
 * and hot steel turn it into an ember.
 */
export class Grass extends Element {
  readonly type = SETTINGS.GRASS_TYPE;
  readonly name = 'grass';
  readonly displayName = 'Grass';
  readonly defaultColor: [number, number, number] = [74, 142, 52];

  static GRAVITY_SCALE = 3;
  static SLIDE_CHANCE = 0.08;

  /** Chance per step that grass touching water rots away. */
  static ROT_CHANCE = 0.002;
  /** Chance per step that grass touching a flame catches and turns into an ember. */
  static FLAME_IGNITE_CHANCE = 0.08;
  /** Chance per step that grass touching an ember catches. */
  static EMBER_IGNITE_CHANCE = 0.03;
  /** Chance per step that grass touching a spark catches. */
  static SPARK_IGNITE_CHANCE = 0.3;
  /** Chance per step that grass touching hot steel catches. */
  static HOT_STEEL_IGNITE_CHANCE = 0.05;

  readonly slideChance = Grass.SLIDE_CHANCE;
  readonly flammable = true;
  readonly blastResistance = 0.1;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Grass.ROT_CHANCE },
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Grass.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Grass.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Grass.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Grass.HOT_STEEL_IGNITE_CHANCE },
  ];

  static GRASS_VARIANT_COUNT = 4;
  static GRASS_COLOR_VARIANCE = 14;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(SETTINGS.GRAVITY, Grass.GRAVITY_SCALE, 0);
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Grass.GRASS_VARIANT_COUNT,
      Grass.GRASS_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Grass.GRASS_VARIANT_COUNT];
  }
}
