import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Shocked water (type 32) - water carrying an electric pulse, hidden from the picker.
 * Liquids do not age, so the pulse rides on a static solid for a few steps, then turns
 * into numb water. Water and steel beside it turn shocked or live (their own rules name
 * it). It is drawn as part of the water body with crackling veins over it (RENDER_WGSL),
 * bright when the pulse arrives and fading with age; getColor is only the debug and
 * readback color.
 */
export class ShockedWater extends Element {
  readonly type = SETTINGS.SHOCKED_WATER_TYPE;
  readonly name = 'shocked-water';
  readonly displayName = 'Shocked Water';
  readonly defaultColor: [number, number, number] = [200, 236, 255];
  readonly hidden = true;

  /** Age steps per sim step (16 = 16 steps). */
  static AGE_RATE = 16;

  readonly ageRate = ShockedWater.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.NUMB_WATER_TYPE, chance: 1 }];
  readonly blastResistance = 0.75;
  readonly hazeChannel = 1;

  /** Vein colors: the bright core and the glow around it. */
  static VEIN_CORE: [number, number, number] = [236, 250, 255];
  static VEIN_GLOW: [number, number, number] = [120, 150, 255];
  /** Blue tint over the water body at full strength (0..1). */
  static TINT = 0.35;
  /** Vein width in noise units (larger = thicker veins). */
  static VEIN_WIDTH = 0.06;
  /** Vein noise scale in cells (larger = longer, smoother veins). */
  static VEIN_SCALE = 5;
  /** How often per second the veins jump to a new shape. */
  static FLICKER_HZ = 24;
  /** Strength of the fading afterglow on numb water (0..1 of shocked water's). */
  static NUMB_GLOW = 0.3;

  private readonly ramp = buildGradient([
    { at: 0, color: [236, 250, 255] },
    { at: 1, color: [96, 170, 240] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
