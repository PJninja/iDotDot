import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Mud (type 8) — wet dirt. Falls like Dirt, but with more friction and a
 * stronger cohesion than wet sand: it clings to resting wet sand or mud beside
 * it and rarely rolls off a slope, so it lands in blobs and slumps slowly.
 */
export class Mud extends Element {
  readonly type = SETTINGS.MUD_TYPE;
  readonly name = 'mud';
  readonly displayName = 'Mud';
  readonly defaultColor: [number, number, number] = [92, 64, 44];

  static GRAVITY_SCALE = 4;
  static SLIDE_CHANCE = 0.15;
  static COHESION = 0.9;
  static DENSITY = 1.8;
  readonly slideChance = Mud.SLIDE_CHANCE;
  readonly cohesion = Mud.COHESION;
  readonly density = Mud.DENSITY;

  static MUD_VARIANT_COUNT = 4;
  static MUD_COLOR_VARIANCE = 10;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(
      SETTINGS.GRAVITY,
      Mud.GRAVITY_SCALE,
      0, // offset
    );
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Mud.MUD_VARIANT_COUNT,
      Mud.MUD_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Mud.MUD_VARIANT_COUNT];
  }
}
