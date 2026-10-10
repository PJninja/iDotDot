import { buildGradient } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Flame (type 10) - a light gas drawn as tiles. It rises and flickers sideways, each
 * tile on its own random rolls (updateFlame in engine/gpu/shaders.ts), unlike smoke
 * which moves in patches. Its age byte drives the color (white-yellow to orange to
 * red) and, once it passes 255, it turns into smoke. Wood touching a flame can catch
 * (see Wood); water puts it out.
 */
export class Flame extends Element {
  readonly type = SETTINGS.FLAME_TYPE;
  readonly name = 'flame';
  readonly displayName = 'Flame';
  readonly defaultColor: [number, number, number] = [255, 160, 40];
  readonly phase = 'gas';
  readonly density = 0.05;

  /** Chance per step that a tile rises one cell (0..1). */
  static RISE_SPEED = 0.8;
  /** Chance per step that a tile jitters one cell sideways. */
  static FLICKER = 0.3;
  /** Extra flicker chance at full wind (|wind| = 1); wind also biases the direction. */
  static WIND_FLICKER = 0.4;
  /** Age steps per sim step (about 0.5 s of life at 8). */
  static AGE_RATE = 8;
  /** Multiplier on the age rate while touching fuel (flammable tile or ember): flames burn longer where they are fed. */
  static FUEL_AGE_FACTOR = 0.35;
  /** Chance that a flame at the end of its life leaves smoke (otherwise it vanishes cleanly). */
  static SMOKE_CHANCE = 0.8;
  /** Chance that a flame at the end of its life throws a spark. */
  static SPARK_CHANCE = 0.03;
  /** Chance per step that a flame touching water goes out. */
  static QUENCH_CHANCE = 0.8;

  readonly riseSpeed = Flame.RISE_SPEED;
  readonly ageRate = Flame.AGE_RATE;
  readonly fuelFed = true;
  readonly agedInto = [
    { type: SETTINGS.SMOKE_TYPE, chance: Flame.SMOKE_CHANCE },
    { type: SETTINGS.SPARK_TYPE, chance: Flame.SPARK_CHANCE },
  ];
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Flame.QUENCH_CHANCE },
  ];

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 246, 190] },
    { at: 0.3, color: [255, 190, 60] },
    { at: 0.65, color: [240, 100, 24] },
    { at: 1, color: [170, 34, 20] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
