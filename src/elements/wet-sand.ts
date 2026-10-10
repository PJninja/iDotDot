import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Wet sand (type 7) — sand that sticks together. Falls like Sand, but its
 * cohesion lets grains cling to resting wet sand or mud beside them
 * (overhangs, clumps) and resist rolling off slopes, and its friction keeps
 * piles steep, so it holds sandcastle-like walls before slowly crumbling.
 * Heat dries it back into sand: flames and embers within a couple of tiles, or a
 * touching spark.
 */
export class WetSand extends Element {
  readonly type = SETTINGS.WET_SAND_TYPE;
  readonly name = 'wet-sand';
  readonly displayName = 'Wet Sand';
  readonly defaultColor: [number, number, number] = [150, 132, 88];

  static GRAVITY_SCALE = 3;
  static SLIDE_CHANCE = 0.3;
  static COHESION = 0.85;
  static DENSITY = 1.8;
  readonly slideChance = WetSand.SLIDE_CHANCE;
  readonly cohesion = WetSand.COHESION;
  readonly density = WetSand.DENSITY;

  /** Chance per step that a tile within HEAT_RADIUS of a flame or ember dries out. */
  static DRY_CHANCE = 0.04;
  /** Chance per step that a tile touching a spark dries out. */
  static SPARK_DRY_CHANCE = 0.3;
  /** Heat reach of flames and embers, in tiles (Chebyshev). */
  static HEAT_RADIUS = 2;
  /** Chance per step that a tile touching hot steel dries out. */
  static HOT_STEEL_DRY_CHANCE = 0.1;
  readonly blastResistance = 0.5;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.SAND_TYPE, chance: WetSand.DRY_CHANCE, radius: WetSand.HEAT_RADIUS },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.SAND_TYPE, chance: WetSand.DRY_CHANCE, radius: WetSand.HEAT_RADIUS },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.SAND_TYPE, chance: WetSand.SPARK_DRY_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.SAND_TYPE, chance: WetSand.HOT_STEEL_DRY_CHANCE },
  ];

  static WET_SAND_VARIANT_COUNT = 4;
  static WET_SAND_COLOR_VARIANCE = 12;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(
      SETTINGS.GRAVITY,
      WetSand.GRAVITY_SCALE,
      0, // offset
    );
    this.variantColors = buildVariantColors(
      this.defaultColor,
      WetSand.WET_SAND_VARIANT_COUNT,
      WetSand.WET_SAND_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % WetSand.WET_SAND_VARIANT_COUNT];
  }
}
