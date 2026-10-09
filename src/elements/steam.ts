import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Steam (type 6) - a white gas that moves like smoke (same flow field, wind and
 * pocket closing; it rises faster) but condenses: a tile that stays packed among
 * other steam tiles accumulates a timer in its value byte, and once the timer is
 * full it turns into water in place, one tile at a time with a small chance per step. Loose steam instead dissipates slowly.
 *
 * Drawn like smoke, as a blurred haze (its own channel in the haze buffer) whose
 * color comes from this element's ramp. Behavior lives in mainGas / updateGas
 * (engine/gpu/shaders.ts).
 */
export class Steam extends Element {
  readonly type = SETTINGS.STEAM_TYPE;
  readonly name = 'steam';
  readonly displayName = 'Steam';
  readonly defaultColor: [number, number, number] = [238, 242, 248];
  readonly phase = 'gas';
  readonly density = 0.1;
  readonly hazeChannel = 2;

  /** Chance per step that a tile rises one cell (0..1). */
  static RISE_SPEED = 0.5;
  /** Chance per step that a tile vanishes (steam that never packs up just thins out). */
  static DISSIPATION_CHANCE = 0.0006;
  /** A tile counts as compact when at least this many of its 8 neighbors are steam. */
  static CONDENSE_NEIGHBORS = 6;
  /** Steps a tile must stay compact (the value byte counts up while compact, down otherwise) before it turns into water. Max 255. */
  static CONDENSE_STEPS = 90;
  /** Chance per step that a tile with a full timer actually turns into water, so a packed cloud rains off gradually (mean 1 / chance steps). */
  static CONDENSE_CHANCE = 0.004;
  /** Timer steps lost per step while not compact. */
  static COOL_RATE = 2;

  /** Number of shades in the haze ramp. */
  static DENSITY_LEVELS = 16;
  /** Blurred steam occupancy (0..1) at which the haze reaches its densest shade. */
  static HAZE_FULL = 0.55;
  /** Haze opacity at full density (0..1). */
  static HAZE_OPACITY = 0.85;
  /** Weight of each new frame in the haze (0..1). */
  static HAZE_TEMPORAL = 0.2;
  static LIGHT_COLOR: [number, number, number] = [214, 222, 234];
  static DENSE_COLOR: [number, number, number] = [255, 255, 255];

  readonly riseSpeed = Steam.RISE_SPEED;
  readonly dissipationChance = Steam.DISSIPATION_CHANCE;

  private readonly ramp: [number, number, number][];

  constructor() {
    super();
    const { DENSITY_LEVELS: n, LIGHT_COLOR: light, DENSE_COLOR: dense } = Steam;
    this.ramp = Array.from({ length: n }, (_, level) => {
      const f = level / (n - 1);
      return [0, 1, 2].map((c) => Math.round(light[c] + (dense[c] - light[c]) * f)) as [
        number,
        number,
        number,
      ];
    });
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.ramp[Math.min(variant, Steam.DENSITY_LEVELS - 1)];
  }
}
