import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Methane (type 22) - swamp gas, lighter than everything else. It rises fast, drifts with
 * the smoke flow field and collects under ceilings. Any fire sets it off: a flame, ember,
 * spark or hot steel turns a methane tile into a flame, and those flames light the
 * tiles beside them, so a pocket flashes over in a moment. A rare tile detonates instead
 * (and a detonation restarts the blast at full size), so big pockets explode while a
 * little gas only burns. Released by decaying mold and by grass rotting in water.
 *
 * Drawn like steam, as a blurred haze in its own channel (3) colored from this
 * element's ramp. Behavior lives in mainGas / updateGas (engine/gpu/shaders.ts).
 */
export class Methane extends Element {
  readonly type = SETTINGS.METHANE_TYPE;
  readonly name = 'methane';
  readonly displayName = 'Methane';
  readonly defaultColor: [number, number, number] = [188, 214, 104];
  readonly phase = 'gas';
  readonly density = 0.08;
  readonly hazeChannel = 3;

  /** Chance per step that a tile rises one cell (0..1). */
  static RISE_SPEED = 0.6;
  /** Chance per step that a tile vanishes, so gas that nothing ignites leaks away slowly. */
  static DISSIPATION_CHANCE = 0.0003;
  /** Chance per step that a tile touching a flame detonates instead of just catching fire. */
  static DETONATE_CHANCE = 0.004;
  /** Chance per step that a tile touching a flame catches fire. */
  static FLAME_IGNITE_CHANCE = 0.5;
  /** Chance per step that a tile touching an ember catches fire. */
  static EMBER_IGNITE_CHANCE = 0.1;
  /** Chance per step that a tile touching a spark catches fire. */
  static SPARK_IGNITE_CHANCE = 0.7;
  /** Chance per step that a tile touching hot steel catches fire. */
  static HOT_STEEL_IGNITE_CHANCE = 0.05;

  /** Number of shades in the haze ramp. */
  static DENSITY_LEVELS = 16;
  /** Blurred methane occupancy (0..1) at which the haze reaches its densest shade. */
  static HAZE_FULL = 0.55;
  /** Haze opacity at full density (0..1). */
  static HAZE_OPACITY = 0.7;
  /** Weight of each new frame in the haze (0..1). */
  static HAZE_TEMPORAL = 0.2;
  static LIGHT_COLOR: [number, number, number] = [150, 178, 84];
  static DENSE_COLOR: [number, number, number] = [214, 232, 120];

  readonly riseSpeed = Methane.RISE_SPEED;
  readonly dissipationChance = Methane.DISSIPATION_CHANCE;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: Methane.DETONATE_CHANCE },
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Methane.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Methane.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Methane.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.FLAME_TYPE, chance: Methane.HOT_STEEL_IGNITE_CHANCE },
  ];

  private readonly ramp: [number, number, number][];

  constructor() {
    super();
    const { DENSITY_LEVELS: n, LIGHT_COLOR: light, DENSE_COLOR: dense } = Methane;
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
    return this.ramp[Math.min(variant, Methane.DENSITY_LEVELS - 1)];
  }
}
