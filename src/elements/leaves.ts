import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Leaves (type 42) - a static, very flammable canopy. Being static, a crown can hang on
 * branches with nothing under it. Fire turns a leaf straight into a flame, so a crown fire
 * races through the leaves and slows down in the bark; a few leaves drop as ash instead.
 * Mold rots it and acid eats it.
 *
 * The rustle is drawn, not simulated: RENDER_WGSL shifts each leaf tile's shade with
 * gusts of noise that drift across the canopy (stronger in wind), and lets the paler
 * undersides flash where a gust peaks. Nothing moves in the grid, so leaves at rest let
 * their chunks sleep and the world idle (the canopy then holds still with the last frame).
 */
export class Leaves extends Element {
  readonly type = SETTINGS.LEAVES_TYPE;
  readonly name = 'leaves';
  readonly displayName = 'Leaves';
  readonly defaultColor: [number, number, number] = [56, 122, 48];

  static LEAVES_VARIANT_COUNT = 8;
  static LEAVES_COLOR_VARIANCE = 22;

  /** Chance per step that a leaf touching a flame catches and turns into a flame. */
  static FLAME_IGNITE_CHANCE = 0.06;
  /** Chance per step that a leaf touching a flame shrivels into ash (rolled after the flame rule). */
  static ASH_CHANCE = 0.01;
  /** Chance per step that a leaf touching an ember catches. */
  static EMBER_IGNITE_CHANCE = 0.03;
  /** Chance per step that a leaf touching a spark catches. */
  static SPARK_IGNITE_CHANCE = 0.3;
  /** Chance per step that a leaf touching hot steel catches. */
  static HOT_STEEL_IGNITE_CHANCE = 0.05;
  /** Chance per step that a leaf touching an arc catches. */
  static ARC_IGNITE_CHANCE = 0.05;
  /** Chance per step that a leaf touching live steel or live copper catches. */
  static LIVE_STEEL_IGNITE_CHANCE = 0.01;
  /** Chance per step that a leaf touching mold rots into mold. */
  static MOLD_CHANCE = 0.004;

  /** Shade shift at the height of a gust (fraction of the leaf color, up and down). */
  static RUSTLE_AMOUNT = 0.22;
  /** Gust strength with no wind (0..1); full wind gives 1. */
  static RUSTLE_CALM = 0.45;
  /** Gust size in tiles. */
  static GUST_SCALE = 14;
  /** Gust drift across the canopy in tiles per second. */
  static GUST_SPEED = 6;
  /** Flutter rate of single leaves (noise cells per second). */
  static FLUTTER_HZ = 2.5;
  /** Pale underside a leaf flips to at the peak of a gust, and how far toward it. */
  static UNDERSIDE_COLOR: readonly [number, number, number] = [168, 196, 140];
  static UNDERSIDE_AMOUNT = 0.55;

  readonly flammable = true;
  readonly blastResistance = 0.05;
readonly fragmentType = SETTINGS.ASH_TYPE;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.ASH_TYPE, chance: Leaves.ASH_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.HOT_STEEL_IGNITE_CHANCE },
    { with: SETTINGS.ARC_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.ARC_IGNITE_CHANCE },
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.LIVE_STEEL_IGNITE_CHANCE },
    { with: SETTINGS.LIVE_COPPER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Leaves.LIVE_STEEL_IGNITE_CHANCE },
    { with: SETTINGS.MOLD_TYPE, becomes: SETTINGS.MOLD_TYPE, chance: Leaves.MOLD_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Leaves.LEAVES_VARIANT_COUNT, Leaves.LEAVES_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Leaves.LEAVES_VARIANT_COUNT];
  }
}
