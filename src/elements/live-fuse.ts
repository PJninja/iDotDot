import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Live fuse (type 35) - a fuse carrying its one pulse, hidden from the picker. Static,
 * glows white-orange and burns out into air, leaving a gap. Steel and water beside it
 * turn live or shocked (their own rules name it).
 */
export class LiveFuse extends Element {
  readonly type = SETTINGS.LIVE_FUSE_TYPE;
  readonly name = 'live-fuse';
  readonly displayName = 'Live Fuse';
  readonly defaultColor: [number, number, number] = [255, 214, 150];
  readonly hidden = true;

  /** Age steps per sim step (12 = 22 steps, about 0.35 s). */
  static AGE_RATE = 12;

  readonly ageRate = LiveFuse.AGE_RATE;
  readonly blastResistance = 0.3;

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 246, 220] },
    { at: 0.4, color: [255, 170, 80] },
    { at: 1, color: [170, 70, 40] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
