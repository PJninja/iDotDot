import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Smoke (type 4) - a gas that rises, drifts with SETTINGS.WIND / GpuSimulation.setWind,
 * slides around solids and dissipates over time. Falling elements treat smoke
 * as passable, so nothing rests on it.
 *
 * Tiles are not drawn individually: the render shader blurs smoke occupancy
 * into a translucent haze and looks the haze color up in this element's
 * light-to-dark ramp, so denser smoke is darker. Behavior lives in
 * updateGas (engine/gpu/shaders.ts).
 */
export class Smoke extends Element {
  readonly type = SETTINGS.SMOKE_TYPE;
  readonly name = 'smoke';
  readonly displayName = 'Smoke';
  readonly defaultColor: [number, number, number] = [150, 150, 158];
  readonly phase = 'gas';
  readonly density = 0.2;
  readonly hazeChannel = 0;

  /** Chance per step that a tile rises one cell (0..1); independent of SETTINGS.GRAVITY. */
  static RISE_SPEED = 0.35;
  /** How much the flow field speeds up / slows down rising (0 = uniform, 1 = up to 2x / stalled). */
  static RISE_VARIATION = 0.5;
  /** Chance per step that a tile drifts one cell sideways at full wind (|wind| = 1). */
  static WIND_SPEED = 0.5;
  /** Chance per step that a tile moves along the turbulence flow at full strength. */
  static TURBULENCE_SPEED = 0.35;
  /**
   * The turbulent flow is the curl of a smooth noise potential over cells of
   * TURBULENCE_SCALE tiles that changes over TURBULENCE_PERIOD steps. A curl is
   * divergence-free, so the flow swirls without squeezing smoke into clumps or
   * leaving voids. All tiles read the same field, so a patch moves together
   * (tiles hold no velocity of their own); a rougher field breaks the cloud
   * into droplets.
   */
  static TURBULENCE_SCALE = 14;
  static TURBULENCE_PERIOD = 90;
  /**
   * Pocket closing: an empty cell with at least this many smoke tiles among its
   * 8 neighbors is a pocket, and a less enclosed neighboring tile moves in, so
   * pockets drift to the cloud's edge and vanish. 9 disables it.
   */
  static POCKET_NEIGHBORS = 6;
  /** Chance per step that a tile vanishes (mean lifetime = 1 / chance steps). */
  static DISSIPATION_CHANCE = 0.002;

  /** Number of shades in the haze ramp. */
  static SMOKE_DENSITY_LEVELS = 16;
  /** Haze blur radius in tiles (integer; 1 = tight, 2 = soft). Larger looks blurrier. */
  static HAZE_RADIUS = 1;
  /** Weight of each new frame in the haze (0..1); lower smooths pockets and flicker over time but trails motion. */
  static HAZE_TEMPORAL = 0.2;
  /** How strongly drifting noise modulates the haze (0 = smooth, 1 = very wispy). */
  static WISP_AMOUNT = 0.35;
  /** Size of the wisp noise features in tiles. */
  static WISP_SCALE = 6;
  /** Blurred smoke occupancy (0..1) at which the haze reaches its darkest shade. */
  static HAZE_FULL = 0.6;
  /** Haze opacity at full density (0..1). */
  static HAZE_OPACITY = 0.92;
  static SMOKE_LIGHT_COLOR: [number, number, number] = [205, 205, 212];
  static SMOKE_DARK_COLOR: [number, number, number] = [28, 28, 36];

  readonly riseSpeed = Smoke.RISE_SPEED;
  readonly dissipationChance = Smoke.DISSIPATION_CHANCE;

  private readonly ramp: [number, number, number][];

  constructor() {
    super();
    const { SMOKE_DENSITY_LEVELS: n, SMOKE_LIGHT_COLOR: light, SMOKE_DARK_COLOR: dark } = Smoke;
    this.ramp = Array.from({ length: n }, (_, level) => {
      const f = level / (n - 1);
      return [0, 1, 2].map((c) => Math.round(light[c] + (dark[c] - light[c]) * f)) as [
        number,
        number,
        number,
      ];
    });
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.ramp[Math.min(variant, Smoke.SMOKE_DENSITY_LEVELS - 1)];
  }
}
