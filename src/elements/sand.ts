import { Element, type Reaction } from '../engine/element';
import { buildVariantColors } from '../engine/colors';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Sand (type 1) — a falling particle. Falls straight down when the cell
 * below is air, otherwise slides diagonally (random side first) to form
 * classic piles. Behavior runs in the GPU compute shader (updateSand);
 * this class carries its color and gravity tuning.
 *
 * Gravity: effective fall rate = GRAVITY * Sand.GRAVITY_SCALE +
 * Sand.GRAVITY_OFFSET (tiles per step, clamped at 0). The base GRAVITY
 * comes from settings; the scale/offset are tuned here in the element
 * class. Fractional rates are tracked per grain in the tile's value
 * byte as a fixed-point accumulator (see engine/gravity.ts), so e.g.
 * 0.5 falls every other step with zero drift. At the default rate of 1
 * this behaves exactly like the classic one-cell-per-step rule.
 *
 * Touching water turns it into wet sand (WETTING_CHANCE per step), using up
 * one water tile per grain. Grains within SOAK_RADIUS of water also soak
 * through without using any up, so sand dropped into water or piled under it
 * ends up mostly wet rather than only along its surface.
 *
 * Variants 0–3 shift the base color by up to ±SAND_COLOR_VARIANCE per
 * channel; the shifted colors are precomputed at construction
 * (see engine/colors.ts).
 */
export class Sand extends Element {
  readonly type = SETTINGS.SAND_TYPE;
  readonly name = 'sand';
  readonly displayName = 'Sand';
  readonly defaultColor: [number, number, number] = [194, 178, 128];

  /**
   * Gravity tuning for sand, applied to the global GRAVITY base:
   * effective rate = GRAVITY * GRAVITY_SCALE + GRAVITY_OFFSET (tiles per
   * step). Scale > 1 = heavier (falls faster), < 1 = lighter; offset
   * shifts the rate directly. Negative effective rates clamp to 0.
   */
  static GRAVITY_SCALE = 3;

  /** Chance per step that a grain touching water turns into wet sand (soaking up that water). */
  static WETTING_CHANCE = 0.1;
  /** Grains within this many tiles of water soak through (without using it up) with SOAK_CHANCE per step. */
  static SOAK_RADIUS = 4;
  static SOAK_CHANCE = 0.08;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.WET_SAND_TYPE, chance: Sand.WETTING_CHANCE, consumes: true },
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.WET_SAND_TYPE, chance: Sand.SOAK_CHANCE, radius: Sand.SOAK_RADIUS },
  ];

  static SAND_VARIANT_COUNT = 4;
  static SAND_COLOR_VARIANCE = 15;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;
  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(
      SETTINGS.GRAVITY,
      Sand.GRAVITY_SCALE,
      0, // offset
    );
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Sand.SAND_VARIANT_COUNT,
      Sand.SAND_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Sand.SAND_VARIANT_COUNT];
  }
}
