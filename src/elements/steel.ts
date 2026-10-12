import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Steel (type 17) - a static solid with no physics and extreme blast resistance. It
 * conducts heat: touching a flame, ember or spark it turns into hot steel, and hot steel
 * heats the steel beside it, so heat runs along a steel structure (see HotSteel and
 * CoolingSteel, which keep the heat from bouncing back and forth forever). It conducts
 * electricity too: touching live steel, an arc, a generator, a live fuse or shocked water it
 * turns into live steel (see LiveSteel and SpentSteel, the same loop with a fast pulse).
 */
export class Steel extends Element {
  readonly type = SETTINGS.STEEL_TYPE;
  readonly name = 'steel';
  readonly displayName = 'Steel';
  readonly defaultColor: [number, number, number] = [158, 168, 182];

  static STEEL_VARIANT_COUNT = 4;
  static STEEL_COLOR_VARIANCE = 8;

  /** Chance per step that steel touching a flame turns hot. */
  static FLAME_HEAT_CHANCE = 0.02;
  /** Chance per step that steel touching an ember turns hot. */
  static EMBER_HEAT_CHANCE = 0.01;
  /** Chance per step that steel touching a spark turns hot. */
  static SPARK_HEAT_CHANCE = 0.1;
  /** Chance per step that steel touching hot steel turns hot (how fast heat travels). */
  static CONDUCT_CHANCE = 0.03;
  /** Chance per step that steel touching live steel, a live fuse or shocked water turns live (about 60 * this cells/s along a wire). */
  static PULSE_CHANCE = 0.2;
  /** Chance per step that steel touching an arc turns live. */
  static ARC_CHANCE = 0.5;
  /** Chance per step that steel touching a generator turns live. */
  static GENERATOR_CHANCE = 0.01;

  readonly blastResistance = 0.98;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.HOT_STEEL_TYPE, chance: Steel.FLAME_HEAT_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.HOT_STEEL_TYPE, chance: Steel.EMBER_HEAT_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.HOT_STEEL_TYPE, chance: Steel.SPARK_HEAT_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.HOT_STEEL_TYPE, chance: Steel.CONDUCT_CHANCE },
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.LIVE_STEEL_TYPE, chance: Steel.PULSE_CHANCE },
    { with: SETTINGS.LIVE_FUSE_TYPE, becomes: SETTINGS.LIVE_STEEL_TYPE, chance: Steel.PULSE_CHANCE },
    { with: SETTINGS.SHOCKED_WATER_TYPE, becomes: SETTINGS.LIVE_STEEL_TYPE, chance: Steel.PULSE_CHANCE },
    { with: SETTINGS.ARC_TYPE, becomes: SETTINGS.LIVE_STEEL_TYPE, chance: Steel.ARC_CHANCE },
    { with: SETTINGS.GENERATOR_TYPE, becomes: SETTINGS.LIVE_STEEL_TYPE, chance: Steel.GENERATOR_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Steel.STEEL_VARIANT_COUNT,
      Steel.STEEL_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Steel.STEEL_VARIANT_COUNT];
  }
}
